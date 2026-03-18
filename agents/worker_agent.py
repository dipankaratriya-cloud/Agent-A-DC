"""Worker agent — uses GroqBrowserAutomation to extract ONE checklist item."""
from src.utils.groq_browser_automation import GroqBrowserAutomation
from utils.prompt_loader import load_prompt
from config import GROQ_API_KEY


def run_worker(name: str, prompt_file: str, url: str, description: str = "") -> dict:
    """Run a single worker that visits the URL and extracts one checklist item."""
    client = GroqBrowserAutomation(api_key=GROQ_API_KEY)
    worker_prompt = load_prompt(prompt_file)

    if description:
        worker_prompt += f"\nUser context: {description}"

    result = client.extract_checklist_item(url, worker_prompt, max_retries=2)

    return {
        "name": name,
        "result": result.get("content", ""),
        "success": result.get("success", False),
        "executed_tools": result.get("executed_tools", []),
    }
