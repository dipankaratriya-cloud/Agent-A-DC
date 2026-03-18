"""
Core Groq Compound engine — direct SDK calls with compound_custom.
Replicates the GroqBrowserAutomation pattern from the license finder app.
"""
import re
import time
from groq import Groq


class GroqBrowserAutomation:
    def __init__(self, api_key: str, model: str = "groq/compound", timeout: int = 240):
        self.client = Groq(
            api_key=api_key,
            timeout=timeout,
            default_headers={"Groq-Model-Version": "latest"},
        )
        self.model = model
        self.timeout = timeout

    def extract_with_automation(self, query: str, temperature: float = 0.1, max_retries: int = 2) -> dict:
        """Core method — sends query to Groq Compound with browser + web search enabled."""
        for attempt in range(1, max_retries + 1):
            try:
                chat_completion = self.client.chat.completions.create(
                    messages=[{"role": "user", "content": query}],
                    model=self.model,
                    temperature=temperature,
                    compound_custom={
                        "tools": {
                            "enabled_tools": ["browser_automation", "web_search"]
                        }
                    },
                )
                content = chat_completion.choices[0].message.content if chat_completion.choices else ""
                executed_tools = getattr(chat_completion, "executed_tools", []) or []
                reasoning = getattr(chat_completion.choices[0].message, "reasoning", "") if chat_completion.choices else ""

                return {
                    "success": bool(content and len(content.strip()) > 20),
                    "content": content or "",
                    "reasoning": reasoning or "",
                    "executed_tools": executed_tools,
                    "raw_response": chat_completion,
                }
            except Exception as e:
                error_str = str(e).lower()
                if "api key" in error_str or "authentication" in error_str:
                    return {"success": False, "content": "", "error": str(e), "reasoning": "", "executed_tools": []}
                if attempt < max_retries:
                    time.sleep(2 * attempt)
                    continue
                return {"success": False, "content": "", "error": str(e), "reasoning": "", "executed_tools": []}

    def find_source_url(self, source_name: str, max_retries: int = 3) -> dict:
        """Resolve a source name to its URL using browser automation + web search."""
        # Clean input
        cleaned = re.sub(r'([a-z])([A-Z])', r'\1 \2', source_name)
        cleaned = cleaned.replace("_", " ").replace("-", " ").strip()

        queries = [
            f'Search the web for: "{cleaned}" official data website. Find the EXACT webpage URL where this data source is hosted. Return JSON: {{"url": "...", "license_url": "...", "data_url": "..."}}',
            f'Find the official website for "{cleaned}" data portal. Return as JSON with "url", "license_url", and "data_url" fields.',
            f'What is the official website URL for "{cleaned}"? Return just the URL.',
        ]

        for attempt, query in enumerate(queries[:max_retries], 1):
            result = self.extract_with_automation(query, max_retries=1)
            if not result.get("success"):
                if attempt < max_retries:
                    time.sleep(2)
                continue

            content = result["content"]

            # Try JSON extraction
            json_match = re.search(r'\{[^{}]*"url"[^{}]*\}', content)
            if json_match:
                import json
                try:
                    parsed = json.loads(json_match.group())
                    url = parsed.get("url", "")
                    if url and url.startswith("http"):
                        result["detected_url"] = url
                        result["license_url"] = parsed.get("license_url", "")
                        result["data_url"] = parsed.get("data_url", "")
                        result["attempts"] = attempt
                        # Filter creativecommons from license_url
                        if result.get("license_url") and "creativecommons.org" in result["license_url"]:
                            result["license_url"] = ""
                        return result
                except json.JSONDecodeError:
                    pass

            # Fallback: regex URL extraction
            urls = re.findall(r'https?://[^\s<>"\')\]]+', content)
            if urls:
                result["detected_url"] = urls[0].rstrip(".,;:!?")
                result["license_url"] = ""
                result["data_url"] = ""
                result["attempts"] = attempt
                # Try to find license/data URLs
                for u in urls[1:]:
                    u = u.rstrip(".,;:!?")
                    if any(k in u.lower() for k in ["license", "terms", "legal"]) and "creativecommons.org" not in u:
                        result["license_url"] = u
                    elif any(k in u.lower() for k in ["data", "table", "statistic", "download"]):
                        result["data_url"] = u
                return result

        return {"success": False, "detected_url": None, "error": f"Could not find URL for '{source_name}'", "attempts": max_retries, "content": "", "executed_tools": []}

    def extract_all_metadata(self, url: str, max_retries: int = 3, description: str = "") -> dict:
        """Extract comprehensive metadata from a URL using browser automation."""
        desc_line = f"\nUSER REQUEST: {description}" if description else ""

        query = f"""Analyze this data source: {url}{desc_line}

Return a STRUCTURED report with these sections:

## 1. DATA CATALOG LINKS
Find and list ALL available dataset pages, data tables, and download links.
Format as a markdown table: | Dataset Name | URL | Description |
List at least 10 links if available.

## 2. LICENSE & TERMS
- License Type: (e.g., CC BY 4.0, Open Government License, proprietary)
- License URL: (direct link to license page)
- Attribution Requirements: (what must be cited)
- Usage Restrictions: (any limitations)
- Confidence: (high/medium/low)

## 3. GEOGRAPHIC COVERAGE
- Countries/Regions covered
- Place Types (country, state, county, city, etc.)
- Place ID System (FIPS, ISO 3166, postal codes, etc.)
- Spatial Resolution (national, state-level, county-level, etc.)

## 4. TEMPORAL COVERAGE
- Date Range: (earliest date to latest date)
- Update Frequency: (daily, weekly, monthly, annually)
- Last Updated: (date of most recent data)
- Temporal Resolution: (daily, monthly, annual data points)

## 5. API & TECHNICAL ACCESS
- API Endpoint (if available)
- Data Formats (CSV, JSON, XML, etc.)
- Documentation URL
- Programmatic access details

Be thorough. Visit multiple pages on the site to gather complete information."""

        result = self.extract_with_automation(query, max_retries=max_retries)

        if result.get("success"):
            result["parsed_metadata"] = {
                "license": self._parse_license_content(result["content"]),
                "place": self._parse_place_content(result["content"]),
                "temporal": self._parse_temporal_content(result["content"]),
            }

        return result

    def extract_checklist_item(self, url: str, prompt: str, max_retries: int = 2) -> dict:
        """Extract a single checklist item from a URL. Used by worker agents."""
        full_query = f"{prompt}\n\nURL to visit and analyze: {url}\n\nVisit the URL above using browser automation. Navigate the site as needed to find the specific information requested. If you cannot find the information, state 'Not found' — do NOT guess."
        return self.extract_with_automation(full_query, max_retries=max_retries)

    def _parse_license_content(self, content: str) -> dict:
        """Parse license information from extracted content."""
        license_data = {
            "license_type": None, "license_url": None,
            "attribution": None, "restrictions": None, "confidence": None,
        }
        if not content:
            return license_data

        # License URL
        url_match = re.search(r'license\s*(?:url|link)[:\s]*\(?(https?://[^\s)\]]+)', content, re.IGNORECASE)
        if not url_match:
            url_match = re.search(r'(?:license|licensing|terms)[^}]{0,300}?(https?://[^\s)\]]+)', content, re.IGNORECASE)
        if url_match:
            url = url_match.group(1).rstrip(".,;:!?)")
            if self._is_valid_license_url(url):
                license_data["license_url"] = url

        # License type
        for line in content.split("\n"):
            line_lower = line.lower().strip()
            if any(k in line_lower for k in ["license type:", "license:"]) and "url" not in line_lower:
                val = line.split(":", 1)[1].strip().strip("*").strip()
                if val and val.lower() not in ["not found", "n/a", "none", ""]:
                    license_data["license_type"] = val
                    break

        # Confidence
        conf_match = re.search(r'confidence[:\s]*(high|medium|low)', content, re.IGNORECASE)
        if conf_match:
            license_data["confidence"] = conf_match.group(1).lower()

        # Attribution
        attr_match = re.search(r'attribution[^:]*:\s*(.+?)(?:\n|$)', content, re.IGNORECASE)
        if attr_match:
            val = attr_match.group(1).strip()
            if val.lower() not in ["not found", "n/a", "none", ""]:
                license_data["attribution"] = val

        # Restrictions
        restr_match = re.search(r'restrictions?[^:]*:\s*(.+?)(?:\n|$)', content, re.IGNORECASE)
        if restr_match:
            val = restr_match.group(1).strip()
            if val.lower() not in ["not found", "n/a", "none", ""]:
                license_data["restrictions"] = val

        return license_data

    def _is_valid_license_url(self, url: str) -> bool:
        """Check if URL is likely a license/terms page."""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.lower()

        license_keywords = ["license", "licence", "terms", "legal", "copyright", "policy", "tos", "eula"]
        license_domains = ["creativecommons.org", "opensource.org", "gnu.org/licenses"]

        if any(k in path for k in license_keywords):
            return True
        if any(d in parsed.netloc for d in license_domains):
            return True
        if path.rstrip("/") == "" or path == "/":
            return False
        if any(path.endswith(ext) for ext in [".csv", ".xlsx", ".json", ".pdf", ".zip"]):
            return False
        return False

    def _parse_place_content(self, content: str) -> dict:
        """Parse geographic/place information from extracted content."""
        place_data = {
            "geographic_coverage": {}, "place_types": [],
            "place_id_systems": {}, "spatial_resolution": None,
        }
        if not content:
            return place_data

        # Extract geographic coverage section
        geo_match = re.search(r'(?:GEOGRAPHIC COVERAGE|GEOGRAPHIC|PLACE)(.*?)(?:##|\Z)', content, re.IGNORECASE | re.DOTALL)
        if geo_match:
            section = geo_match.group(1)

            # Countries/Regions
            countries_match = re.search(r'countries?[/\s]*regions?[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if countries_match:
                place_data["geographic_coverage"]["countries_regions"] = countries_match.group(1).strip()

            # Place types
            types_match = re.search(r'place\s*types?[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if types_match:
                types_str = types_match.group(1).strip()
                place_data["place_types"] = [t.strip() for t in re.split(r'[,;]', types_str) if t.strip()]

            # Place ID systems
            id_match = re.search(r'(?:place\s*id|id\s*system|coding)[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if id_match:
                place_data["place_id_systems"]["system"] = id_match.group(1).strip()

            # Spatial resolution
            res_match = re.search(r'(?:spatial\s*)?resolution[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if res_match:
                place_data["spatial_resolution"] = res_match.group(1).strip()

        return place_data

    def _parse_temporal_content(self, content: str) -> dict:
        """Parse temporal/date information from extracted content."""
        temporal_data = {
            "coverage_period": {}, "update_frequency": {},
            "temporal_resolution": None, "data_type": None,
        }
        if not content:
            return temporal_data

        # Extract temporal section
        temp_match = re.search(r'(?:TEMPORAL COVERAGE|TEMPORAL|DATE RANGE)(.*?)(?:##|\Z)', content, re.IGNORECASE | re.DOTALL)
        if temp_match:
            section = temp_match.group(1)

            # Date range
            range_match = re.search(r'date\s*range[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if range_match:
                range_str = range_match.group(1).strip()
                # Try to split into start/end
                parts = re.split(r'\s*(?:to|–|-|through)\s*', range_str, maxsplit=1)
                if len(parts) == 2:
                    temporal_data["coverage_period"]["start_date"] = parts[0].strip()
                    temporal_data["coverage_period"]["end_date"] = parts[1].strip()
                else:
                    temporal_data["coverage_period"]["range"] = range_str

            # Update frequency
            freq_match = re.search(r'update\s*frequency[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if freq_match:
                temporal_data["update_frequency"]["frequency"] = freq_match.group(1).strip()

            # Last updated
            updated_match = re.search(r'last\s*updated?[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if updated_match:
                temporal_data["update_frequency"]["last_updated"] = updated_match.group(1).strip()

            # Temporal resolution
            res_match = re.search(r'temporal\s*resolution[:\s]*(.+?)(?:\n|$)', section, re.IGNORECASE)
            if res_match:
                temporal_data["temporal_resolution"] = res_match.group(1).strip()

        return temporal_data
