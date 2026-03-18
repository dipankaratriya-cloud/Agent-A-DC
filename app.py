#!/usr/bin/env python3
"""Dataset Metadata Extractor — Streamlit app using LangGraph pipeline.

Flow: Scraper (1 browser visit) → 20 Workers (text-only) → Output Agents
"""

import streamlit as st
import os
import json
import re
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# ─── Country DCIDs ───
COUNTRY_DCIDS = {
    "united states": "country/USA", "usa": "country/USA", "us": "country/USA", "america": "country/USA",
    "canada": "country/CAN", "france": "country/FRA", "french": "country/FRA",
    "norway": "country/NOR", "norwegian": "country/NOR", "united kingdom": "country/GBR",
    "uk": "country/GBR", "great britain": "country/GBR", "england": "country/GBR",
    "germany": "country/DEU", "german": "country/DEU", "spain": "country/ESP", "spanish": "country/ESP",
    "italy": "country/ITA", "italian": "country/ITA", "japan": "country/JPN", "japanese": "country/JPN",
    "china": "country/CHN", "chinese": "country/CHN", "india": "country/IND", "indian": "country/IND",
    "australia": "country/AUS", "australian": "country/AUS", "brazil": "country/BRA", "brazilian": "country/BRA",
    "mexico": "country/MEX", "mexican": "country/MEX", "russia": "country/RUS", "russian": "country/RUS",
    "south korea": "country/KOR", "korea": "country/KOR", "netherlands": "country/NLD", "dutch": "country/NLD",
    "sweden": "country/SWE", "swedish": "country/SWE", "switzerland": "country/CHE", "swiss": "country/CHE",
    "belgium": "country/BEL", "austria": "country/AUT", "poland": "country/POL", "denmark": "country/DNK",
    "finland": "country/FIN", "ireland": "country/IRL", "portugal": "country/PRT", "greece": "country/GRC",
    "new zealand": "country/NZL", "singapore": "country/SGP", "south africa": "country/ZAF",
    "argentina": "country/ARG", "chile": "country/CHL", "colombia": "country/COL", "peru": "country/PER",
    "indonesia": "country/IDN", "malaysia": "country/MYS", "thailand": "country/THA", "vietnam": "country/VNM",
    "philippines": "country/PHL", "egypt": "country/EGY", "nigeria": "country/NGA", "kenya": "country/KEN",
    "israel": "country/ISR", "saudi arabia": "country/SAU", "turkey": "country/TUR", "ukraine": "country/UKR",
}


def get_country_dcids(text: str) -> list:
    if not text:
        return []
    text_lower = text.lower()
    found, seen = [], set()
    for name, dcid in COUNTRY_DCIDS.items():
        if name in text_lower and dcid not in seen:
            found.append((name.title(), dcid))
            seen.add(dcid)
    return found


def extract_urls(text: str) -> list:
    if not text:
        return []
    return list(set(re.findall(r'https?://[^\s<>"\')\]\},]+', text)))


def extract_dataset_links(content: str) -> list:
    if not content:
        return []
    from urllib.parse import urlparse, unquote
    links, seen = [], set()

    for match in re.finditer(r'\|\s*([^|]+)\s*\|\s*(https?://[^\s|]+)\s*\|\s*([^|]*)\s*\|', content):
        name, url, desc = match.groups()
        url = url.strip().rstrip('.,;:!?')
        if url not in seen:
            seen.add(url)
            links.append({'url': url, 'domain': urlparse(url).netloc, 'title': name.strip(), 'description': desc.strip(), 'category': 'Dataset'})

    for match in re.finditer(r'\[([^\]]+)\]\((https?://[^)]+)\)', content):
        title, url = match.groups()
        url = url.strip().rstrip('.,;:!?')
        if url not in seen:
            seen.add(url)
            cat = 'Dataset'
            if any(k in url.lower() for k in ['license', 'terms', 'legal']): cat = 'License/Terms'
            elif any(k in url.lower() for k in ['doc', 'guide', 'help', 'api']): cat = 'Documentation'
            links.append({'url': url, 'domain': urlparse(url).netloc, 'title': title.strip(), 'description': '', 'category': cat})

    for match in re.finditer(r'(?<!\()(https?://[^\s<>"\')\]\}|]+)', content):
        url = match.group(1).rstrip('.,;:!?')
        if url in seen: continue
        seen.add(url)
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split('/') if p]
        title = unquote(path_parts[-1]).replace('-', ' ').replace('_', ' ').title()[:50] if path_parts else parsed.netloc
        cat = 'Other'
        if any(k in url.lower() for k in ['license', 'terms', 'legal']): cat = 'License/Terms'
        elif any(k in url.lower() for k in ['dataset', 'data', 'table', 'download', 'csv']): cat = 'Dataset'
        elif any(k in url.lower() for k in ['doc', 'guide', 'help']): cat = 'Documentation'
        links.append({'url': url, 'domain': parsed.netloc, 'title': title, 'description': '', 'category': cat})
    return links


# ─── LangGraph Pipeline Runner ───

def run_langgraph_pipeline(url: str, source_name: str, description: str, progress_bar, status_container) -> dict:
    """
    Run the LangGraph pipeline: Scraper → Workers → Import Doc → Croissant.
    """
    from graph import build_graph

    status_container.info("Step 1/4: Scraping dataset page (browser automation)...")
    progress_bar.progress(0.05)

    graph = build_graph()

    # LangGraph invoke — runs all nodes sequentially
    result = graph.invoke({
        "url": url,
        "source_name": source_name,
        "description": description,
        "worker_results": [],
        "token_usage": {"prompt": 0, "completion": 0, "total": 0},
    })

    progress_bar.progress(1.0)

    return {
        "url": url,
        "scraped_data": result.get("scraped_data", {}),
        "scraped_data_path": result.get("scraped_data_path", ""),
        "worker_results": result.get("worker_results", []),
        "import_doc_path": result.get("import_doc_path"),
        "croissant_path": result.get("croissant_path"),
        "token_usage": result.get("token_usage", {}),
        "success": True,
    }


# ─── URL Resolution ───

def resolve_url(source_name: str, api_key: str) -> str:
    """If source_name is already a URL, return it. Otherwise use Groq to find the URL."""
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
    # Extract URL from response
    urls = re.findall(r'https?://[^\s<>"\')\]\},]+', content)
    if urls:
        return urls[0]

    # Fallback: construct a reasonable search URL and let the scraper handle it
    # The scraper has browser_automation and can navigate from a search-based prompt
    return f"https://www.google.com/search?q={source_name.replace(' ', '+')}"


# ─── Unified Display ───

def display_results(results: dict):
    """Display all results in one unified structured view."""
    url = results["url"]
    scraped_data = results.get("scraped_data", {})
    worker_results = results.get("worker_results", [])

    def get_worker(prefix):
        for wr in worker_results:
            if wr["name"] == prefix:
                return wr
        return None

    # ─── Tabs ───
    tab_overview, tab_datasets, tab_checklist, tab_links, tab_scraped, tab_downloads = st.tabs([
        "Overview", "Datasets", "Checklist Results", "Dataset Links", "Scraped Data", "Downloads"
    ])

    # ═══ TAB: Overview ═══
    with tab_overview:
        if scraped_data:
            page_meta = scraped_data.get("page_metadata", {})
            title = page_meta.get('title', 'Unknown Dataset') if page_meta else 'Unknown Dataset'
            org = page_meta.get('organization', 'N/A') if page_meta else 'N/A'
            page_url = page_meta.get('url', url) if page_meta else url

            # Dataset info card
            st.markdown(f"""
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1.5rem; margin-bottom:1.25rem; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <p style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8 !important; font-weight:600; margin:0 0 0.5rem;">Dataset Information</p>
                <h3 style="margin:0 0 0.5rem; font-size:1.3rem; color:#0f172a !important;">{title}</h3>
                <div style="display:flex; gap:2rem; flex-wrap:wrap;">
                    <div><span style="font-size:0.75rem; color:#94a3b8 !important;">Organization</span><br/><span style="font-weight:600; font-size:0.9rem;">{org}</span></div>
                    <div><span style="font-size:0.75rem; color:#94a3b8 !important;">URL</span><br/><a href="{page_url}" style="font-size:0.85rem;" target="_blank">{page_url[:60]}{'...' if len(page_url)>60 else ''}</a></div>
                </div>
            </div>
            """, unsafe_allow_html=True)

            # Section status cards
            sections_to_check = [
                ("License", "license", "&#128274;"),
                ("Core Attributes", "core_attributes", "&#128203;"),
                ("Data Vertical", "data_vertical", "&#128200;"),
                ("Geographic", "geographic", "&#127758;"),
                ("Temporal", "temporal", "&#128197;"),
                ("Source URLs", "source_urls", "&#128279;"),
                ("Format & Access", "format_access", "&#128451;"),
                ("Refresh Info", "refresh_info", "&#128260;"),
            ]

            cols = st.columns(4)
            for i, (label, key, icon) in enumerate(sections_to_check):
                section = scraped_data.get(key, {})
                found = section.get("found", False) if isinstance(section, dict) else False
                bg = "#ecfdf5" if found else "#fef3c7"
                border = "#bbf7d0" if found else "#fde68a"
                status_text = "Found" if found else "Missing"
                status_color = "#166534" if found else "#92400e"
                with cols[i % 4]:
                    st.markdown(f"""
                    <div style="background:{bg}; border:1px solid {border}; border-radius:0.75rem; padding:0.75rem 1rem; margin-bottom:0.5rem; text-align:center;">
                        <div style="font-size:1.3rem; margin-bottom:0.15rem;">{icon}</div>
                        <div style="font-weight:600; font-size:0.85rem; color:#1e293b !important;">{label}</div>
                        <div style="font-size:0.7rem; color:{status_color} !important; font-weight:600;">{status_text}</div>
                    </div>
                    """, unsafe_allow_html=True)

            # Country DCIDs
            geo_data = scraped_data.get("geographic", {})
            if isinstance(geo_data, dict):
                coverage = geo_data.get("coverage", "")
                country_dcids = get_country_dcids(coverage)
                if country_dcids:
                    st.markdown("""
                    <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1rem 1.25rem; margin-top:0.75rem;">
                        <p style="font-weight:600; font-size:0.9rem; margin:0 0 0.5rem;">Data Commons DCIDs</p>
                    </div>
                    """, unsafe_allow_html=True)
                    for name, dcid in country_dcids:
                        st.markdown(f"- **{name}**: `{dcid}`")
        else:
            st.info("No scraped data available")

    # ═══ TAB: Checklist Results ═══
    with tab_checklist:
        if not worker_results:
            st.info("No checklist results")
            return

        # Summary metrics
        total = len(worker_results)
        found = sum(1 for wr in worker_results if wr.get("success") and not any(
            p in wr.get("result", "").lower() for p in ["not found", "not available", "could not find"]))
        pct = int((found / total * 100) if total else 0)

        mc1, mc2, mc3, mc4 = st.columns(4)
        mc1.metric("Total Items", total)
        mc2.metric("Found", found)
        mc3.metric("Missing", total - found)
        mc4.metric("Coverage", f"{pct}%")

        # Visual progress bar for coverage
        bar_color = "#22c55e" if pct >= 70 else "#f59e0b" if pct >= 40 else "#ef4444"
        st.markdown(f"""
        <div style="background:#f1f5f9; border-radius:1rem; height:8px; margin:0.5rem 0 1.5rem; overflow:hidden;">
            <div style="background:{bar_color}; height:100%; width:{pct}%; border-radius:1rem; transition: width 0.5s ease;"></div>
        </div>
        """, unsafe_allow_html=True)

        sections = [
            ("A", "A. Initial Data Source Assessment", [
                ("A1", "Core Attributes Present?", "Place, Period, Variable, Values"),
                ("A2", "Data Vertical Identified?", "e.g., Education, Health"),
                ("A3", "Geo Level Identified?", "Country, AA1, AA2"),
                ("A4", "License Public & Permissible?", "e.g., CC BY 4.0"),
                ("A5", "License URL Documented?", ""),
            ]),
            ("B", "B. Source Format & Acquisition Plan", [
                ("B6", "Parent/Provenance URL", ""),
                ("B6.1", "Child Source URL(s)", "Direct download links"),
                ("B7", "Source Format", "CSV, API, XLS"),
                ("B8", "Programmatic Access?", "Yes/No"),
                ("B9", "Rate Limits?", "Yes/No"),
                ("B10", "Sample Source URL", ""),
                ("B10.1", "Metadata Documentation URLs", ""),
                ("B11", "Download Steps", ""),
            ]),
            ("C", "C. Data Availability & Periodicity", [
                ("C12", "Min Date", ""),
                ("C13", "Max Date", ""),
                ("C14", "Periodicity", "Annually, Monthly, etc."),
                ("C14.1", "Date Resolution", "ISO YYYY-MM-DD"),
                ("C14.2", "Place Resolution", "Code vs Text"),
                ("C15", "Refresh Frequency", ""),
                ("C16", "Last Refresh Date", ""),
                ("C17", "Next Expected Refresh", ""),
            ]),
        ]

        for prefix, section_title, items in sections:
            section_workers = [wr for wr in worker_results if wr["name"].startswith(prefix)]
            section_found = sum(1 for wr in section_workers if wr.get("success") and not any(
                p in wr.get("result", "").lower() for p in ["not found", "not available"]))

            sec_pct = int((section_found / len(section_workers) * 100) if section_workers else 0)
            st.markdown(f"""
            <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-left: 4px solid #4f46e5; padding: 0.75rem 1.25rem; margin: 1.5rem 0 0.75rem 0; border-radius: 0 0.75rem 0.75rem 0; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight: 700; font-size: 1.05rem; color: #1e293b !important;">{section_title}</span>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <div style="background:#e2e8f0; border-radius:1rem; height:6px; width:60px; overflow:hidden;">
                        <div style="background:#4f46e5; height:100%; width:{sec_pct}%; border-radius:1rem;"></div>
                    </div>
                    <span style="background: linear-gradient(135deg,#4f46e5,#7c3aed); color: white; padding: 0.15rem 0.65rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600;">{section_found}/{len(section_workers)}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)

            for item_id, item_label, item_hint in items:
                wr = get_worker(item_id)
                if not wr:
                    continue

                result_text = wr.get("result", "").strip()
                urls_found = extract_urls(result_text)

                is_not_found = any(p in result_text.lower() for p in ["not found", "not available", "could not find", "unable to"])
                if not result_text or len(result_text) < 10:
                    badge = '<span style="background: linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:0.15rem 0.55rem;border-radius:1rem;font-size:0.65rem;font-weight:600;letter-spacing:0.02em;">NO DATA</span>'
                    border_color = "#fca5a5"
                    card_bg = "#fff5f5"
                elif is_not_found:
                    badge = '<span style="background: linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:0.15rem 0.55rem;border-radius:1rem;font-size:0.65rem;font-weight:600;letter-spacing:0.02em;">PARTIAL</span>'
                    border_color = "#fde68a"
                    card_bg = "#fffbeb"
                else:
                    badge = '<span style="background: linear-gradient(135deg,#22c55e,#16a34a);color:white;padding:0.15rem 0.55rem;border-radius:1rem;font-size:0.65rem;font-weight:600;letter-spacing:0.02em;">FOUND</span>'
                    border_color = "#bbf7d0"
                    card_bg = "#f0fdf4"

                hint_text = f' <span style="color:#94a3b8;font-size:0.78rem;">({item_hint})</span>' if item_hint else ""

                preview = ""
                for line in result_text.split("\n"):
                    line = line.strip().lstrip("-•* ")
                    if ":" in line and len(line) < 250:
                        key, val = line.split(":", 1)
                        key_l = key.strip().lower()
                        if val.strip() and key_l not in ["evidence", "basis", "output format", "output", "note", "steps", "url to visit"]:
                            preview = val.strip()[:200]
                            break
                    elif line and not line.startswith("#") and not line.startswith("You ") and len(line) > 10:
                        preview = line[:200]
                        break
                if not preview:
                    preview = result_text[:200] if result_text else "—"

                st.markdown(f"""
                <div style="border: 1px solid {border_color}; border-left: 3px solid {border_color}; border-radius: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; background: {card_bg}; transition: box-shadow 0.2s;">
                    <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                        <div style="min-width: 2.75rem; font-weight: 700; color: #4f46e5; font-size: 0.85rem; background:#eef2ff; padding:0.25rem 0.4rem; border-radius:0.375rem; text-align:center;">{item_id}</div>
                        <div style="flex: 1;">
                            <div style="margin-bottom: 0.3rem;">
                                {badge} <span style="font-weight: 600; color: #1e293b; font-size: 0.9rem; margin-left:0.25rem;">{item_label}</span>{hint_text}
                            </div>
                            <div style="color: #475569; font-size: 0.85rem; line-height: 1.5; background: rgba(255,255,255,0.7); padding: 0.4rem 0.6rem; border-radius: 0.5rem; border: 1px solid rgba(0,0,0,0.04);">{preview}</div>
                        </div>
                    </div>
                </div>
                """, unsafe_allow_html=True)

                if urls_found:
                    url_html = " ".join(
                        f'<a href="{u}" target="_blank" style="display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;padding:0.2rem 0.6rem;border-radius:1rem;font-size:0.7rem;color:#4f46e5;text-decoration:none;margin:0.15rem 0.2rem 0 0;font-weight:500;transition:background 0.2s;">{re.sub(r"^https?://(www\\.)?", "", u).split("/")[0]}</a>'
                        for u in urls_found[:5]
                    )
                    st.markdown(f'<div style="padding-left: 4rem; margin-bottom: 0.4rem;">{url_html}</div>', unsafe_allow_html=True)

                with st.expander(f"Full output — {item_id}", expanded=False):
                    st.markdown(result_text)

        # Downloads inline
        st.markdown("---")
        st.markdown("""
        <div style="margin-bottom:0.75rem;">
            <p style="font-weight:700; font-size:1.1rem; color:#1e293b !important; margin:0;">Download Generated Documents</p>
            <p style="font-size:0.8rem; color:#94a3b8 !important; margin:0.15rem 0 0;">Export your extracted metadata in various formats</p>
        </div>
        """, unsafe_allow_html=True)
        dl1, dl2, dl3 = st.columns(3)

        with dl1:
            docx_bytes = results.get("import_doc_bytes")
            if docx_bytes:
                st.download_button("Download Import Document (.docx)", data=docx_bytes,
                    file_name="import_document.docx", key="dl_docx_checklist",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    use_container_width=True)
            else:
                st.warning("Import doc not generated")

        with dl2:
            croissant_bytes = results.get("croissant_bytes")
            if croissant_bytes:
                st.download_button("Download Croissant (.json)", data=croissant_bytes,
                    file_name="croissant_metadata.json", key="dl_croissant_checklist",
                    mime="application/json", use_container_width=True)
            else:
                st.warning("Croissant not generated")

        with dl3:
            export = {
                "url": url, "timestamp": datetime.now().isoformat(),
                "scraped_data": scraped_data,
                "checklist_results": {wr["name"]: wr["result"] for wr in worker_results},
            }
            st.download_button("Download Raw JSON", data=json.dumps(export, indent=2, default=str),
                file_name=f"metadata_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                key="dl_json_checklist", mime="application/json", use_container_width=True)

    # ═══ TAB: Datasets ═══
    with tab_datasets:
        st.markdown("""
        <div style="margin-bottom:1rem;">
            <h3 style="margin:0; font-size:1.15rem;">Available Datasets</h3>
            <p style="font-size:0.8rem; color:#94a3b8 !important; margin:0.15rem 0 0;">Discovered downloadable datasets and access methods</p>
        </div>
        """, unsafe_allow_html=True)
        d1_worker = get_worker("D1")
        datasets = []
        if d1_worker:
            raw = d1_worker.get("result", "").strip()
            try:
                cleaned = raw
                if "```json" in cleaned:
                    cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
                elif "```" in cleaned:
                    cleaned = cleaned.split("```", 1)[1].split("```", 1)[0]
                datasets = json.loads(cleaned.strip())
                if not isinstance(datasets, list):
                    datasets = []
            except (json.JSONDecodeError, IndexError):
                datasets = []

        if datasets:
            st.success(f"Found {len(datasets)} dataset(s)")
            for i, ds in enumerate(datasets):
                name = ds.get("name", f"Dataset {i+1}")
                ds_url = ds.get("url", "")
                fmt = ds.get("format", "Unknown")
                downloadable = ds.get("downloadable", False)
                steps = ds.get("download_steps", "")

                border = "#bbf7d0" if downloadable else "#fde68a"
                card_bg = "#f0fdf4" if downloadable else "#fffbeb"
                badge = (
                    '<span style="background:linear-gradient(135deg,#22c55e,#16a34a);color:white;padding:0.15rem 0.55rem;border-radius:1rem;font-size:0.65rem;font-weight:600;">DIRECT DOWNLOAD</span>'
                    if downloadable else
                    '<span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:0.15rem 0.55rem;border-radius:1rem;font-size:0.65rem;font-weight:600;">MANUAL STEPS</span>'
                )
                fmt_badge = f'<span style="background:#eef2ff;border:1px solid #c7d2fe;padding:0.15rem 0.55rem;border-radius:1rem;font-size:0.65rem;color:#4f46e5;font-weight:600;">{fmt}</span>'

                st.markdown(f"""
                <div style="border: 1px solid {border}; border-left: 3px solid {border}; border-radius: 0.75rem; padding: 1rem 1.25rem; margin-bottom: 0.75rem; background: {card_bg};">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                        {badge} {fmt_badge}
                        <span style="font-weight: 600; color: #1e293b; font-size: 0.95rem; margin-left:0.25rem;">{name}</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)

                if downloadable and ds_url:
                    col_link, col_spacer = st.columns([1, 3])
                    with col_link:
                        st.link_button(f"Download {fmt}", ds_url, use_container_width=True)
                elif ds_url:
                    st.caption(f"URL: {ds_url}")

                if not downloadable and steps:
                    with st.expander(f"Download steps — {name}", expanded=False):
                        st.markdown(steps)
        else:
            # Fallback: show raw B6.1 child URLs and B11 download steps
            child_urls = get_worker("B6.1")
            download_steps = get_worker("B11")
            if child_urls and child_urls.get("result", "").strip():
                st.markdown("**Available download links:**")
                st.markdown(child_urls["result"])
            if download_steps and download_steps.get("result", "").strip():
                st.markdown("**Download steps:**")
                st.markdown(download_steps["result"])
            if not (child_urls or download_steps):
                st.info("No datasets found. Try providing a more specific dataset page URL.")

    # ═══ TAB: Dataset Links ═══
    with tab_links:
        st.markdown("""
        <div style="margin-bottom:1rem;">
            <h3 style="margin:0; font-size:1.15rem;">Extracted Dataset Links</h3>
            <p style="font-size:0.8rem; color:#94a3b8 !important; margin:0.15rem 0 0;">URLs discovered from the dataset page</p>
        </div>
        """, unsafe_allow_html=True)
        all_content = ""
        # Gather URLs from scraped data
        all_links = scraped_data.get("all_links", [])
        if all_links:
            for link in all_links:
                if isinstance(link, dict):
                    all_content += f"\n[{link.get('text', '')}]({link.get('url', '')})"

        # Also from worker results B6, B6.1, B10, B10.1
        for wid in ["B6", "B6.1", "B10", "B10.1"]:
            wr = get_worker(wid)
            if wr:
                all_content += "\n" + wr.get("result", "")

        links = extract_dataset_links(all_content)
        if links:
            st.success(f"Found {len(links)} links")
            categories = {}
            for link in links:
                cat = link['category']
                categories.setdefault(cat, []).append(link)
            for category in ['Dataset', 'License/Terms', 'Documentation', 'Other']:
                if category not in categories: continue
                with st.expander(f"{category} ({len(categories[category])})", expanded=(category == 'Dataset')):
                    for link in categories[category]:
                        st.markdown(f"**[{link['title']}]({link['url']})** — `{link['domain']}`")
                        if link.get('description'):
                            st.caption(link['description'])
                        st.markdown("---")
        else:
            st.info("No dataset links found")

    # ═══ TAB: Scraped Data ═══
    with tab_scraped:
        st.markdown("""
        <div style="margin-bottom:1rem;">
            <h3 style="margin:0; font-size:1.15rem;">Raw Scraped Data</h3>
            <p style="font-size:0.8rem; color:#94a3b8 !important; margin:0.15rem 0 0;">Complete data extracted from the source page</p>
        </div>
        """, unsafe_allow_html=True)
        if scraped_data:
            scraped_path = results.get("scraped_data_path", "")
            if scraped_path:
                st.caption(f"Saved to: `{scraped_path}`")

            # Show each section
            for key, value in scraped_data.items():
                if key == "raw_text":
                    with st.expander("Raw Page Text", expanded=False):
                        st.text_area("", str(value)[:5000], height=300, key="raw_text_area")
                elif key == "all_links":
                    with st.expander(f"All Links ({len(value) if isinstance(value, list) else 0})", expanded=False):
                        st.json(value)
                else:
                    with st.expander(key.replace("_", " ").title(), expanded=False):
                        if isinstance(value, dict):
                            st.json(value)
                        else:
                            st.write(value)
        else:
            st.info("No scraped data available")

    # ═══ TAB: Downloads ═══
    with tab_downloads:
        st.markdown("""
        <div style="margin-bottom:1.25rem;">
            <h3 style="margin:0; font-size:1.15rem;">Download Extracted Data</h3>
            <p style="font-size:0.8rem; color:#94a3b8 !important; margin:0.15rem 0 0;">Export metadata in your preferred format</p>
        </div>
        """, unsafe_allow_html=True)
        col1, col2, col3 = st.columns(3)

        with col1:
            st.markdown("""
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1rem; margin-bottom:0.5rem;">
                <p style="font-weight:700; font-size:0.95rem; margin:0;">Import Document</p>
                <p style="font-size:0.78rem; color:#94a3b8 !important; margin:0.15rem 0 0;">Word document with all checklist findings</p>
            </div>
            """, unsafe_allow_html=True)
            docx_bytes = results.get("import_doc_bytes")
            if docx_bytes:
                st.download_button("Download .docx", data=docx_bytes, file_name="import_document.docx",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document", use_container_width=True)
            else:
                st.warning("Not generated")

        with col2:
            st.markdown("""
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1rem; margin-bottom:0.5rem;">
                <p style="font-weight:700; font-size:0.95rem; margin:0;">Croissant Metadata</p>
                <p style="font-size:0.78rem; color:#94a3b8 !important; margin:0.15rem 0 0;">JSON-LD for ML dataset cataloging</p>
            </div>
            """, unsafe_allow_html=True)
            croissant_bytes = results.get("croissant_bytes")
            if croissant_bytes:
                st.download_button("Download .json", data=croissant_bytes, file_name="croissant_metadata.json",
                    mime="application/json", use_container_width=True)
            else:
                st.warning("Not generated")

        with col3:
            st.markdown("""
            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1rem; margin-bottom:0.5rem;">
                <p style="font-weight:700; font-size:0.95rem; margin:0;">Raw JSON</p>
                <p style="font-size:0.78rem; color:#94a3b8 !important; margin:0.15rem 0 0;">Complete extraction results</p>
            </div>
            """, unsafe_allow_html=True)
            export = {
                "url": url, "timestamp": datetime.now().isoformat(),
                "scraped_data": scraped_data,
                "checklist_results": {wr["name"]: wr["result"] for wr in worker_results},
            }
            st.download_button("Download .json", data=json.dumps(export, indent=2, default=str),
                file_name=f"metadata_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json", use_container_width=True)


# ─── Entity Properties (Data Commons) ───

def search_statistical_variables(query: str, api_key: str = None) -> dict:
    import requests
    api_key = api_key or os.getenv("DC_API_KEY")
    headers = {"X-API-Key": api_key} if api_key else {}
    try:
        query_clean = query.strip().title().replace(" ", "")
        patterns = [f"Count_{query_clean}", f"Count_Person_{query_clean}", f"Area_{query_clean}",
                    f"Amount_{query_clean}", f"Percent_{query_clean}", f"Number_{query_clean}"]
        sparql_dcids = []
        try:
            resp = requests.get("https://api.datacommons.org/v2/sparql", headers=headers,
                params={"query": f'SELECT DISTINCT ?dcid WHERE {{ ?dcid typeOf StatisticalVariable . FILTER(CONTAINS(LCASE(STR(?dcid)), "{query.lower()}")) }} LIMIT 20'}, timeout=15)
            if resp.status_code == 200:
                for row in resp.json().get("rows", []):
                    cells = row.get("cells", [])
                    if cells: sparql_dcids.append(cells[0].get("value", ""))
        except Exception:
            pass
        all_dcids = list(set(patterns + sparql_dcids))
        results = []
        for i in range(0, len(all_dcids), 10):
            batch = all_dcids[i:i+10]
            props_resp = requests.post("https://api.datacommons.org/v2/node", headers=headers, json={"nodes": batch, "property": "->*"}, timeout=15)
            if props_resp.status_code == 200:
                for dcid, info in props_resp.json().get("data", {}).items():
                    arcs = info.get("arcs", {})
                    if arcs:
                        props = {k: [n.get("value") or n.get("dcid") for n in v.get("nodes", [])] for k, v in arcs.items() if [n.get("value") or n.get("dcid") for n in v.get("nodes", [])]}
                        if props: results.append({"dcid": dcid, "properties": props, "url": f"https://datacommons.org/browser/{dcid}"})
        return {"success": True, "results": results} if results else {"success": False, "error": f"No variables found for '{query}'"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Main App ───

def main():
    st.set_page_config(page_title="DC Metadata Extractor", page_icon="", layout="wide", initial_sidebar_state="collapsed")

    # CSS
    st.markdown("""<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    .stApp { background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%); font-family: 'Inter', sans-serif; }
    p, span, div, label, li { color: #1e293b !important; }
    strong, b { color: #0f172a !important; font-weight: 600 !important; }
    a { color: #4f46e5 !important; text-decoration: none !important; }
    a:hover { color: #4338ca !important; text-decoration: underline !important; }
    h1 { color: #0f172a !important; font-weight: 800 !important; letter-spacing: -0.025em; }
    h2, h3 { color: #1e293b !important; font-weight: 700 !important; }
    code { background-color: #f1f5f9 !important; color: #334155 !important; padding: 0.2rem 0.5rem !important; border-radius: 0.375rem !important; font-size: 0.8rem !important; }

    /* Buttons */
    .stButton > button {
        background: #fff !important; color: #374151 !important;
        border: 1.5px solid #e2e8f0 !important; border-radius: 0.75rem !important;
        font-weight: 500 !important; transition: all 0.2s ease !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04) !important;
    }
    .stButton > button:hover { background: #f8fafc !important; border-color: #cbd5e1 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important; transform: translateY(-1px) !important; }
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
        color: #fff !important; border: none !important; font-weight: 600 !important;
        box-shadow: 0 4px 14px rgba(79,70,229,0.35) !important;
    }
    .stButton > button[kind="primary"]:hover { box-shadow: 0 6px 20px rgba(79,70,229,0.45) !important; transform: translateY(-1px) !important; }
    .stDownloadButton > button {
        background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
        color: #fff !important; border: none !important; font-weight: 600 !important;
        border-radius: 0.75rem !important; box-shadow: 0 4px 14px rgba(16,185,129,0.3) !important;
    }
    .stDownloadButton > button:hover { box-shadow: 0 6px 20px rgba(16,185,129,0.4) !important; transform: translateY(-1px) !important; }

    /* Tabs */
    .stTabs [data-baseweb="tab-list"] { border-bottom: 2px solid #e2e8f0 !important; gap: 0.25rem !important; }
    .stTabs [data-baseweb="tab"] { color: #64748b !important; font-weight: 500 !important; border-radius: 0.5rem 0.5rem 0 0 !important; padding: 0.6rem 1.2rem !important; }
    .stTabs [data-baseweb="tab"]:hover { color: #334155 !important; background: #f1f5f9 !important; }
    .stTabs [aria-selected="true"] { color: #4f46e5 !important; border-bottom: 3px solid #4f46e5 !important; font-weight: 600 !important; }

    /* Inputs */
    .stTextInput > div > div > input { border: 1.5px solid #e2e8f0 !important; border-radius: 0.75rem !important; padding: 0.6rem 1rem !important; font-size: 0.95rem !important; transition: border-color 0.2s !important; }
    .stTextInput > div > div > input:focus { border-color: #4f46e5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,0.1) !important; }
    .stTextArea textarea { border: 1.5px solid #e2e8f0 !important; border-radius: 0.75rem !important; }
    .stTextArea textarea:focus { border-color: #4f46e5 !important; box-shadow: 0 0 0 3px rgba(79,70,229,0.1) !important; }

    /* Expanders */
    .streamlit-expanderHeader { border: 1px solid #e2e8f0 !important; border-radius: 0.75rem !important; background: #fff !important; }

    /* Progress */
    .stProgress > div > div > div { background: linear-gradient(90deg, #4f46e5, #7c3aed) !important; border-radius: 1rem !important; }
    .stProgress > div > div { background: #e2e8f0 !important; border-radius: 1rem !important; }

    /* Metrics */
    [data-testid="stMetricValue"] { color: #0f172a !important; font-weight: 700 !important; font-size: 1.8rem !important; }
    [data-testid="stMetricLabel"] { color: #64748b !important; font-weight: 500 !important; text-transform: uppercase !important; font-size: 0.7rem !important; letter-spacing: 0.05em !important; }

    /* Cards */
    [data-testid="stExpander"] { border: 1px solid #e2e8f0 !important; border-radius: 0.75rem !important; overflow: hidden !important; }

    /* Alert boxes */
    .stAlert { border-radius: 0.75rem !important; }

    /* Sidebar */
    section[data-testid="stSidebar"] { background: #fff !important; border-right: 1px solid #e2e8f0 !important; }
    section[data-testid="stSidebar"] p, section[data-testid="stSidebar"] span { color: #334155 !important; }
    </style>""", unsafe_allow_html=True)

    # Header
    st.markdown("""
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%); border-radius: 1rem; padding: 2rem 2.5rem; margin-bottom: 1.5rem; box-shadow: 0 8px 30px rgba(79,70,229,0.2);">
        <div style="display:flex; align-items:center; gap: 1rem;">
            <div style="background: rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 0.75rem; display:flex; align-items:center; justify-content:center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
            </div>
            <div>
                <h1 style="margin:0; color:#fff !important; font-size: 1.75rem; line-height: 1.2;">DC Metadata Extractor</h1>
                <p style="margin:0.25rem 0 0; color: rgba(255,255,255,0.8) !important; font-size: 0.9rem; font-weight: 400;">Automated dataset metadata extraction powered by Groq Compound + LangGraph</p>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Sidebar
    with st.sidebar:
        st.markdown("""
        <div style="padding: 0.5rem 0 1rem;">
            <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8 !important; font-weight: 600; margin-bottom: 0.5rem;">Configuration</p>
        </div>
        """, unsafe_allow_html=True)
        api_key = os.getenv('GROQ_API_KEY') or st.secrets.get("GROQ_API_KEY", None)
        if api_key: st.success("API Key loaded")
        else: st.error("No GROQ_API_KEY — set in .env or Streamlit Secrets")

        st.markdown("---")
        st.markdown("""
        <div style="padding: 0.25rem 0;">
            <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8 !important; font-weight: 600; margin-bottom: 0.75rem;">Pipeline Architecture</p>
        </div>
        """, unsafe_allow_html=True)
        steps = [
            ("1", "Scraper", "Browser automation"),
            ("2", "Workers", "20 text-only agents"),
            ("3", "Import Doc", "DOCX generation"),
            ("4", "Croissant", "JSON-LD metadata"),
        ]
        for num, name, desc in steps:
            st.markdown(f"""
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.5rem; padding:0.5rem 0.6rem; background:#f8fafc; border-radius:0.5rem; border: 1px solid #f1f5f9;">
                <div style="background: linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; width:1.5rem; height:1.5rem; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; flex-shrink:0;">{num}</div>
                <div>
                    <div style="font-weight:600; font-size:0.85rem; color:#1e293b !important; line-height:1.2;">{name}</div>
                    <div style="font-size:0.7rem; color:#94a3b8 !important;">{desc}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("""
        <div style="padding: 0.25rem 0;">
            <p style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8 !important; font-weight: 600; margin-bottom: 0.5rem;">Recent Sources</p>
        </div>
        """, unsafe_allow_html=True)
        if 'url_history' not in st.session_state: st.session_state.url_history = []
        for idx, h in enumerate(reversed(st.session_state.url_history[-5:])):
            if st.button(f"{h[:40]}...", key=f"hist_{idx}", use_container_width=True):
                st.session_state.selected_source = h; st.rerun()
        if not st.session_state.url_history: st.info("No sources yet")

    # Main tabs
    tool_tab1, tool_tab2 = st.tabs(["Metadata Extractor", "Entity Properties"])

    with tool_tab2:
        st.markdown("""
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1.25rem 1.5rem; margin-bottom:1rem;">
            <h3 style="margin:0 0 0.25rem; font-size:1.1rem;">Search Statistical Variables</h3>
            <p style="margin:0; font-size:0.85rem; color:#64748b !important;">Find Data Commons statistical variable DCIDs</p>
        </div>
        """, unsafe_allow_html=True)
        entity_input = st.text_input("Search", placeholder="e.g., agriculture, population, unemployment", label_visibility="collapsed", key="entity_input")
        if st.button("Search Variables", key="get_props", type="primary", use_container_width=True) and entity_input:
            with st.spinner("Searching Data Commons..."):
                result = search_statistical_variables(entity_input)
            if result["success"]:
                st.success(f"Found {len(result['results'])} variables")
                for r in result["results"]:
                    with st.expander(r['dcid'], expanded=False):
                        st.markdown(f"**[View in Data Commons]({r['url']})**")
                        for prop in ["measuredProperty", "populationType", "statType"]:
                            if prop in r["properties"]:
                                st.write(f"**{prop}:** {', '.join(str(v) for v in r['properties'][prop][:5])}")
            else:
                st.warning(result["error"])

    with tool_tab1:
        if not api_key:
            st.warning("Set GROQ_API_KEY in .env"); st.stop()

        # Input card
        st.markdown("""
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:0.75rem; padding:1.25rem 1.5rem; margin-bottom:1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <p style="font-weight:600; font-size:0.95rem; margin:0 0 0.15rem; color:#1e293b !important;">Data Source</p>
            <p style="font-size:0.8rem; color:#94a3b8 !important; margin:0;">Enter a dataset portal name or direct URL to extract metadata</p>
        </div>
        """, unsafe_allow_html=True)

        source_name = st.text_input("source", value=st.session_state.get('selected_source', ''),
            placeholder="e.g., Statistics Canada, or https://statcan.gc.ca", label_visibility="collapsed")

        source_description = st.text_area("Description (optional)", placeholder="What specific information are you looking for...", label_visibility="collapsed", height=80)

        # Example sources as a grid
        with st.expander("Quick start — example sources"):
            cols = st.columns(4)
            examples = [
                ("French Open Data", "https://www.data.gouv.fr"),
                ("Norway Statistics", "https://www.ssb.no/en"),
                ("Statistics Canada", "https://www.statcan.gc.ca"),
                ("US Census Bureau", "https://data.census.gov"),
            ]
            for i, (btn, val) in enumerate(examples):
                with cols[i]:
                    if st.button(btn, key=f"ex_{btn}", use_container_width=True):
                        st.session_state.selected_source = val; st.rerun()

        extract_button = st.button("Extract Metadata", type="primary", use_container_width=True)

        if extract_button:
            if not source_name:
                st.warning("Enter a source name or URL"); return

            if source_name not in st.session_state.url_history:
                st.session_state.url_history.append(source_name)

            try:
                start_time = time.time()
                progress_bar = st.progress(0)
                status = st.empty()

                # Resolve URL
                is_direct_url = source_name.startswith(('http://', 'https://'))
                if is_direct_url:
                    url = source_name
                    status.info("Using provided URL...")
                else:
                    status.info(f"Finding URL for '{source_name}'...")
                    url = resolve_url(source_name, api_key)

                if not url:
                    progress_bar.empty(); status.empty()
                    st.error(f"Could not find URL for '{source_name}'. Try entering the URL directly.")
                    st.stop()

                st.success(f"**URL:** {url}")
                progress_bar.progress(0.05)

                # Run LangGraph pipeline
                results = run_langgraph_pipeline(url, source_name, source_description, progress_bar, status)

                elapsed = time.time() - start_time
                progress_bar.empty(); status.empty()

                # Pre-read file bytes so downloads work across reruns
                import_path = results.get("import_doc_path")
                if import_path and Path(import_path).exists():
                    results["import_doc_bytes"] = Path(import_path).read_bytes()
                croissant_path = results.get("croissant_path")
                if croissant_path and Path(croissant_path).exists():
                    results["croissant_bytes"] = Path(croissant_path).read_bytes()

                # Store in session state so results persist across reruns
                st.session_state.pipeline_results = results
                st.session_state.pipeline_elapsed = elapsed

            except Exception as e:
                st.error(f"Pipeline failed: {e}")
                with st.expander("Error details"):
                    st.exception(e)

        # Always display results if they exist in session state
        if 'pipeline_results' in st.session_state:
            results = st.session_state.pipeline_results
            elapsed = st.session_state.get('pipeline_elapsed', 0)
            token_usage = results.get("token_usage", {})

            # Summary banner
            worker_count = len(results.get('worker_results', []))
            total_tok = token_usage.get("total", 0)

            st.markdown(f"""
            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border: 1px solid #bbf7d0; border-radius: 0.75rem; padding: 1rem 1.5rem; margin-bottom: 0.75rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:1.25rem;">&#10003;</span>
                        <span style="font-weight:600; color:#166534 !important; font-size:0.95rem;">Pipeline completed in {elapsed:.0f}s</span>
                        <span style="color:#16a34a !important; font-size:0.85rem;">  |  {worker_count} checklist items processed</span>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True)

            # Token usage + stats row
            m1, m2, m3, m4, m_clear = st.columns([1, 1, 1, 1, 0.6])
            m1.metric("Total Tokens", f"{total_tok:,}")
            m2.metric("Prompt Tokens", f"{token_usage.get('prompt', 0):,}")
            m3.metric("Completion Tokens", f"{token_usage.get('completion', 0):,}")
            m4.metric("Processing Time", f"{elapsed:.0f}s")
            with m_clear:
                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("Clear Results", key="clear_results"):
                    del st.session_state.pipeline_results
                    if 'pipeline_elapsed' in st.session_state:
                        del st.session_state.pipeline_elapsed
                    st.rerun()

            st.divider()
            display_results(results)

    st.markdown("""
    <div style="margin-top:2rem; padding:1rem 0; border-top:1px solid #e2e8f0; text-align:center;">
        <p style="font-size:0.78rem; color:#94a3b8 !important; margin:0;">Powered by <strong style="color:#64748b !important;">Groq Compound</strong> + <strong style="color:#64748b !important;">LangGraph</strong></p>
    </div>
    """, unsafe_allow_html=True)


if __name__ == "__main__":
    main()
