from pathlib import Path
from config import CHECKLIST_DIR


def parse_checklist(checklist_file: str = "checklist.txt") -> list[dict]:
    """
    Parse checklist file. Each non-comment line has format:
    name | prompt_file | description

    Returns list of dicts: [{"name": ..., "prompt_file": ..., "description": ...}]
    """
    filepath = CHECKLIST_DIR / checklist_file
    items = []
    for line in filepath.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 3:
            items.append({
                "name": parts[0],
                "prompt_file": parts[1],
                "description": parts[2],
            })
    return items
