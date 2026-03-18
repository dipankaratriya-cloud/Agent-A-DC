"""Import Document agent — compiles worker results into a Word doc."""
from src.utils.groq_browser_automation import GroqBrowserAutomation
from utils.prompt_loader import load_prompt
from utils.docx_generator import generate_docx
from config import GROQ_API_KEY, DATA_OUTPUT_DIR


def run_import_doc_agent(url: str, worker_results: list[dict]) -> str:
    """Compile all worker results into a structured import document (.docx)."""
    client = GroqBrowserAutomation(api_key=GROQ_API_KEY)
    prompt_template = load_prompt("import_document.txt")

    compiled = f"Dataset URL: {url}\n\n"
    for wr in worker_results:
        compiled += f"=== {wr['name'].upper()} ===\n{wr['result']}\n\n"

    prompt = f"{prompt_template}\n\n{compiled}"

    # No browsing needed — text processing only
    result = client.extract_with_automation(prompt, max_retries=1)

    output_path = DATA_OUTPUT_DIR / "import_document.docx"
    generate_docx(result.get("content", ""), output_path)
    return str(output_path)
