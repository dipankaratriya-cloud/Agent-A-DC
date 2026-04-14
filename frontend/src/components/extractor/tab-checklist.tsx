"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PipelineResults } from "@/lib/api";
import {
  getWorker,
  getPreview,
  extractUrls,
  isNotFound,
  CHECKLIST_SECTIONS,
} from "@/lib/extract-utils";

interface TabChecklistProps {
  results: PipelineResults;
  jobId: string | null;
}

export function TabChecklist({ results, jobId }: TabChecklistProps) {
  const workers = results.worker_results;
  if (!workers.length) {
    return <p className="text-sm text-slate-400">No checklist results</p>;
  }

  const total = workers.length;
  const found = workers.filter(
    (wr) => wr.success && !isNotFound(wr.result || "")
  ).length;
  const pct = total ? Math.round((found / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total Items" value={total} />
        <MetricCard label="Found" value={found} />
        <MetricCard label="Missing" value={total - found} />
        <MetricCard label="Coverage" value={`${pct}%`} />
      </div>

      {/* Coverage bar */}
      <Progress
        value={pct}
        className={`h-2 ${pct >= 70 ? "[&>div]:bg-emerald-500" : pct >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`}
      />

      {/* Sections */}
      {CHECKLIST_SECTIONS.map((section) => (
        <ChecklistSection key={section.prefix} section={section} workers={workers} />
      ))}

      {/* Downloads */}
      <DownloadsInline results={results} jobId={jobId} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function ChecklistSection({
  section,
  workers,
}: {
  section: (typeof CHECKLIST_SECTIONS)[number];
  workers: PipelineResults["worker_results"];
}) {
  const sectionWorkers = workers.filter((wr) => wr.name.startsWith(section.prefix));
  const sectionFound = sectionWorkers.filter(
    (wr) => wr.success && !isNotFound(wr.result || "")
  ).length;
  const secPct = sectionWorkers.length
    ? Math.round((sectionFound / sectionWorkers.length) * 100)
    : 0;

  return (
    <div>
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-l-4 border-indigo-600 rounded-r-xl px-4 py-3 mb-3 flex justify-between items-center">
        <span className="font-bold text-slate-800">{section.title}</span>
        <div className="flex items-center gap-2">
          <div className="bg-slate-200 rounded-full h-1.5 w-16 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{ width: `${secPct}%` }}
            />
          </div>
          <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            {sectionFound}/{sectionWorkers.length}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {section.items.map((item) => (
          <ChecklistItem key={item.id} item={item} workers={workers} />
        ))}
      </div>
    </div>
  );
}

function ChecklistItem({
  item,
  workers,
}: {
  item: { id: string; label: string; hint: string };
  workers: PipelineResults["worker_results"];
}) {
  const [expanded, setExpanded] = useState(false);
  const wr = getWorker(workers, item.id);
  if (!wr) return null;

  const resultText = (wr.result || "").trim();
  const urls = extractUrls(resultText);
  const noData = !resultText || resultText.length < 10;
  const partial = !noData && isNotFound(resultText);

  let badgeClass: string;
  let badgeText: string;
  let borderColor: string;
  let bgColor: string;

  if (noData) {
    badgeClass = "bg-gradient-to-r from-red-500 to-red-600 text-white";
    badgeText = "NO DATA";
    borderColor = "border-red-200";
    bgColor = "bg-red-50/50";
  } else if (partial) {
    badgeClass = "bg-gradient-to-r from-amber-500 to-amber-600 text-white";
    badgeText = "PARTIAL";
    borderColor = "border-amber-200";
    bgColor = "bg-amber-50/50";
  } else {
    badgeClass = "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white";
    badgeText = "FOUND";
    borderColor = "border-emerald-200";
    bgColor = "bg-emerald-50/50";
  }

  const preview = getPreview(resultText);

  return (
    <div className={`border ${borderColor} border-l-[3px] rounded-xl p-3 ${bgColor}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-[2.75rem] font-bold text-indigo-600 text-sm bg-indigo-50 px-2 py-1 rounded text-center">
          {item.id}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className={`text-[0.65rem] ${badgeClass}`}>{badgeText}</Badge>
            <span className="font-semibold text-sm text-slate-800">{item.label}</span>
            {item.hint && <span className="text-xs text-slate-400">({item.hint})</span>}
          </div>
          <div className="text-sm text-slate-600 bg-white/70 px-3 py-2 rounded-lg border border-black/5 line-clamp-2">
            {preview}
          </div>

          {urls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {urls.slice(0, 5).map((u) => (
                <a
                  key={u}
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full text-xs text-indigo-600 font-medium hover:bg-indigo-100 transition-colors"
                >
                  {u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                </a>
              ))}
            </div>
          )}

          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger className="inline-flex items-center text-xs text-slate-400 hover:text-slate-600 mt-1 h-6 px-2 rounded hover:bg-slate-100 transition-colors">
              Full output <ChevronDown className={`ml-1 w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 text-sm text-slate-600 bg-white rounded-lg p-3 border whitespace-pre-wrap max-h-64 overflow-auto">
                {resultText}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

function DownloadsInline({ results, jobId }: { results: PipelineResults; jobId: string | null }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="border-t pt-5 mt-5">
      <p className="font-bold text-lg text-slate-800">Download Generated Documents</p>
      <p className="text-sm text-slate-400 mb-4">Export your extracted metadata in various formats</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href={jobId ? `${apiBase}/api/download/${jobId}/docx` : "#"}
          download
          className={cn(
            buttonVariants(),
            "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white",
            (!results.import_doc_path || !jobId) && "pointer-events-none opacity-50"
          )}
        >
          <Download className="w-4 h-4 mr-2" /> Import Document (.docx)
        </a>
        <a
          href={jobId ? `${apiBase}/api/download/${jobId}/croissant` : "#"}
          download
          className={cn(
            buttonVariants(),
            "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white",
            (!results.croissant_path || !jobId) && "pointer-events-none opacity-50"
          )}
        >
          <Download className="w-4 h-4 mr-2" /> Croissant (.json)
        </a>
        <a
          href={jobId ? `${apiBase}/api/download/${jobId}/raw` : "#"}
          download
          className={cn(
            buttonVariants(),
            "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
          )}
        >
          <Download className="w-4 h-4 mr-2" /> Raw JSON
        </a>
      </div>
    </div>
  );
}
