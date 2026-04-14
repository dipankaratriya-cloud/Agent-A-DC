"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, Search, ExternalLink } from "lucide-react";
import { searchVariables, type SearchVariableResult } from "@/lib/api";

export function EntitySearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchVariableResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await searchVariables(query.trim());
      if (res.success && res.results) {
        setResults(res.results);
      } else {
        setError(res.error || "No results found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-lg font-semibold mb-1">Search Statistical Variables</h3>
        <p className="text-sm text-slate-400 mb-4">
          Find Data Commons statistical variable DCIDs
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="e.g., agriculture, population, unemployment"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700 font-medium">
            Found {results.length} variables
          </div>

          {results.map((r) => (
            <Collapsible key={r.dcid}>
              <CollapsibleTrigger className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2 text-sm font-mono text-slate-700 hover:bg-slate-50 transition-colors">
                {r.dcid}
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4 space-y-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 hover:underline font-medium flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View in Data Commons
                  </a>
                  {["measuredProperty", "populationType", "statType"].map((prop) => {
                    const vals = r.properties[prop];
                    if (!vals) return null;
                    return (
                      <p key={prop} className="text-sm">
                        <span className="font-semibold">{prop}:</span>{" "}
                        {vals.slice(0, 5).join(", ")}
                      </p>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
