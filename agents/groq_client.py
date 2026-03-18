"""
Core Groq Compound client — reuses the GroqBrowserAutomation pattern.
Single point of contact with the Groq API. All agents use this.
"""
import time
from groq import Groq


class GroqCompoundClient:
    def __init__(self, api_key: str, model: str = "groq/compound", timeout: int = 240):
        self.client = Groq(
            api_key=api_key,
            timeout=timeout,
            default_headers={"Groq-Model-Version": "latest"},
        )
        self.model = model
        self.timeout = timeout
        self.total_tokens = {"prompt": 0, "completion": 0, "total": 0}

    def _track_tokens(self, response):
        usage = getattr(response, "usage", None)
        if usage:
            self.total_tokens["prompt"] += getattr(usage, "prompt_tokens", 0)
            self.total_tokens["completion"] += getattr(usage, "completion_tokens", 0)
            self.total_tokens["total"] += getattr(usage, "total_tokens", 0)

    def get_token_usage(self) -> dict:
        return dict(self.total_tokens)

    def query(self, prompt: str, temperature: float = 0.1, max_retries: int = 2) -> dict:
        """
        Send a query to Groq Compound with browser_automation + web_search enabled.
        Returns {"success": bool, "content": str, "executed_tools": list}.
        """
        for attempt in range(1, max_retries + 1):
            try:
                response = self.client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=self.model,
                    temperature=temperature,
                    compound_custom={
                        "tools": {
                            "enabled_tools": ["browser_automation", "web_search"]
                        }
                    },
                )
                self._track_tokens(response)
                content = response.choices[0].message.content if response.choices else ""
                executed_tools = getattr(response, "executed_tools", []) or []

                return {
                    "success": bool(content and len(content) > 20),
                    "content": content or "",
                    "executed_tools": executed_tools,
                }

            except Exception as e:
                error_str = str(e).lower()
                # Don't retry auth errors
                if "api key" in error_str or "authentication" in error_str:
                    return {"success": False, "content": f"Auth error: {e}", "executed_tools": []}
                if attempt < max_retries:
                    time.sleep(2 * attempt)
                    continue
                return {"success": False, "content": f"Error after {max_retries} attempts: {e}", "executed_tools": []}

    def query_text(self, prompt: str, temperature: float = 0.1) -> dict:
        """
        Send a text-only query (no browsing). For output agents that just process text.
        Uses compound-mini for speed since no browsing needed.
        """
        try:
            response = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="groq/compound-mini",
                temperature=temperature,
            )
            self._track_tokens(response)
            content = response.choices[0].message.content if response.choices else ""
            return {"success": bool(content), "content": content or ""}
        except Exception as e:
            return {"success": False, "content": f"Error: {e}"}
