"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineResults } from "@/lib/api";
import { getWorker, parseDatasets } from "@/lib/extract-utils";

interface TabDatasetsProps {
  results: PipelineResults;
}

export function TabDatasets({ results }: TabDatasetsProps) {
  const d1 = getWorker(results.worker_results, "D1");
  const datasets = d1 ? parseDatasets(d1.result || "") : [];

  if (datasets.length > 0) {
    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Available Datasets</h3>
          <p className="text-sm text-slate-400">
            Discovered downloadable datasets and access methods
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700 font-medium">
          Found {datasets.length} dataset(s)
        </div>

        {datasets.map((ds, i) => (
          <div
            key={i}
            className={`border rounded-xl p-4 ${
              ds.downloadable
                ? "border-emerald-200 border-l-4 border-l-emerald-400 bg-emerald-50/50"
                : "border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge
                className={
                  ds.downloadable
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                }
              >
                {ds.downloadable ? "DIRECT DOWNLOAD" : "MANUAL STEPS"}
              </Badge>
              <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">
                {ds.format || "Unknown"}
              </Badge>
              <span className="font-semibold text-slate-800">{ds.name || `Dataset ${i + 1}`}</span>
            </div>

            {ds.downloadable && ds.url ? (
              <a
                href={ds.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "bg-emerald-600 hover:bg-emerald-700 text-white")}
              >
                <Download className="w-4 h-4 mr-1" /> Download {ds.format}
              </a>
            ) : ds.url ? (
              <a
                href={ds.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> {ds.url}
              </a>
            ) : null}

            {!ds.downloadable && ds.download_steps && (
              <Collapsible className="mt-2">
                <CollapsibleTrigger className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors">
                  Download steps <ChevronDown className="ml-1 w-3 h-3" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 text-sm text-slate-600 bg-white rounded-lg p-3 border whitespace-pre-wrap">
                    {ds.download_steps}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback
  const childUrls = getWorker(results.worker_results, "B6.1");
  const downloadSteps = getWorker(results.worker_results, "B11");

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Available Datasets</h3>
        <p className="text-sm text-slate-400">
          Discovered downloadable datasets and access methods
        </p>
      </div>

      {childUrls?.result?.trim() && (
        <div>
          <p className="font-semibold text-sm mb-1">Available download links:</p>
          <div className="text-sm text-slate-600 whitespace-pre-wrap bg-white rounded-lg p-3 border">
            {childUrls.result}
          </div>
        </div>
      )}

      {downloadSteps?.result?.trim() && (
        <div>
          <p className="font-semibold text-sm mb-1">Download steps:</p>
          <div className="text-sm text-slate-600 whitespace-pre-wrap bg-white rounded-lg p-3 border">
            {downloadSteps.result}
          </div>
        </div>
      )}

      {!childUrls?.result?.trim() && !downloadSteps?.result?.trim() && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          No datasets found. Try providing a more specific dataset page URL.
        </div>
      )}
    </div>
  );
}
