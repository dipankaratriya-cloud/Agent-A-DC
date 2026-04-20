"""
FastAPI backend for DC Metadata Extractor.
Wraps the existing LangGraph pipeline and exposes REST + SSE endpoints.
"""

import json
import os
import re
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

# Add project root to path so we can import existing modules
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(dotenv_path=PROJECT_ROOT / '.env', override=True)

from config import get_groq_api_key, DATA_OUTPUT_DIR
from graph import build_graph

app = FastAPI(title="DC Metadata Extractor API", version="1.0.0")

# CORS: allow localhost for dev + any extra origins from env + *.vercel.app
_default_origins = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:8179", "http://127.0.0.1:8179",
]
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins + _extra_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store
jobs: dict = {}
executor = ThreadPoolExecutor(max_workers=2)


@app.get("/")
def root():
    return {"message": "DC Metadata Extractor API", "docs": "/docs", "health": "/api/health"}


# ─── Models ───

class ExtractRequest(BaseModel):
    source_name: str
    description: str = ""

class ResolveURLRequest(BaseModel):
    source_name: str

class SearchVariablesRequest(BaseModel):
    query: str


class ValidationRule(BaseModel):
    rule_id: str
    validator: str
    scope: dict = {}
    params: dict = {}


class ValidationConfigRequest(BaseModel):
    job_id: Optional[str] = None
    schema_version: str = "1.0"
    rules: list[ValidationRule]


# ─── Country DCIDs (same as app.py) ───

COUNTRY_DCIDS = {
    "united states": "country/USA", "usa": "country/USA", "us": "country/USA",
    "america": "country/USA", "canada": "country/CAN", "france": "country/FRA",
    "french": "country/FRA", "norway": "country/NOR", "norwegian": "country/NOR",
    "united kingdom": "country/GBR", "uk": "country/GBR",
    "great britain": "country/GBR", "england": "country/GBR",
    "germany": "country/DEU", "german": "country/DEU",
    "spain": "country/ESP", "spanish": "country/ESP",
    "italy": "country/ITA", "italian": "country/ITA",
    "japan": "country/JPN", "japanese": "country/JPN",
    "china": "country/CHN", "chinese": "country/CHN",
    "india": "country/IND", "indian": "country/IND",
    "australia": "country/AUS", "australian": "country/AUS",
    "brazil": "country/BRA", "brazilian": "country/BRA",
    "mexico": "country/MEX", "mexican": "country/MEX",
    "russia": "country/RUS", "russian": "country/RUS",
    "south korea": "country/KOR", "korea": "country/KOR",
    "netherlands": "country/NLD", "dutch": "country/NLD",
    "sweden": "country/SWE", "swedish": "country/SWE",
    "switzerland": "country/CHE", "swiss": "country/CHE",
    "belgium": "country/BEL", "austria": "country/AUT",
    "poland": "country/POL", "denmark": "country/DNK",
    "finland": "country/FIN", "ireland": "country/IRL",
    "portugal": "country/PRT", "greece": "country/GRC",
    "new zealand": "country/NZL", "singapore": "country/SGP",
    "south africa": "country/ZAF", "argentina": "country/ARG",
    "chile": "country/CHL", "colombia": "country/COL",
    "peru": "country/PER", "indonesia": "country/IDN",
    "malaysia": "country/MYS", "thailand": "country/THA",
    "vietnam": "country/VNM", "philippines": "country/PHL",
    "egypt": "country/EGY", "nigeria": "country/NGA",
    "kenya": "country/KEN", "israel": "country/ISR",
    "saudi arabia": "country/SAU", "turkey": "country/TUR",
    "ukraine": "country/UKR",
}


def get_country_dcids(text: str) -> list:
    if not text:
        return []
    text_lower = text.lower()
    found, seen = [], set()
    for name, dcid in COUNTRY_DCIDS.items():
        if name in text_lower and dcid not in seen:
            found.append({"name": name.title(), "dcid": dcid})
            seen.add(dcid)
    return found


def resolve_url(source_name: str, api_key: str) -> str:
    if source_name.startswith(('http://', 'https://')):
        return source_name
    from agents.groq_client import GroqCompoundClient
    client = GroqCompoundClient(api_key=api_key)
    result = client.query(
        f"Search the web and find the official data portal or dataset catalog URL for: {source_name}\n"
        f"You MUST use web_search to find the actual URL. Then return ONLY the URL.",
        max_retries=3,
    )
    content = result.get("content", "").strip()
    urls = re.findall(r'https?://[^\s<>"\')\]\},]+', content)
    if urls:
        return urls[0]
    return f"https://www.google.com/search?q={source_name.replace(' ', '+')}"


def run_pipeline_job(job_id: str, source_name: str, description: str):
    """Run the pipeline in a background thread and update job state."""
    job = jobs[job_id]
    try:
        api_key = get_groq_api_key()
        if not api_key:
            job["status"] = "error"
            job["error"] = "No GROQ_API_KEY configured"
            return

        # Step 1: Resolve URL
        job["progress"] = {"step": 1, "total": 4, "message": "Resolving URL..."}
        url = resolve_url(source_name, api_key)
        job["url"] = url

        # Step 2-4: Run LangGraph pipeline
        job["progress"] = {"step": 2, "total": 4, "message": "Running scraper (browser automation)..."}

        graph = build_graph()
        result = graph.invoke({
            "url": url,
            "source_name": source_name,
            "description": description,
            "worker_results": [],
            "token_usage": {"prompt": 0, "completion": 0, "total": 0},
        })

        # Read file bytes for download
        import_path = result.get("import_doc_path")
        croissant_path = result.get("croissant_path")

        job["status"] = "completed"
        job["results"] = {
            "url": url,
            "source_name": source_name,
            "scraped_data": result.get("scraped_data", {}),
            "scraped_data_path": result.get("scraped_data_path", ""),
            "worker_results": result.get("worker_results", []),
            "clean_data": result.get("clean_data", {}),
            "import_doc_path": import_path,
            "croissant_path": croissant_path,
            "token_usage": result.get("token_usage", {}),
            "country_dcids": get_country_dcids(
                json.dumps(result.get("scraped_data", {}).get("geographic", {}))
            ),
        }
        job["progress"] = {"step": 4, "total": 4, "message": "Pipeline complete!"}

        # Save output.json for downstream validation framework
        output_dir = DATA_OUTPUT_DIR / job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "output.json"
        output_path.write_text(json.dumps(job["results"], indent=2, default=str))
        job["results"]["output_json_path"] = str(output_path)

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


# ─── Endpoints ───

@app.get("/api/health")
def health():
    api_key = get_groq_api_key()
    return {"status": "ok", "api_key_configured": bool(api_key)}


@app.post("/api/extract")
def start_extraction(req: ExtractRequest):
    api_key = get_groq_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="No GROQ_API_KEY configured")

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "id": job_id,
        "status": "running",
        "source_name": req.source_name,
        "description": req.description,
        "url": None,
        "progress": {"step": 0, "total": 4, "message": "Starting..."},
        "results": None,
        "error": None,
        "started_at": datetime.now().isoformat(),
    }

    executor.submit(run_pipeline_job, job_id, req.source_name, req.description)
    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job["id"],
        "status": job["status"],
        "url": job.get("url"),
        "progress": job["progress"],
        "error": job.get("error"),
    }


@app.get("/api/results/{job_id}")
def get_results(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Job status: {job['status']}")
    return job["results"]


@app.get("/api/stream/{job_id}")
def stream_status(job_id: str):
    """SSE endpoint for real-time progress updates."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    def event_stream():
        last_step = -1
        while True:
            current = jobs.get(job_id)
            if not current:
                break

            step = current["progress"].get("step", 0)
            if step != last_step or current["status"] in ("completed", "error"):
                data = json.dumps({
                    "status": current["status"],
                    "progress": current["progress"],
                    "url": current.get("url"),
                    "error": current.get("error"),
                })
                yield f"data: {data}\n\n"
                last_step = step

            if current["status"] in ("completed", "error"):
                break
            time.sleep(1)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/download/{job_id}/{file_type}")
def download_file(job_id: str, file_type: str):
    job = jobs.get(job_id)
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Job not found or not completed")

    results = job["results"]

    if file_type == "docx":
        path = results.get("import_doc_path")
        if path and Path(path).exists():
            return FileResponse(path, filename="import_document.docx",
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    elif file_type == "croissant":
        path = results.get("croissant_path")
        if path and Path(path).exists():
            return FileResponse(path, filename="croissant_metadata.json",
                media_type="application/json")

    elif file_type == "raw":
        export = {
            "url": results.get("url"),
            "timestamp": datetime.now().isoformat(),
            "scraped_data": results.get("scraped_data", {}),
            "checklist_results": {
                wr["name"]: wr["result"]
                for wr in results.get("worker_results", [])
            },
        }
        return StreamingResponse(
            iter([json.dumps(export, indent=2, default=str)]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=metadata_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"},
        )

    raise HTTPException(status_code=404, detail=f"File not available: {file_type}")


@app.post("/api/resolve-url")
def resolve_url_endpoint(req: ResolveURLRequest):
    api_key = get_groq_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="No GROQ_API_KEY configured")
    url = resolve_url(req.source_name, api_key)
    return {"url": url}


@app.post("/api/search-variables")
def search_variables(req: SearchVariablesRequest):
    import requests as http_requests

    api_key = os.getenv("DC_API_KEY")
    headers = {"X-API-Key": api_key} if api_key else {}

    try:
        query_clean = req.query.strip().title().replace(" ", "")
        patterns = [
            f"Count_{query_clean}", f"Count_Person_{query_clean}",
            f"Area_{query_clean}", f"Amount_{query_clean}",
            f"Percent_{query_clean}", f"Number_{query_clean}",
        ]

        sparql_dcids = []
        try:
            resp = http_requests.get(
                "https://api.datacommons.org/v2/sparql",
                headers=headers,
                params={
                    "query": f'SELECT DISTINCT ?dcid WHERE {{ ?dcid typeOf StatisticalVariable . FILTER(CONTAINS(LCASE(STR(?dcid)), "{req.query.lower()}")) }} LIMIT 20'
                },
                timeout=15,
            )
            if resp.status_code == 200:
                for row in resp.json().get("rows", []):
                    cells = row.get("cells", [])
                    if cells:
                        sparql_dcids.append(cells[0].get("value", ""))
        except Exception:
            pass

        all_dcids = list(set(patterns + sparql_dcids))
        results = []

        for i in range(0, len(all_dcids), 10):
            batch = all_dcids[i:i + 10]
            props_resp = http_requests.post(
                "https://api.datacommons.org/v2/node",
                headers=headers,
                json={"nodes": batch, "property": "->*"},
                timeout=15,
            )
            if props_resp.status_code == 200:
                for dcid, info in props_resp.json().get("data", {}).items():
                    arcs = info.get("arcs", {})
                    if arcs:
                        props = {}
                        for k, v in arcs.items():
                            vals = [n.get("value") or n.get("dcid") for n in v.get("nodes", [])]
                            if vals:
                                props[k] = vals
                        if props:
                            results.append({
                                "dcid": dcid,
                                "properties": props,
                                "url": f"https://datacommons.org/browser/{dcid}",
                            })

        if results:
            return {"success": True, "results": results}
        return {"success": False, "error": f"No variables found for '{req.query}'"}

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/output/{job_id}")
def download_output(job_id: str):
    """Download the output.json for a completed job."""
    path = DATA_OUTPUT_DIR / job_id / "output.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="output.json not found for this job")
    return FileResponse(path, filename="output.json", media_type="application/json")


@app.post("/api/validation-config")
def save_validation_config(req: ValidationConfigRequest):
    """Save a validation_config.json file and, if a job_id is provided,
    regenerate that job's import_document.docx with a Validation Rules
    section appended at the bottom."""
    rules = [r.model_dump() for r in req.rules]
    # Clean up empty scope objects from rules
    for rule in rules:
        if not rule.get("scope"):
            rule.pop("scope", None)
        if not rule.get("params"):
            rule.pop("params", None)

    config = {"schema_version": req.schema_version, "rules": rules}

    if req.job_id:
        out_dir = DATA_OUTPUT_DIR / req.job_id
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / "validation_config.json"
    else:
        path = DATA_OUTPUT_DIR / "validation_config.json"

    path.write_text(json.dumps(config, indent=2))

    # Regenerate the import doc with validation rules appended, if we have the job context.
    if req.job_id:
        job = jobs.get(req.job_id)
        if job and job.get("status") == "completed":
            results = job.get("results", {})
            import_path = results.get("import_doc_path")
            if import_path:
                try:
                    from utils.docx_generator import generate_import_docx
                    generate_import_docx(
                        results.get("source_name", "") or results.get("url", ""),
                        results.get("url", ""),
                        results.get("worker_results", []),
                        results.get("clean_data", {}),
                        Path(import_path),
                        validation_rules=rules,
                    )
                except Exception:
                    # Non-fatal: still return the validation_config.json.
                    pass

    return FileResponse(path, filename="validation_config.json", media_type="application/json")


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8321"))
    uvicorn.run(app, host=host, port=port)
