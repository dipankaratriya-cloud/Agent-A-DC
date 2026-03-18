import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
PROMPTS_DIR = BASE_DIR / "prompts"
CHECKLIST_DIR = BASE_DIR / "checklist"
DATA_RAW_DIR = BASE_DIR / "data" / "raw"
DATA_SCRAPED_DIR = BASE_DIR / "data" / "scraped"
DATA_OUTPUT_DIR = BASE_DIR / "data" / "output"
TEMPLATES_DIR = BASE_DIR / "templates"
SCHEMAS_DIR = BASE_DIR / "schemas"

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Model Config
SCRAPER_MODEL = "groq/compound"          # Browser + web search enabled
WORKER_MODEL = "groq/compound-mini"      # Text-only, fast, no browser needed
OUTPUT_MODEL = "groq/compound-mini"      # Text-only for doc generation

# Create directories
for d in [DATA_RAW_DIR, DATA_SCRAPED_DIR, DATA_OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)
