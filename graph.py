"""
LangGraph supervisor graph for the metadata extraction pipeline.

Flow:
  Scraper (1 browser visit) → Fan-out to 20 Workers (text-only) → Output Agents
"""
import json
import operator
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END

from config import get_groq_api_key, DATA_SCRAPED_DIR, DATA_OUTPUT_DIR
from agents.groq_client import GroqCompoundClient
from utils.prompt_loader import load_prompt
from utils.file_utils import parse_checklist
from utils.docx_generator import generate_import_docx


# ─── State Schema ───

def _merge_tokens(a: dict, b: dict) -> dict:
    return {k: a.get(k, 0) + b.get(k, 0) for k in ("prompt", "completion", "total")}

class PipelineState(TypedDict):
    url: str
    source_name: str
    description: str
    scraped_data: dict
    scraped_data_path: str
    worker_results: Annotated[list, operator.add]
    import_doc_path: str
    croissant_path: str
    token_usage: Annotated[dict, _merge_tokens]
    error: str


# ─── Node: Scraper ───

def scraper_node(state: PipelineState) -> dict:
    """
    ONE browser visit to the URL. Extracts EVERYTHING as structured JSON.
    Saves to filesystem. All downstream agents read from this data.
    """
    url = state["url"]
    description = state.get("description", "")
    client = GroqCompoundClient(api_key=get_groq_api_key())
    prompt_template = load_prompt("scraper.txt")

    prompt = f"{prompt_template}\n\nURL to visit: {url}"
    if description:
        prompt += f"\nUser context: {description}"

    result = client.query(prompt, max_retries=3)
    content = result.get("content", "")

    # Try to parse as JSON
    scraped_data = {}
    try:
        # Strip markdown fences if present
        cleaned = content
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
        scraped_data = json.loads(cleaned.strip())
    except (json.JSONDecodeError, IndexError):
        # Fallback: store raw text so workers can still search it
        scraped_data = {
            "page_metadata": {"title": "", "url": url},
            "raw_text": content,
            "license": {"found": False},
            "temporal": {"found": False},
            "geographic": {"found": False},
            "core_attributes": {"found": False},
            "data_vertical": {"found": False},
            "source_urls": {"found": False},
            "format_access": {"found": False},
            "refresh_info": {"found": False},
            "all_links": [],
        }

    # Save to filesystem
    safe_name = url.replace("https://", "").replace("http://", "").replace("/", "_")[:50]
    save_path = DATA_SCRAPED_DIR / f"{safe_name}.json"
    save_path.write_text(json.dumps(scraped_data, indent=2, default=str), encoding="utf-8")

    return {
        "scraped_data": scraped_data,
        "scraped_data_path": str(save_path),
        "token_usage": client.get_token_usage(),
    }


# ─── Node: Workers (sequential to avoid rate limits) ───

def workers_node(state: PipelineState) -> dict:
    """
    Run all 20 checklist workers. Each reads from scraped_data (no browser).
    Uses compound-mini for speed.
    """
    scraped_data = state["scraped_data"]
    description = state.get("description", "")
    client = GroqCompoundClient(api_key=get_groq_api_key())

    checklist_items = parse_checklist()
    all_results = []

    # Build a condensed version of scraped data for the prompt
    # Workers get: the relevant section + raw_text (truncated)
    raw_text = scraped_data.get("raw_text", "")
    if len(raw_text) > 15000:
        raw_text = raw_text[:15000] + "\n... [truncated]"

    for item in checklist_items:
        worker_prompt = load_prompt(item["prompt_file"])

        # Build context from scraped data
        context = f"=== SCRAPED DATA (JSON) ===\n{json.dumps(scraped_data, indent=2, default=str)[:8000]}\n"
        context += f"\n=== RAW PAGE TEXT ===\n{raw_text}\n"

        prompt = (
            f"{worker_prompt}\n\n"
            f"Analyze the following scraped data from a dataset page to find the requested information.\n"
            f"Do NOT browse any URLs. Only use the data provided below.\n\n"
            f"{context}"
        )

        if description:
            prompt += f"\nUser context: {description}"

        result = client.query_text(prompt)

        wr = {
            "name": item["name"],
            "description": item["description"],
            "result": result.get("content", ""),
            "success": result.get("success", False),
        }
        all_results.append(wr)

    return {"worker_results": all_results, "token_usage": client.get_token_usage()}


# ─── Node: Import Document ───

def import_doc_node(state: PipelineState) -> dict:
    """Compile worker results into a Word document using the DC Import Doc format."""
    client = GroqCompoundClient(api_key=get_groq_api_key())
    prompt_template = load_prompt("import_document.txt")

    compiled = f"Dataset URL: {state['url']}\n\n"
    for wr in state["worker_results"]:
        compiled += f"=== {wr['name'].upper()} ===\n{wr['result']}\n\n"

    result = client.query_text(f"{prompt_template}\n\n{compiled}")
    content = result.get("content", "")

    # Parse the LLM's clean JSON output
    clean_data = None
    try:
        cleaned = content
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in cleaned:
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
        clean_data = json.loads(cleaned.strip())
    except (json.JSONDecodeError, IndexError):
        clean_data = None

    output_path = DATA_OUTPUT_DIR / "import_document.docx"
    source_name = state.get("source_name", "") or state["url"]
    generate_import_docx(source_name, state["url"], state["worker_results"], clean_data, output_path)
    return {"import_doc_path": str(output_path), "token_usage": client.get_token_usage()}


# ─── Node: Croissant ───

def croissant_node(state: PipelineState) -> dict:
    """Compile worker results into Croissant JSON-LD."""
    from config import SCHEMAS_DIR

    client = GroqCompoundClient(api_key=get_groq_api_key())
    prompt_template = load_prompt("croissant.txt")

    example_schema = ""
    example_file = SCHEMAS_DIR / "croissant_example.json"
    if example_file.exists():
        example_schema = f"\n\nReference Croissant schema:\n{example_file.read_text()}"

    compiled = f"Dataset URL: {state['url']}\n\n"
    for wr in state["worker_results"]:
        compiled += f"=== {wr['name'].upper()} ===\n{wr['result']}\n\n"

    result = client.query_text(f"{prompt_template}{example_schema}\n\n{compiled}")
    content = result.get("content", "")

    output_path = DATA_OUTPUT_DIR / "croissant_metadata.json"
    try:
        if "```json" in content:
            content = content.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in content:
            content = content.split("```", 1)[1].split("```", 1)[0]
        parsed = json.loads(content.strip())
        output_path.write_text(json.dumps(parsed, indent=2))
    except (json.JSONDecodeError, IndexError):
        output_path.write_text(content)

    return {"croissant_path": str(output_path), "token_usage": client.get_token_usage()}


# ─── Build Graph ───

def build_graph():
    """Build the LangGraph pipeline: Scraper → Workers → Output Agents."""
    graph = StateGraph(PipelineState)

    graph.add_node("scraper", scraper_node)
    graph.add_node("workers", workers_node)
    graph.add_node("import_doc", import_doc_node)
    graph.add_node("croissant", croissant_node)

    graph.set_entry_point("scraper")
    graph.add_edge("scraper", "workers")
    graph.add_edge("workers", "import_doc")
    graph.add_edge("import_doc", "croissant")
    graph.add_edge("croissant", END)

    return graph.compile()
