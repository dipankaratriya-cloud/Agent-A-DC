# Dataset Metadata Extraction Pipeline — Implementation Plan

## 1. Project Overview

A multi-agent pipeline built with **Agno** that:

1. Takes a URL (or dataset name) + optional description from the user via a Streamlit UI
2. Scrapes all content from that URL using **Groq Compound** (handles JS-rendered pages)
3. Spawns **worker agents** (one per checklist item) that each extract specific metadata from the scraped data
4. Feeds all extracted metadata into two **output agents**:
   - **Import Document Agent** — generates a populated Word document (.docx)
   - **Croissant Agent** — generates a Croissant JSON-LD metadata file
5. Displays results in Streamlit with download buttons for both outputs

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        STREAMLIT UI                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐    │
│  │ URL Input     │  │ Description Box  │  │ Fetch Metadata  │    │
│  └──────────────┘  └──────────────────┘  └────────┬────────┘    │
└───────────────────────────────────────────────────┼──────────────┘
                                                    │
                                                    ▼
                                     ┌──────────────────────────┐
                                     │  ORCHESTRATOR             │
                                     │  (orchestrator.py)        │
                                     └────────────┬─────────────┘
                                                  │
              ┌───────────────────────────────────┼─────────────────────────────────┐
              │                        STEP 1: SCRAPE                               │
              │                                                                     │
              │   ┌──────────────────────────────────────────────────────────────┐   │
              │   │  Scraper Agent (Groq Compound — uses built-in browser)       │   │
              │   │  • Visits URL                                                │   │
              │   │  • Extracts ALL page content (text, tables, links, metadata) │   │
              │   │  • Saves raw content to /data/raw/                           │   │
              │   └──────────────────────────────┬───────────────────────────────┘   │
              └──────────────────────────────────┼──────────────────────────────────┘
                                                 │
                                                 ▼
              ┌──────────────────────────────────────────────────────────────────────┐
              │                    STEP 2: 20 WORKER AGENTS                          │
              │             (Each reads scraped data, does ONE task)                  │
              │                                                                      │
              │  ┌─── Section A: Source Assessment ───────────────────────────────┐   │
              │  │ A1 Core Attributes  │ A2 Data Vertical │ A3 Geo Level         │   │
              │  │ A4 License Check    │ A5 License URL   │                      │   │
              │  └────────────────────────────────────────────────────────────────┘   │
              │                                                                      │
              │  ┌─── Section B: Format & Acquisition ───────────────────────────┐   │
              │  │ B6 Parent URL       │ B6.1 Child URLs    │ B7 Source Format   │   │
              │  │ B8 Programmatic     │ B9 Rate Limits     │ B10 Sample URL     │   │
              │  │ B10.1 Metadata URLs │ B11 Download Steps │                    │   │
              │  └────────────────────────────────────────────────────────────────┘   │
              │                                                                      │
              │  ┌─── Section C: Availability & Periodicity ─────────────────────┐   │
              │  │ C12 Min Date        │ C13 Max Date        │ C14 Periodicity   │   │
              │  │ C14.1 Date Res.     │ C14.2 Place Res.    │ C15 Refresh Freq  │   │
              │  │ C16 Last Refresh    │ C17 Next Refresh    │                   │   │
              │  └────────────────────────────────────────────────────────────────┘   │
              └──────────────────────────────────┬───────────────────────────────────┘
                                                 │
                        All 20 results collected │
                                                 ▼
              ┌──────────────────────────────────────────────────────────────────────┐
              │                    STEP 3: OUTPUT AGENTS                              │
              │                                                                      │
              │  ┌────────────────────────────┐  ┌──────────────────────────────┐    │
              │  │  Import Document Agent     │  │  Croissant Agent             │    │
              │  │  • Receives all 20 results │  │  • Receives all 20 results   │    │
              │  │  • Generates structured    │  │  • Generates valid JSON-LD   │    │
              │  │    JSON → python-docx      │  │    following Croissant 1.0   │    │
              │  │  • Outputs .docx file      │  │  • Outputs .json file        │    │
              │  └─────────────┬──────────────┘  └──────────────┬───────────────┘    │
              └────────────────┼─────────────────────────────────┼───────────────────┘
                               │                                 │
                               ▼                                 ▼
              ┌──────────────────────────────────────────────────────────────────────┐
              │                        STREAMLIT UI                                  │
              │  ┌──────────────────────────────────────────────────────────────┐    │
              │  │  Extracted Metadata (20 expandable sections by checklist #)  │    │
              │  ├─────────────────────────┬────────────────────────────────────┤    │
              │  │  Download Import Doc    │  Download Croissant Metadata       │    │
              │  │  (.docx)                │  (.json)                           │    │
              │  └─────────────────────────┴────────────────────────────────────┘    │
              └──────────────────────────────────────────────────────────────────────┘

Total: 1 Scraper + 20 Workers + 2 Output = 23 Agents
```

---

## 3. Project Structure

```
Agent-A-DC/
├── IMPLEMENTATION_PLAN.md          # This file
├── requirements.txt                # Python dependencies
├── .env                            # API keys (GROQ_API_KEY)
├── app.py                          # Streamlit UI entry point
├── config.py                       # Global configuration & constants
├── orchestrator.py                 # Main pipeline orchestrator
│
├── agents/
│   ├── __init__.py
│   ├── scraper_agent.py            # Scraper agent (Groq Compound)
│   ├── worker_agent.py             # Generic worker agent factory (reads prompt file per item)
│   ├── import_doc_agent.py         # Import document generation agent
│   └── croissant_agent.py          # Croissant JSON-LD generation agent
│
├── prompts/                        # Editable prompt files — ONE per agent, ONE task each
│   ├── scraper.txt                 # Scraper agent prompt
│   │
│   │   # ── Section A: Initial Data Source Assessment ──
│   ├── worker_core_attributes.txt       # A1:  Core Attributes (Place, Period, Variable, Values)
│   ├── worker_data_vertical.txt         # A2:  Data Vertical (Level 1)
│   ├── worker_geo_level.txt             # A3:  Geo Level identification
│   ├── worker_license_check.txt         # A4:  License is Public & Permissible?
│   ├── worker_license_url.txt           # A5:  License URL documented?
│   │
│   │   # ── Section B: Source Format & Acquisition Plan ──
│   ├── worker_parent_url.txt            # B6:   Parent/Provenance URL
│   ├── worker_child_urls.txt            # B6.1: Child Source URL(s)
│   ├── worker_source_format.txt         # B7:   Source Format identification
│   ├── worker_programmatic_access.txt   # B8:   Programmatic Access feasibility
│   ├── worker_rate_limits.txt           # B9:   Rate Limits
│   ├── worker_sample_url.txt            # B10:  Sample Source URL
│   ├── worker_metadata_urls.txt         # B10.1:Document URLs for metadata
│   ├── worker_download_steps.txt        # B11:  Download Steps
│   │
│   │   # ── Section C: Data Availability & Periodicity ──
│   ├── worker_min_date.txt              # C12:   Min Date
│   ├── worker_max_date.txt              # C13:   Max Date
│   ├── worker_periodicity.txt           # C14:   Periodicity of Data
│   ├── worker_date_resolution.txt       # C14.1: Date Resolution (ISO format)
│   ├── worker_place_resolution.txt      # C14.2: Place Resolution & Place Types
│   ├── worker_refresh_frequency.txt     # C15:   Refresh/Release Frequency
│   ├── worker_last_refresh.txt          # C16:   Last Refresh Date in Source
│   ├── worker_next_refresh.txt          # C17:   Next Expected Refresh Date
│   │
│   │   # ── Output Agents ──
│   ├── import_document.txt              # Import document agent prompt
│   └── croissant.txt                    # Croissant agent prompt
│
├── checklist/
│   └── checklist.txt               # The checklist file (user-provided)
│
├── templates/
│   └── import_template.docx        # Word doc template (user-provided)
│
├── data/
│   ├── raw/                        # Raw scraped content stored here
│   └── output/                     # Generated output files (.docx, .json)
│
├── utils/
│   ├── __init__.py
│   ├── file_utils.py               # File I/O helpers
│   ├── prompt_loader.py            # Load prompts from /prompts/ folder
│   └── docx_generator.py           # Word document generation using python-docx
│
└── schemas/
    └── croissant_example.json      # Reference Croissant schema example
```

### 3.1 Agent-to-Checklist Mapping (20 Worker Agents)

Each checklist item gets its own isolated agent. One task, one agent, no overlap.

| # | Checklist Item | Agent Prompt File | Agent Does Exactly One Thing |
|---|---------------|-------------------|------------------------------|
| A1 | Core Attributes Present? | `worker_core_attributes.txt` | Find Place, Period, Variable, Values |
| A2 | Data Vertical Identified? | `worker_data_vertical.txt` | Identify the data vertical (Education, Health, etc.) |
| A3 | Geo Level Identified? | `worker_geo_level.txt` | Identify geo level (Country, AA1, AA2) |
| A4 | License Public & Permissible? | `worker_license_check.txt` | Determine if license is public & permissible |
| A5 | License URL Documented? | `worker_license_url.txt` | Find the license URL |
| B6 | Parent/Provenance URL | `worker_parent_url.txt` | Find the parent page URL |
| B6.1 | Child Source URL(s) | `worker_child_urls.txt` | Find direct download links |
| B7 | Source Format Identified? | `worker_source_format.txt` | Identify file format (CSV, API, XLS) |
| B8 | Programmatic Access Feasible? | `worker_programmatic_access.txt` | Determine if API/programmatic access exists |
| B9 | Rate Limits Noted? | `worker_rate_limits.txt` | Find any rate limit info |
| B10 | Sample Source URL | `worker_sample_url.txt` | Find a sample/preview URL |
| B10.1 | Document URLs for Metadata | `worker_metadata_urls.txt` | Find documentation/metadata page URLs |
| B11 | Download Steps | `worker_download_steps.txt` | Document the download procedure |
| C12 | Min Date | `worker_min_date.txt` | Find the earliest date in the dataset |
| C13 | Max Date | `worker_max_date.txt` | Find the latest date in the dataset |
| C14 | Periodicity of Data | `worker_periodicity.txt` | Determine data frequency (Annual, Monthly, etc.) |
| C14.1 | Date Resolution | `worker_date_resolution.txt` | Determine date format (ISO YYYY-MM-DD) |
| C14.2 | Place Resolution & Place Types | `worker_place_resolution.txt` | Identify place codes vs text, resolution |
| C15 | Refresh/Release Frequency | `worker_refresh_frequency.txt` | Find how often data is released |
| C16 | Last Refresh Date | `worker_last_refresh.txt` | Find the most recent refresh date |
| C17 | Next Expected Refresh Date | `worker_next_refresh.txt` | Determine or estimate next refresh |

**Total: 1 Scraper + 20 Workers + 2 Output Agents = 23 Agents**

---

## 4. Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Agent Framework | **Agno** (`agno`) | Build and orchestrate agents |
| LLM (Scraping) | **Groq Compound** (`groq/compound`) | Web scraping with browser capabilities |
| LLM (Workers) | **Groq Compound** (`groq/compound`) | Metadata extraction & generation |
| Web UI | **Streamlit** | User interface |
| Word Docs | **python-docx** | Generate .docx import documents |
| Croissant | **mlcroissant** | Validate generated Croissant JSON-LD |
| HTTP Client | **groq** (Python SDK) | API calls to Groq |
| Environment | **python-dotenv** | API key management |

---

## 5. Detailed Implementation

### 5.1 Configuration (`config.py`)

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
PROMPTS_DIR = BASE_DIR / "prompts"
CHECKLIST_DIR = BASE_DIR / "checklist"
DATA_RAW_DIR = BASE_DIR / "data" / "raw"
DATA_OUTPUT_DIR = BASE_DIR / "data" / "output"
TEMPLATES_DIR = BASE_DIR / "templates"
SCHEMAS_DIR = BASE_DIR / "schemas"

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Model Config
SCRAPER_MODEL = "groq/compound"
WORKER_MODEL = "groq/compound"
OUTPUT_MODEL = "groq/compound"

# Create directories
for d in [DATA_RAW_DIR, DATA_OUTPUT_DIR]:
    d.mkdir(parents=True, exist_ok=True)
```

### 5.2 Prompt Loader (`utils/prompt_loader.py`)

```python
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
```

### 5.3 Checklist Parser (`utils/file_utils.py`)

The checklist is a simple text file where each line is one item. Lines starting with `#` are comments.

**Expected checklist format (`checklist/checklist.txt`):**
```
# Data Analysis Checklist
# Format: id | prompt_file | description
# Each line = one isolated agent with ONE job

# ── A. Initial Data Source Assessment ──
A1  | worker_core_attributes.txt     | Core Attributes Present? (Place, Period, Variable, Values)
A2  | worker_data_vertical.txt       | Data Vertical (Level 1) Identified? (e.g., Education, Health)
A3  | worker_geo_level.txt           | Geo Level Identified? (Country, AA1, AA2)
A4  | worker_license_check.txt       | License is Public & Permissible? (e.g., CC BY 4.0)
A5  | worker_license_url.txt         | License URL Documented?

# ── B. Source Format & Acquisition Plan ──
B6   | worker_parent_url.txt          | Parent/Provenance URL (page where the report belongs)
B6.1 | worker_child_urls.txt          | Child Source URL(s) (direct download links)
B7   | worker_source_format.txt       | Source Format Identified? (CSV, API, XLS)
B8   | worker_programmatic_access.txt | Programmatic Access Feasible? (Yes/No)
B9   | worker_rate_limits.txt         | Rate Limits Noted? (Yes/No)
B10  | worker_sample_url.txt          | Sample Source URL Provided?
B10.1| worker_metadata_urls.txt       | Document URLs for metadata
B11  | worker_download_steps.txt      | Download Steps Documented?

# ── C. Data Availability & Periodicity ──
C12   | worker_min_date.txt            | Min Date
C13   | worker_max_date.txt            | Max Date
C14   | worker_periodicity.txt         | Periodicity of Data (Annually, Monthly, etc.)
C14.1 | worker_date_resolution.txt     | Date Resolution (ISO format YYYY-MM-DD)
C14.2 | worker_place_resolution.txt    | Place Resolution & Place Types (Code vs Text)
C15   | worker_refresh_frequency.txt   | Refresh/Release Frequency
C16   | worker_last_refresh.txt        | Last Refresh Date in Source
C17   | worker_next_refresh.txt        | Next Expected Refresh Date
```

**Parser:**
```python
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
```

### 5.4 Scraper Agent (`agents/scraper_agent.py`)

This agent uses Groq Compound to visit the URL and extract all content. Groq Compound has built-in browser capabilities so it handles JS-rendered pages natively.

```python
from agno.agent import Agent
from agno.models.groq import Groq
from utils.prompt_loader import load_prompt
from config import DATA_RAW_DIR, GROQ_API_KEY
import json
from pathlib import Path


def create_scraper_agent() -> Agent:
    """Create the scraper agent using Groq Compound."""
    prompt = load_prompt("scraper.txt")

    agent = Agent(
        name="Scraper Agent",
        model=Groq(id="groq/compound", api_key=GROQ_API_KEY),
        description=prompt,
        instructions=[
            "Visit the given URL and extract ALL content from the page.",
            "Include: page title, all text content, tables, metadata, links, headers.",
            "Structure the output as a comprehensive JSON with clear sections.",
            "If the page has multiple tabs or sections, extract from all of them.",
            "Do NOT summarize — extract raw, complete content.",
        ],
        markdown=False,
    )
    return agent


def run_scraper(url: str, description: str = "") -> dict:
    """
    Run the scraper agent on the given URL.
    Returns the scraped data dict and saves to filesystem.
    """
    agent = create_scraper_agent()

    user_message = f"URL: {url}"
    if description:
        user_message += f"\nAdditional context: {description}"
    user_message += "\n\nVisit this URL and extract ALL content comprehensively."

    response = agent.run(user_message)
    content = response.content

    # Save raw scraped data
    safe_name = url.replace("https://", "").replace("http://", "").replace("/", "_")[:50]
    raw_file = DATA_RAW_DIR / f"{safe_name}.txt"
    raw_file.write_text(content, encoding="utf-8")

    return {
        "url": url,
        "description": description,
        "raw_content": content,
        "raw_file_path": str(raw_file),
    }
```

### 5.5 Worker Agent Factory (`agents/worker_agent.py`)

Each worker agent is created dynamically based on the checklist item and its prompt file.

```python
from agno.agent import Agent
from agno.models.groq import Groq
from utils.prompt_loader import load_prompt
from config import GROQ_API_KEY


def create_worker_agent(name: str, prompt_file: str) -> Agent:
    """Create a worker agent from a checklist item."""
    prompt = load_prompt(prompt_file)

    agent = Agent(
        name=f"Worker: {name}",
        model=Groq(id="groq/compound", api_key=GROQ_API_KEY),
        description=f"You are a metadata extraction specialist for: {name}",
        instructions=[prompt],
        markdown=False,
    )
    return agent


def run_worker(name: str, prompt_file: str, scraped_data: str) -> dict:
    """
    Run a single worker agent on the scraped data.
    Returns {"name": ..., "result": ...}
    """
    agent = create_worker_agent(name, prompt_file)

    user_message = (
        f"Here is the scraped content from a dataset page. "
        f"Extract the information as described in your instructions.\n\n"
        f"--- SCRAPED CONTENT ---\n{scraped_data}\n--- END CONTENT ---"
    )

    response = agent.run(user_message)
    return {
        "name": name,
        "result": response.content,
    }
```

### 5.6 Import Document Agent (`agents/import_doc_agent.py`)

Takes all worker outputs and generates a Word document.

```python
from agno.agent import Agent
from agno.models.groq import Groq
from utils.prompt_loader import load_prompt
from utils.docx_generator import generate_docx
from config import GROQ_API_KEY, DATA_OUTPUT_DIR
import json


def create_import_doc_agent() -> Agent:
    """Create the import document generation agent."""
    prompt = load_prompt("import_document.txt")

    agent = Agent(
        name="Import Document Agent",
        model=Groq(id="groq/compound", api_key=GROQ_API_KEY),
        description="You generate structured import documents from extracted metadata.",
        instructions=[prompt],
        markdown=False,
    )
    return agent


def run_import_doc_agent(url: str, worker_results: list[dict]) -> str:
    """
    Compile all worker results into a structured import document.
    Returns path to the generated .docx file.
    """
    agent = create_import_doc_agent()

    # Format worker results for the agent
    compiled = f"Dataset URL: {url}\n\n"
    for wr in worker_results:
        compiled += f"=== {wr['name'].upper()} ===\n{wr['result']}\n\n"

    user_message = (
        f"Using the following extracted metadata, generate a structured import document.\n"
        f"Output the document content as structured JSON with sections and values.\n\n"
        f"{compiled}"
    )

    response = agent.run(user_message)

    # Parse agent output and generate .docx
    output_path = DATA_OUTPUT_DIR / "import_document.docx"
    generate_docx(response.content, output_path)

    return str(output_path)
```

### 5.7 Croissant Agent (`agents/croissant_agent.py`)

Takes all worker outputs and generates Croissant JSON-LD.

```python
from agno.agent import Agent
from agno.models.groq import Groq
from utils.prompt_loader import load_prompt
from config import GROQ_API_KEY, DATA_OUTPUT_DIR, SCHEMAS_DIR
import json


def create_croissant_agent() -> Agent:
    """Create the Croissant metadata generation agent."""
    prompt = load_prompt("croissant.txt")

    # Load the Croissant example schema for reference
    example_schema = ""
    example_file = SCHEMAS_DIR / "croissant_example.json"
    if example_file.exists():
        example_schema = example_file.read_text()

    agent = Agent(
        name="Croissant Agent",
        model=Groq(id="groq/compound", api_key=GROQ_API_KEY),
        description="You generate Croissant JSON-LD metadata files for ML datasets.",
        instructions=[prompt],
        additional_context=f"Reference Croissant schema example:\n{example_schema}",
        markdown=False,
    )
    return agent


def run_croissant_agent(url: str, worker_results: list[dict]) -> str:
    """
    Compile all worker results into Croissant JSON-LD format.
    Returns path to the generated .json file.
    """
    agent = create_croissant_agent()

    compiled = f"Dataset URL: {url}\n\n"
    for wr in worker_results:
        compiled += f"=== {wr['name'].upper()} ===\n{wr['result']}\n\n"

    user_message = (
        f"Using the following extracted metadata, generate a valid Croissant JSON-LD file.\n"
        f"Output ONLY valid JSON — no markdown fences, no explanation.\n\n"
        f"{compiled}"
    )

    response = agent.run(user_message)

    # Parse and save
    output_path = DATA_OUTPUT_DIR / "croissant_metadata.json"
    try:
        parsed = json.loads(response.content)
        output_path.write_text(json.dumps(parsed, indent=2))
    except json.JSONDecodeError:
        # If the agent output isn't valid JSON, save raw and flag it
        output_path.write_text(response.content)

    return str(output_path)
```

### 5.8 Word Document Generator (`utils/docx_generator.py`)

```python
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pathlib import Path
import json


def generate_docx(agent_output: str, output_path: Path) -> None:
    """
    Generate a Word document from the agent's structured output.
    Tries to parse as JSON first; falls back to plain text sections.
    """
    doc = Document()

    # Title
    title = doc.add_heading("Dataset Import Document", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    try:
        data = json.loads(agent_output)
        _build_from_json(doc, data)
    except (json.JSONDecodeError, TypeError):
        _build_from_text(doc, agent_output)

    doc.save(str(output_path))


def _build_from_json(doc: Document, data: dict) -> None:
    """Build document sections from structured JSON."""
    for section_name, section_content in data.items():
        doc.add_heading(section_name.replace("_", " ").title(), level=1)

        if isinstance(section_content, dict):
            table = doc.add_table(rows=1, cols=2, style="Light Grid Accent 1")
            table.rows[0].cells[0].text = "Field"
            table.rows[0].cells[1].text = "Value"
            for key, value in section_content.items():
                row = table.add_row()
                row.cells[0].text = str(key)
                row.cells[1].text = str(value)
        elif isinstance(section_content, list):
            for item in section_content:
                doc.add_paragraph(str(item), style="List Bullet")
        else:
            doc.add_paragraph(str(section_content))

        doc.add_paragraph()  # Spacer


def _build_from_text(doc: Document, text: str) -> None:
    """Build document from plain text, splitting on section markers."""
    sections = text.split("===")
    for section in sections:
        section = section.strip()
        if not section:
            continue
        lines = section.split("\n", 1)
        if len(lines) == 2:
            doc.add_heading(lines[0].strip(), level=1)
            doc.add_paragraph(lines[1].strip())
        else:
            doc.add_paragraph(section)
```

### 5.9 Orchestrator (`orchestrator.py`)

The central pipeline that coordinates all agents.

```python
import json
from pathlib import Path
from utils.file_utils import parse_checklist
from agents.scraper_agent import run_scraper
from agents.worker_agent import run_worker
from agents.import_doc_agent import run_import_doc_agent
from agents.croissant_agent import run_croissant_agent
from config import DATA_OUTPUT_DIR


def run_pipeline(url: str, description: str = "") -> dict:
    """
    Execute the full metadata extraction pipeline.

    Steps:
        1. Scrape the URL using the Scraper Agent
        2. Parse the checklist to determine worker agents
        3. Run each worker agent on the scraped data
        4. Run the Import Document Agent
        5. Run the Croissant Agent
        6. Return all results

    Returns:
        {
            "url": str,
            "scraped_data_path": str,
            "worker_results": [{"name": str, "result": str}, ...],
            "import_doc_path": str,
            "croissant_path": str,
        }
    """
    results = {"url": url}

    # ── Step 1: Scrape ──
    print("[Pipeline] Step 1/5: Scraping URL...")
    scraped = run_scraper(url, description)
    results["scraped_data_path"] = scraped["raw_file_path"]

    # ── Step 2: Parse Checklist ──
    print("[Pipeline] Step 2/5: Parsing checklist...")
    checklist_items = parse_checklist()

    # ── Step 3: Run 20 Worker Agents (one task each, sequential) ──
    print(f"[Pipeline] Step 3/5: Running {len(checklist_items)} worker agents (1 task per agent)...")
    worker_results = []
    for i, item in enumerate(checklist_items, 1):
        print(f"  [{i}/{len(checklist_items)}] Running worker: {item['name']} — {item['description']}...")
        wr = run_worker(
            name=item["name"],
            prompt_file=item["prompt_file"],
            scraped_data=scraped["raw_content"],
        )
        worker_results.append(wr)

    results["worker_results"] = worker_results

    # ── Step 4: Import Document Agent ──
    print("[Pipeline] Step 4/5: Generating import document...")
    import_doc_path = run_import_doc_agent(url, worker_results)
    results["import_doc_path"] = import_doc_path

    # ── Step 5: Croissant Agent ──
    print("[Pipeline] Step 5/5: Generating Croissant metadata...")
    croissant_path = run_croissant_agent(url, worker_results)
    results["croissant_path"] = croissant_path

    # Save summary
    summary_path = DATA_OUTPUT_DIR / "pipeline_summary.json"
    summary_path.write_text(json.dumps(results, indent=2, default=str))

    print("[Pipeline] Complete!")
    return results
```

### 5.10 Streamlit App (`app.py`)

```python
import streamlit as st
from orchestrator import run_pipeline
from pathlib import Path

st.set_page_config(page_title="Dataset Metadata Extractor", layout="wide")
st.title("Dataset Metadata Extractor")
st.markdown("Extract metadata from any public dataset URL and generate import documents & Croissant metadata.")

# ── Input Section ──
with st.form("input_form"):
    url = st.text_input(
        "Dataset URL",
        placeholder="https://example.com/dataset-page",
        help="Enter the URL of a public dataset page",
    )
    description = st.text_area(
        "Description (optional)",
        placeholder="Describe specific data you need from this URL...",
        help="Optional: guide the extraction with additional context",
        height=100,
    )
    submitted = st.form_submit_button("Fetch Metadata", type="primary", use_container_width=True)

# ── Processing ──
if submitted:
    if not url:
        st.error("Please enter a URL.")
    else:
        with st.spinner("Running extraction pipeline... This may take a few minutes."):
            try:
                results = run_pipeline(url, description)
                st.session_state["results"] = results
                st.success("Pipeline completed!")
            except Exception as e:
                st.error(f"Pipeline failed: {str(e)}")

# ── Results Display ──
if "results" in st.session_state:
    results = st.session_state["results"]

    # Show extracted metadata
    st.header("Extracted Metadata")
    for wr in results["worker_results"]:
        with st.expander(f"**{wr['name'].replace('_', ' ').title()}**", expanded=False):
            st.markdown(wr["result"])

    # Download buttons
    st.header("Downloads")
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Import Document")
        docx_path = Path(results["import_doc_path"])
        if docx_path.exists():
            with open(docx_path, "rb") as f:
                st.download_button(
                    label="Download Import Document (.docx)",
                    data=f.read(),
                    file_name="import_document.docx",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    use_container_width=True,
                )

    with col2:
        st.subheader("Croissant Metadata")
        json_path = Path(results["croissant_path"])
        if json_path.exists():
            with open(json_path, "rb") as f:
                st.download_button(
                    label="Download Croissant Metadata (.json)",
                    data=f.read(),
                    file_name="croissant_metadata.json",
                    mime="application/json",
                    use_container_width=True,
                )
```

---

## 6. Prompt Files — Content Guidelines

Each prompt file in `/prompts/` controls what its agent does. Below are the templates.

### 6.1 `prompts/scraper.txt`

```
You are a web scraping agent. Your job is to visit the given URL and extract
ALL content from the page comprehensively.

Extract:
- Page title and meta description
- All headings and their hierarchy
- All text content (paragraphs, lists, descriptions)
- All tables with their headers and data
- All links and their anchor text
- Any metadata tags, structured data, or JSON-LD present
- File download links and their formats
- API endpoints if mentioned
- Any sidebar or footer content with relevant info

Output the extracted content as structured, clearly labeled sections.
Do NOT summarize or filter — extract everything raw.
```

### 6.2 Worker Prompt Files — All 20 Agents

Each agent has ONE job. If the information is not found, it must say "Not found" — never guess.

---

#### Section A: Initial Data Source Assessment

**`prompts/worker_core_attributes.txt`** (A1)
```
You are a core attributes identification agent. You have ONE job.

Given scraped content from a dataset page, determine whether these four
core attributes are present in the data:

1. Place — Does the data contain geographic/location information?
   (e.g., country names, state codes, city names, coordinates)
2. Period — Does the data contain time/date information?
   (e.g., year, month, date range, timestamp)
3. Variable — Does the data contain named measured variables?
   (e.g., "population", "GDP", "enrollment rate", "temperature")
4. Values — Does the data contain actual data values for those variables?
   (e.g., numeric counts, percentages, amounts)

For each attribute, answer:
- Present: Yes / No / Unclear
- Evidence: Quote or describe exactly where you see it in the content
- Example: Give one concrete example from the data

Output format:
Place: [Yes/No/Unclear] | Evidence: [...] | Example: [...]
Period: [Yes/No/Unclear] | Evidence: [...] | Example: [...]
Variable: [Yes/No/Unclear] | Evidence: [...] | Example: [...]
Values: [Yes/No/Unclear] | Evidence: [...] | Example: [...]

Do NOT look for anything else. Do NOT summarize the dataset. Only answer the above.
```

**`prompts/worker_data_vertical.txt`** (A2)
```
You are a data vertical classification agent. You have ONE job.

Given scraped content from a dataset page, identify the Level 1 data vertical
(domain/sector) that this dataset belongs to.

Common verticals:
- Education (schools, enrollment, test scores, literacy)
- Health (disease, mortality, hospitals, vaccination)
- Economy (GDP, employment, trade, inflation)
- Demographics (population, census, migration, age)
- Environment (climate, emissions, land use, water)
- Agriculture (crops, livestock, food production)
- Infrastructure (roads, electricity, internet, housing)
- Governance (elections, corruption, budgets, laws)
- Crime & Justice (crime rates, prisons, courts)
- Energy (oil, gas, renewables, consumption)
- Transportation (traffic, aviation, shipping)
- Other (specify)

Output format:
Data Vertical: [vertical name]
Confidence: [High/Medium/Low]
Evidence: [Quote or describe what in the content points to this vertical]

If the dataset spans multiple verticals, list the PRIMARY one first, then
secondary ones. Do NOT analyze anything else.
```

**`prompts/worker_geo_level.txt`** (A3)
```
You are a geographic level identification agent. You have ONE job.

Given scraped content from a dataset page, identify the geographic level
of the data.

Geographic levels (from broadest to narrowest):
- Global (multiple countries)
- Country (e.g., "US National", "India National")
- AA1 / Admin Area 1 (e.g., US States, Indian States, UK Countries)
- AA2 / Admin Area 2 (e.g., US Counties, Indian Districts)
- AA3 / Admin Area 3 (e.g., cities, municipalities, sub-districts)
- Point-level (specific coordinates, addresses)

Output format:
Geo Level: [Global / Country / AA1 / AA2 / AA3 / Point-level]
Specific Scope: [e.g., "US National", "California state-level", "All Indian Districts"]
Evidence: [Quote or describe what in the content shows this]

If multiple geographic levels exist in the dataset, list all of them.
Do NOT analyze anything else.
```

**`prompts/worker_license_check.txt`** (A4)
```
You are a license verification agent. You have ONE job.

Given scraped content from a dataset page, determine if the license is
public and permissible for reuse.

Check for:
1. Is a license explicitly stated? (Yes/No)
2. License name if found (e.g., CC BY 4.0, MIT, ODbL, Public Domain)
3. Is it a public/open license? (Yes/No/Unclear)
4. Does it permit redistribution? (Yes/No/Unclear)
5. Does it permit commercial use? (Yes/No/Unclear)
6. Are there attribution requirements? (Yes/No/Unclear)

Output format:
License Stated: [Yes/No]
License Name: [name or "Not found"]
Public & Permissible: [Yes/No/Unclear]
Redistribution Allowed: [Yes/No/Unclear]
Commercial Use: [Yes/No/Unclear]
Attribution Required: [Yes/No/Unclear]
Evidence: [Quote exactly where license info appears]

If no license is found anywhere on the page, state "License: Not found" and
note any terms of use or disclaimers you see instead. Do NOT guess a license.
```

**`prompts/worker_license_url.txt`** (A5)
```
You are a license URL extraction agent. You have ONE job.

Given scraped content from a dataset page, find the URL that links to the
full license text.

Look for:
1. Direct link to a license page (e.g., creativecommons.org/licenses/...)
2. Link labeled "License", "Terms of Use", "Data Use Agreement"
3. Any href/URL in the content that points to license documentation

Output format:
License URL: [full URL or "Not found"]
Link Text: [the anchor text of the link, if available]
Location: [where on the page this link appears]

Output ONLY the URL finding. Do NOT analyze the license terms.
Do NOT generate or guess a URL. Only report URLs actually present in the content.
```

---

#### Section B: Source Format & Acquisition Plan

**`prompts/worker_parent_url.txt`** (B6)
```
You are a provenance URL identification agent. You have ONE job.

Given scraped content from a dataset page, identify the Parent/Provenance URL —
this is the specific page where the dataset report or landing page lives.
It may be the page itself, or it may reference a parent page.

Look for:
1. The canonical URL of the dataset landing page
2. A "source" or "origin" link pointing to where this data comes from
3. A parent organization's page that hosts this dataset
4. Breadcrumb navigation showing the page hierarchy

Output format:
Parent/Provenance URL: [URL or "Same as input URL"]
Organization: [name of the hosting organization]
Evidence: [how you determined this]

Do NOT look for download links (that's a different agent's job).
```

**`prompts/worker_child_urls.txt`** (B6.1)
```
You are a download URL extraction agent. You have ONE job.

Given scraped content from a dataset page, find ALL direct download links
(child source URLs) for the actual data files.

Look for:
1. Direct download links (.csv, .xls, .xlsx, .json, .zip, .parquet, etc.)
2. "Download" buttons and their target URLs
3. API endpoints that return data
4. FTP links
5. Cloud storage links (S3, GCS, Azure Blob)

Output format (list ALL found):
Child URL 1: [URL] | Format: [file type] | Description: [what this file contains]
Child URL 2: [URL] | Format: [file type] | Description: [what this file contains]
...

If no direct download links are found, state "No direct download URLs found"
and describe how data appears to be accessible instead.
Do NOT generate or guess URLs. Only report URLs present in the content.
```

**`prompts/worker_source_format.txt`** (B7)
```
You are a source format identification agent. You have ONE job.

Given scraped content from a dataset page, identify the format(s) in which
the data is available.

Common formats: CSV, TSV, XLS, XLSX, JSON, XML, Parquet, API (REST/GraphQL),
PDF, HTML tables, SQLite, Shapefile, GeoJSON, NetCDF, HDF5

Output format:
Primary Format: [format name]
Additional Formats: [comma-separated list, or "None"]
Evidence: [quote or describe where format info appears]

Report ONLY what is stated or clearly evident. Do NOT guess.
```

**`prompts/worker_programmatic_access.txt`** (B8)
```
You are a programmatic access assessment agent. You have ONE job.

Given scraped content from a dataset page, determine whether the data can
be accessed programmatically (via API, direct URL download, package, etc.).

Check for:
1. REST API endpoint documented?
2. GraphQL endpoint?
3. Direct file download URL that can be used in scripts?
4. Python/R package for accessing the data?
5. Database connection strings?
6. Web scraping as only option?

Output format:
Programmatic Access: [Yes/No/Partial]
Method: [API / Direct Download / Package / Scraping Required / Other]
Details: [specific endpoint, package name, or explanation]
Evidence: [quote from content]

Do NOT test any endpoints. Only report what is documented on the page.
```

**`prompts/worker_rate_limits.txt`** (B9)
```
You are a rate limit detection agent. You have ONE job.

Given scraped content from a dataset page, find any mentioned rate limits,
usage quotas, or throttling policies.

Look for:
1. API rate limits (requests per second/minute/hour/day)
2. Download bandwidth limits
3. Query limits
4. Account-based quotas
5. Terms of service mentioning usage limits
6. Fair use policies

Output format:
Rate Limits Noted: [Yes/No]
Details: [specific limits, or "No rate limit information found"]
Evidence: [quote from content]

Do NOT assume rate limits exist if not mentioned.
```

**`prompts/worker_sample_url.txt`** (B10)
```
You are a sample data URL extraction agent. You have ONE job.

Given scraped content from a dataset page, find a URL where a sample or
preview of the data can be viewed or downloaded.

Look for:
1. "Preview" or "Sample" links
2. Data preview tables shown on the page
3. "View first N rows" links
4. Sample file download links
5. Data explorer or viewer URLs

Output format:
Sample URL: [URL or "Not found"]
Sample Type: [Preview table on page / Downloadable sample file / Data explorer / Other]
Evidence: [how you found this]

Do NOT generate URLs. Only report what exists in the content.
```

**`prompts/worker_metadata_urls.txt`** (B10.1)
```
You are a metadata documentation URL extraction agent. You have ONE job.

Given scraped content from a dataset page, find URLs that link to metadata
documentation, data dictionaries, codebooks, or schema descriptions.

Look for:
1. "Documentation" links
2. "Data Dictionary" or "Codebook" links
3. "Schema" or "Metadata" links
4. README file links
5. Technical specification documents
6. API documentation pages
7. "About this dataset" links

Output format (list ALL found):
Metadata URL 1: [URL] | Type: [Data Dictionary / Schema / README / API Docs / Other]
Metadata URL 2: [URL] | Type: [...]
...

If none found, state "No metadata documentation URLs found."
Do NOT generate URLs.
```

**`prompts/worker_download_steps.txt`** (B11)
```
You are a download procedure documentation agent. You have ONE job.

Given scraped content from a dataset page, document the exact steps a user
would need to follow to download this data.

Describe:
1. Does it require registration/login? (Yes/No)
2. Does it require agreeing to terms? (Yes/No)
3. Is it a direct download link or multi-step process?
4. Are there file selection options (choose format, date range, etc.)?
5. Step-by-step instructions to get from the page to having the data file

Output format:
Registration Required: [Yes/No/Unclear]
Terms Agreement Required: [Yes/No/Unclear]
Download Type: [Direct link / Multi-step / API call / Form submission]
Steps:
1. [step 1]
2. [step 2]
...

Base this ONLY on what the page content shows. Do NOT visit links.
```

---

#### Section C: Data Availability & Periodicity

**`prompts/worker_min_date.txt`** (C12)
```
You are a minimum date extraction agent. You have ONE job.

Given scraped content from a dataset page, find the EARLIEST date (minimum
date) that the data covers.

Look for:
1. Explicit "start date", "from", "beginning" mentions
2. Date ranges stated (e.g., "2010-2023" → min is 2010)
3. "Data available from..." statements
4. The earliest year/date mentioned in data descriptions
5. Time series start points

Output format:
Min Date: [date in ISO format YYYY-MM-DD, or YYYY-MM, or YYYY if only year is known]
Precision: [Year / Month / Day]
Evidence: [exact quote from content]

If no date information is found, state "Min Date: Not found".
Do NOT guess or infer dates.
```

**`prompts/worker_max_date.txt`** (C13)
```
You are a maximum date extraction agent. You have ONE job.

Given scraped content from a dataset page, find the LATEST date (maximum
date) that the data covers.

Look for:
1. Explicit "end date", "to", "through", "up to" mentions
2. Date ranges stated (e.g., "2010-2023" → max is 2023)
3. "Most recent data..." statements
4. The latest year/date mentioned in data descriptions
5. "Current" or "present" if used with a reference date

Output format:
Max Date: [date in ISO format YYYY-MM-DD, or YYYY-MM, or YYYY if only year is known]
Precision: [Year / Month / Day]
Evidence: [exact quote from content]

If no date information is found, state "Max Date: Not found".
Do NOT guess or infer dates.
```

**`prompts/worker_periodicity.txt`** (C14)
```
You are a data periodicity identification agent. You have ONE job.

Given scraped content from a dataset page, determine how frequently the
data points are recorded (the granularity of the time dimension).

Common periodicities:
- Real-time / Streaming
- Hourly
- Daily
- Weekly
- Monthly
- Quarterly
- Semi-annually
- Annually
- Decennial (every 10 years, e.g., census)
- One-time / Snapshot
- Irregular

Output format:
Periodicity: [frequency from list above, or custom]
Evidence: [exact quote or description from content]

If periodicity cannot be determined, state "Periodicity: Not determined".
Do NOT confuse periodicity (how often data points occur) with refresh
frequency (how often the dataset is updated). They are different.
```

**`prompts/worker_date_resolution.txt`** (C14.1)
```
You are a date resolution identification agent. You have ONE job.

Given scraped content from a dataset page, determine the date format and
resolution used in the data.

Check for:
1. What date format is used? (ISO YYYY-MM-DD, MM/DD/YYYY, YYYY, etc.)
2. What is the finest time resolution? (year, month, day, hour, minute)
3. Are dates stored as strings, timestamps, or date objects?
4. Is timezone information included?

Output format:
Date Format: [observed format, e.g., "YYYY-MM-DD" or "YYYY" or "MM/DD/YYYY"]
Resolution: [Year / Month / Day / Hour / Minute]
ISO Compliant: [Yes / No / Partially]
Evidence: [example dates found in content]

Do NOT look for anything else.
```

**`prompts/worker_place_resolution.txt`** (C14.2)
```
You are a place resolution identification agent. You have ONE job.

Given scraped content from a dataset page, determine how geographic places
are represented in the data.

Check for:
1. Are places represented as codes or text?
   - Codes: FIPS codes, ISO 3166, GeoIDs, postal codes, NUTS codes
   - Text: Full names ("California"), abbreviations ("CA")
2. What is the place resolution?
   - Country level, State/Province, County/District, City, Zip/Postal, Point
3. What coding system is used (if codes)?

Output format:
Place Type: [Code / Text / Both]
Coding System: [FIPS / ISO 3166 / GeoID / Postal / Custom / None / "Not found"]
Resolution: [Country / State / County / City / Zip / Point]
Examples: [list 2-3 example place values from the content]
Evidence: [quote from content]

Do NOT analyze anything else.
```

**`prompts/worker_refresh_frequency.txt`** (C15)
```
You are a refresh/release frequency extraction agent. You have ONE job.

Given scraped content from a dataset page, determine how often the DATASET
ITSELF is updated or re-released by the publisher.

This is different from periodicity (data granularity). For example:
- A dataset of annual GDP figures (periodicity=annual) might be refreshed
  monthly as new estimates come in (refresh=monthly).

Look for:
1. "Updated every [period]"
2. "Released [frequency]"
3. "Published [frequency]"
4. Version history showing release pattern
5. Changelog or update log

Output format:
Refresh Frequency: [Daily / Weekly / Monthly / Quarterly / Annually / Irregular / One-time / Not found]
Evidence: [quote from content]

If not stated, say "Not found". Do NOT confuse with data periodicity.
```

**`prompts/worker_last_refresh.txt`** (C16)
```
You are a last refresh date extraction agent. You have ONE job.

Given scraped content from a dataset page, find the date when the dataset
was most recently updated or refreshed by the publisher.

Look for:
1. "Last updated: [date]"
2. "Modified: [date]"
3. "Latest release: [date]"
4. Version history showing most recent entry
5. Timestamp on the page
6. "As of [date]"

Output format:
Last Refresh Date: [date in ISO format YYYY-MM-DD, or "Not found"]
Evidence: [exact quote from content]

Report only explicitly stated dates. Do NOT use the current date as a guess.
```

**`prompts/worker_next_refresh.txt`** (C17)
```
You are a next expected refresh date extraction agent. You have ONE job.

Given scraped content from a dataset page, determine when the next update
or refresh of the dataset is expected.

Look for:
1. "Next update: [date]"
2. "Expected release: [date]"
3. A stated schedule that implies the next date
4. Release calendar links
5. Any forward-looking statements about updates

Output format:
Next Expected Refresh: [date in ISO format YYYY-MM-DD, or estimated period, or "Not found"]
Basis: [Explicitly stated / Inferred from schedule / Not determinable]
Evidence: [quote from content]

If no information exists, state "Not found". Do NOT calculate or guess dates
unless a clear schedule is stated (e.g., "updated every January" → next January).
```

### 6.3 `prompts/import_document.txt`

```
You are an import document generator. You receive the output from 20 metadata
extraction agents, each answering one specific checklist question about a dataset.

Compile ALL 20 agent outputs into a structured JSON that will populate a Word document.
Structure your output following the exact checklist sections:

{
    "dataset_url": "...",
    "section_a_source_assessment": {
        "A1_core_attributes": {
            "place": "...",
            "period": "...",
            "variable": "...",
            "values": "..."
        },
        "A2_data_vertical": "...",
        "A3_geo_level": "...",
        "A4_license_public_permissible": "...",
        "A5_license_url": "..."
    },
    "section_b_format_acquisition": {
        "B6_parent_url": "...",
        "B6_1_child_urls": ["..."],
        "B7_source_format": "...",
        "B8_programmatic_access": "...",
        "B9_rate_limits": "...",
        "B10_sample_url": "...",
        "B10_1_metadata_urls": ["..."],
        "B11_download_steps": "..."
    },
    "section_c_availability_periodicity": {
        "C12_min_date": "...",
        "C13_max_date": "...",
        "C14_periodicity": "...",
        "C14_1_date_resolution": "...",
        "C14_2_place_resolution": "...",
        "C15_refresh_frequency": "...",
        "C16_last_refresh_date": "...",
        "C17_next_refresh_date": "..."
    }
}

Rules:
- Use ONLY the information from the 20 agent outputs. Do NOT add anything.
- If an agent said "Not found", keep "Not found" in that field.
- Do NOT rephrase or embellish. Use the agent's exact findings.
- Output ONLY valid JSON. No markdown fences, no explanation text.
```

### 6.4 `prompts/croissant.txt`

```
You are a Croissant metadata generation specialist. Generate a valid Croissant
JSON-LD metadata file following the MLCommons Croissant 1.0 specification.

The output must be a valid JSON-LD document with:

1. @context: "https://schema.org/" and Croissant namespace
2. @type: "sc:Dataset"
3. Required properties:
   - name: Dataset name
   - url: Dataset URL
   - description: Dataset description
   - license: License URL or name
   - datePublished: Publication date
   - dateModified: Last modification date
4. Distribution (sc:FileObject or sc:FileSet):
   - contentUrl: Download URL
   - encodingFormat: MIME type
   - sha256: if available
5. RecordSet:
   - name: Record set name
   - field: Array of Field objects with:
     - name: Field name
     - dataType: sc:Integer, sc:Float, sc:Text, sc:Boolean, sc:Date, etc.
     - description: Field description
     - source: Reference to FileObject/FileSet

Follow this structure:
{
    "@context": {
        "@vocab": "https://schema.org/",
        "sc": "https://schema.org/",
        "ml": "http://mlcommons.org/schema/",
        "cr": "http://mlcommons.org/croissant/"
    },
    "@type": "sc:Dataset",
    "name": "...",
    "description": "...",
    "url": "...",
    "license": "...",
    "datePublished": "...",
    "dateModified": "...",
    "distribution": [...],
    "recordSet": [...]
}

Use ONLY the extracted metadata provided. Output ONLY valid JSON-LD.
```

---

## 7. Croissant Reference Schema

Save this in `schemas/croissant_example.json` for the Croissant Agent to reference:

```json
{
    "@context": {
        "@vocab": "https://schema.org/",
        "sc": "https://schema.org/",
        "cr": "http://mlcommons.org/croissant/",
        "ml": "http://mlcommons.org/schema/"
    },
    "@type": "sc:Dataset",
    "name": "Titanic",
    "description": "The original Titanic dataset, describing the status of individual passengers on the Titanic.",
    "url": "https://www.openml.org/d/40945",
    "license": "afl-3.0",
    "version": "1.0.0",
    "datePublished": "2023-07-01",
    "dateModified": "2023-07-01",
    "distribution": [
        {
            "@type": "cr:FileObject",
            "name": "passengers.csv",
            "contentUrl": "https://www.openml.org/data/get_csv/16826755/phpMYEkMl",
            "encodingFormat": "text/csv",
            "contentSize": "117743 B"
        }
    ],
    "recordSet": [
        {
            "@type": "cr:RecordSet",
            "name": "passengers",
            "description": "Passenger records from the Titanic.",
            "field": [
                {
                    "@type": "cr:Field",
                    "name": "name",
                    "description": "Name of the passenger",
                    "dataType": "sc:Text",
                    "source": {
                        "fileObject": "passengers.csv",
                        "column": "name"
                    }
                },
                {
                    "@type": "cr:Field",
                    "name": "survived",
                    "description": "Whether the passenger survived",
                    "dataType": "sc:Boolean",
                    "source": {
                        "fileObject": "passengers.csv",
                        "column": "survived"
                    }
                }
            ]
        }
    ]
}
```

---

## 8. Dependencies (`requirements.txt`)

```
agno>=0.1.0
groq>=0.4.0
streamlit>=1.30.0
python-docx>=1.0.0
mlcroissant>=1.0.0
python-dotenv>=1.0.0
```

---

## 9. Environment Setup (`.env`)

```
GROQ_API_KEY=your_groq_api_key_here
```

---

## 10. Setup & Run Instructions

```bash
# 1. Clone / navigate to the project
cd Agent-A-DC

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# 5. Prepare checklist and template files
# - Edit checklist/checklist.txt with your metadata items
# - Place your Word template in templates/import_template.docx (optional)

# 6. Run the Streamlit app
streamlit run app.py
```

---

## 11. How the Flow Works (Step-by-Step)

```
1. User opens Streamlit app in browser
2. User enters a URL + optional description
3. User clicks "Fetch Metadata"
4. Orchestrator starts:
   │
   ├─ Step 1: Scraper Agent (Groq Compound w/ browser)
   │   └─ Visits URL, extracts ALL page content
   │   └─ Saves raw content to data/raw/
   │
   ├─ Step 2: Parse checklist.txt → 20 items
   │   └─ Each line maps to one agent + one prompt file
   │
   ├─ Step 3: Run 20 Worker Agents sequentially (one task each)
   │   │
   │   ├─ Section A: Source Assessment (5 agents)
   │   │   ├─ A1  Core Attributes     → reads raw → finds Place/Period/Variable/Values
   │   │   ├─ A2  Data Vertical       → reads raw → classifies domain (Education, Health, etc.)
   │   │   ├─ A3  Geo Level           → reads raw → identifies Country/AA1/AA2
   │   │   ├─ A4  License Check       → reads raw → determines if public & permissible
   │   │   └─ A5  License URL         → reads raw → finds license URL
   │   │
   │   ├─ Section B: Format & Acquisition (8 agents)
   │   │   ├─ B6   Parent URL         → reads raw → finds provenance page
   │   │   ├─ B6.1 Child URLs         → reads raw → finds download links
   │   │   ├─ B7   Source Format      → reads raw → identifies CSV/API/XLS
   │   │   ├─ B8   Programmatic Access→ reads raw → checks API availability
   │   │   ├─ B9   Rate Limits        → reads raw → finds throttling info
   │   │   ├─ B10  Sample URL         → reads raw → finds preview/sample link
   │   │   ├─ B10.1 Metadata URLs     → reads raw → finds documentation links
   │   │   └─ B11  Download Steps     → reads raw → documents download procedure
   │   │
   │   └─ Section C: Availability & Periodicity (7 agents)
   │       ├─ C12   Min Date          → reads raw → finds earliest date
   │       ├─ C13   Max Date          → reads raw → finds latest date
   │       ├─ C14   Periodicity       → reads raw → determines Annual/Monthly/etc.
   │       ├─ C14.1 Date Resolution   → reads raw → finds date format (ISO)
   │       ├─ C14.2 Place Resolution  → reads raw → identifies code vs text
   │       ├─ C15   Refresh Frequency → reads raw → finds release schedule
   │       ├─ C16   Last Refresh      → reads raw → finds last update date
   │       └─ C17   Next Refresh      → reads raw → finds next expected update
   │
   ├─ Step 4: Import Document Agent
   │   └─ Receives ALL 20 worker outputs
   │   └─ Generates structured JSON → python-docx → .docx file
   │
   └─ Step 5: Croissant Agent
       └─ Receives ALL 20 worker outputs
       └─ Generates Croissant JSON-LD → .json file
   │
5. Streamlit displays:
   - 20 expandable sections showing each agent's findings
   - Download button for Import Document (.docx)
   - Download button for Croissant Metadata (.json)
```

---

## 12. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Groq Compound for scraping** | Built-in browser handles JS-rendered pages without needing Selenium/Playwright |
| **Separate prompt files** | Non-technical users can edit agent behavior without touching code |
| **Checklist-driven workers** | Adding/removing metadata fields = editing a text file, not code |
| **1 agent = 1 task (20 workers)** | Prevents hallucination — an agent asked to do 2-3 things will cut corners or fabricate. Isolation ensures accuracy. |
| **Sequential workers** | Avoids Groq rate limits; can be parallelized later if needed |
| **JSON intermediate format** | Clean handoff between worker agents and output agents |
| **python-docx for Word** | Mature library, no external dependencies, full formatting control |
| **Agno framework** | Clean agent abstraction, supports Groq models, built-in team/workflow patterns |

---

## 13. Future Enhancements (Out of Scope for v1)

- **Parallel worker execution** — Run workers concurrently with `asyncio` + `agent.arun()`
- **Caching** — Cache scraped data to avoid re-scraping the same URL
- **Validation** — Use `mlcroissant` library to validate generated Croissant files
- **Template support** — Allow users to upload custom .docx templates
- **Batch processing** — Process multiple URLs in one run
- **History** — Store past extractions in SQLite for comparison
- **Progress bar** — Show real-time progress in Streamlit as each agent completes

---

## 14. Pending Items (Need from User)

| Item | Status | Notes |
|------|--------|-------|
| Checklist file (`checklist.txt`) | **Waiting** | User to provide the actual checklist |
| Import document template (`.docx`) | **Waiting** | User to provide the Word template |
| Test URL(s) | **Waiting** | User to provide URLs for end-to-end testing |
| Groq API key | **Confirmed** | User has it ready |

---

## 15. Important Notes on Groq Compound

- **Model ID**: `groq/compound` (multi-tool) or `groq/compound-mini` (single-tool, 3x faster)
- **Built-in tools**: Web Search, Visit Website, Browser Automation, Code Execution, Wolfram Alpha
- **Custom tools NOT supported**: Groq Compound does not accept user-defined tools — it only uses its built-in tools
- **Implication**: The scraper agent relies entirely on Groq Compound's built-in browser to visit URLs. Worker agents and output agents use Groq Compound for its LLM capabilities (the web browsing is not needed for those — they process text already scraped)
- **Alternative for workers**: If cost/latency is a concern, workers can use `groq/compound-mini` or even a standard model like `llama-3.3-70b-versatile` since they don't need browser capabilities
