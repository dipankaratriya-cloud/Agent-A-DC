"""Croissant agent — compiles worker results into Croissant JSON-LD."""
import json
from src.utils.groq_browser_automation import GroqBrowserAutomation
from utils.prompt_loader import load_prompt
from config import GROQ_API_KEY, DATA_OUTPUT_DIR, SCHEMAS_DIR


def run_croissant_agent(url: str, worker_results: list[dict]) -> str:
    """Compile all worker results into Croissant JSON-LD format (.json)."""
    client = GroqBrowserAutomation(api_key=GROQ_API_KEY)
    prompt_template = load_prompt("croissant.txt")

    example_schema = ""
    example_file = SCHEMAS_DIR / "croissant_example.json"
    if example_file.exists():
        example_schema = f"\n\nReference Croissant schema example:\n{example_file.read_text()}"

    compiled = f"Dataset URL: {url}\n\n"
    for wr in worker_results:
        compiled += f"=== {wr['name'].upper()} ===\n{wr['result']}\n\n"

    prompt = f"{prompt_template}{example_schema}\n\n{compiled}"

    result = client.extract_with_automation(prompt, max_retries=1)
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

    return str(output_path)
