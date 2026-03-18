from pathlib import Path
from config import PROMPTS_DIR


def load_prompt(filename: str) -> str:
    """Load a prompt from the prompts directory."""
    filepath = PROMPTS_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Prompt file not found: {filepath}")
    return filepath.read_text(encoding="utf-8").strip()


def load_all_worker_prompts() -> dict[str, str]:
    """Load all worker prompts. Returns {worker_name: prompt_text}."""
    workers = {}
    for f in PROMPTS_DIR.glob("worker_*.txt"):
        name = f.stem.replace("worker_", "")
        workers[name] = f.read_text(encoding="utf-8").strip()
    return workers
