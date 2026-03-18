"""Scraper agent — visits URL via Groq Compound browser and extracts all content."""
from agents.groq_client import GroqCompoundClient
from utils.prompt_loader import load_prompt
from config import DATA_RAW_DIR, GROQ_API_KEY


def run_scraper(url: str, description: str = "") -> dict:
    """Visit URL with browser automation, extract all content, save to filesystem."""
    client = GroqCompoundClient(api_key=GROQ_API_KEY)
    prompt_template = load_prompt("scraper.txt")

    prompt = f"{prompt_template}\n\nURL to visit: {url}"
    if description:
        prompt += f"\nAdditional context: {description}"

    result = client.query(prompt, max_retries=3)

    # Save raw content
    safe_name = url.replace("https://", "").replace("http://", "").replace("/", "_")[:50]
    raw_file = DATA_RAW_DIR / f"{safe_name}.txt"
    raw_file.write_text(result["content"], encoding="utf-8")

    return {
        "url": url,
        "description": description,
        "raw_content": result["content"],
        "raw_file_path": str(raw_file),
        "success": result["success"],
    }
