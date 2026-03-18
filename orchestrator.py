"""
Pipeline orchestrator — thin wrapper around the LangGraph graph.
Scraper (1 browser visit) → 20 Workers (text-only) → Output Agents
"""
import json
from graph import build_graph
from config import DATA_OUTPUT_DIR


def run_pipeline(url: str, source_name: str = "", description: str = "", progress_callback=None) -> dict:
    """
    Execute the full metadata extraction pipeline via LangGraph.

    Args:
        url: The dataset URL to analyze
        description: Optional user description for context
        progress_callback: Optional callable(step, total, message) for UI updates
    """
    def report(step, total, msg):
        print(f"  [{step}/{total}] {msg}")
        if progress_callback:
            progress_callback(step, total, msg)

    report(0, 4, "Starting LangGraph pipeline...")

    graph = build_graph()

    # Invoke the graph
    result = graph.invoke({
        "url": url,
        "source_name": source_name or url,
        "description": description,
        "worker_results": [],
    })

    # Build output dict matching what app.py expects
    output = {
        "url": url,
        "scraped_data": result.get("scraped_data", {}),
        "scraped_data_path": result.get("scraped_data_path", ""),
        "worker_results": result.get("worker_results", []),
        "import_doc_path": result.get("import_doc_path"),
        "croissant_path": result.get("croissant_path"),
        "success": True,
    }

    # Save summary
    summary_path = DATA_OUTPUT_DIR / "pipeline_summary.json"
    summary_path.write_text(json.dumps(output, indent=2, default=str))

    report(4, 4, "Pipeline complete!")
    return output
