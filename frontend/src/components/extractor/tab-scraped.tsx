"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { PipelineResults } from "@/lib/api";

const triggerClass =
  "w-full flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors";

interface TabScrapedProps {
  results: PipelineResults;
}

export function TabScraped({ results }: TabScrapedProps) {
  const scraped = results.scraped_data;

  if (!scraped || Object.keys(scraped).length === 0) {
    return <p className="text-sm text-slate-400">No scraped data available</p>;
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">Raw Scraped Data</h3>
      <p className="text-sm text-slate-400 mb-4">Complete data extracted from the source page</p>

      {results.scraped_data_path && (
        <p className="text-xs text-slate-400 mb-3">
          Saved to:{" "}
          <code className="bg-slate-100 px-2 py-0.5 rounded">{results.scraped_data_path}</code>
        </p>
      )}

      <div className="space-y-2">
        {Object.entries(scraped).map(([key, value]) => {
          if (key === "raw_text") {
            return (
              <Collapsible key={key}>
                <CollapsibleTrigger className={triggerClass}>
                  Raw Page Text <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg p-4 max-h-80 overflow-auto">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                      {String(value).slice(0, 5000)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          }

          if (key === "all_links") {
            const linkCount = Array.isArray(value) ? value.length : 0;
            return (
              <Collapsible key={key}>
                <CollapsibleTrigger className={triggerClass}>
                  All Links ({linkCount}) <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg p-4 max-h-80 overflow-auto">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          }

          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return (
            <Collapsible key={key}>
              <CollapsibleTrigger className={triggerClass}>
                {label} <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg p-4 max-h-80 overflow-auto">
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                    {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
