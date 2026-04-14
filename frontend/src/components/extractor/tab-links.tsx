"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { PipelineResults } from "@/lib/api";
import { getWorker, extractDatasetLinks, type DatasetLink } from "@/lib/extract-utils";

interface TabLinksProps {
  results: PipelineResults;
}

export function TabLinks({ results }: TabLinksProps) {
  const scraped = results.scraped_data;
  let allContent = "";

  const allLinks = (scraped.all_links || []) as Array<Record<string, string>>;
  for (const link of allLinks) {
    if (typeof link === "object") {
      allContent += `\n[${link.text || ""}](${link.url || ""})`;
    }
  }

  for (const wid of ["B6", "B6.1", "B10", "B10.1"]) {
    const wr = getWorker(results.worker_results, wid);
    if (wr) allContent += "\n" + (wr.result || "");
  }

  const links = extractDatasetLinks(allContent);

  if (links.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-1">Extracted Dataset Links</h3>
        <p className="text-sm text-slate-400 mb-4">URLs discovered from the dataset page</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          No dataset links found
        </div>
      </div>
    );
  }

  const categories: Record<string, DatasetLink[]> = {};
  for (const link of links) {
    if (!categories[link.category]) categories[link.category] = [];
    categories[link.category].push(link);
  }

  const order = ["Dataset", "License/Terms", "Documentation", "Other"] as const;

  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">Extracted Dataset Links</h3>
      <p className="text-sm text-slate-400 mb-4">URLs discovered from the dataset page</p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700 font-medium mb-4">
        Found {links.length} links
      </div>

      {order.map((cat) => {
        const catLinks = categories[cat];
        if (!catLinks) return null;

        return (
          <Collapsible key={cat} defaultOpen={cat === "Dataset"} className="mb-3">
            <CollapsibleTrigger className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              {cat} ({catLinks.length})
              <ChevronDown className="w-4 h-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border border-t-0 rounded-b-lg divide-y">
                {catLinks.map((link, i) => (
                  <div key={i} className="px-4 py-3">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      {link.title}
                    </a>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <code>{link.domain}</code>
                    </p>
                    {link.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{link.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
