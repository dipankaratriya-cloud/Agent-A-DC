"use client";

import { Badge } from "@/components/ui/badge";
import type { PipelineResults } from "@/lib/api";
import {
  Lock,
  ClipboardList,
  BarChart3,
  Globe,
  Calendar,
  Link2,
  HardDrive,
  RefreshCw,
} from "lucide-react";

const SECTION_ICONS: Record<string, React.ElementType> = {
  license: Lock,
  core_attributes: ClipboardList,
  data_vertical: BarChart3,
  geographic: Globe,
  temporal: Calendar,
  source_urls: Link2,
  format_access: HardDrive,
  refresh_info: RefreshCw,
};

const SECTION_LABELS: Record<string, string> = {
  license: "License",
  core_attributes: "Core Attributes",
  data_vertical: "Data Vertical",
  geographic: "Geographic",
  temporal: "Temporal",
  source_urls: "Source URLs",
  format_access: "Format & Access",
  refresh_info: "Refresh Info",
};

interface TabOverviewProps {
  results: PipelineResults;
}

export function TabOverview({ results }: TabOverviewProps) {
  const scraped = results.scraped_data;
  if (!scraped || Object.keys(scraped).length === 0) {
    return <p className="text-sm text-slate-400">No scraped data available</p>;
  }

  const pageMeta = (scraped.page_metadata || {}) as Record<string, string>;
  const title = pageMeta.title || "Unknown Dataset";
  const org = pageMeta.organization || "N/A";
  const pageUrl = pageMeta.url || results.url;

  const sections = Object.keys(SECTION_LABELS);

  return (
    <div className="space-y-5">
      {/* Dataset info card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
          Dataset Information
        </p>
        <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
        <div className="flex gap-8 flex-wrap text-sm">
          <div>
            <span className="text-xs text-slate-400">Organization</span>
            <br />
            <span className="font-semibold">{org}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400">URL</span>
            <br />
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              {pageUrl.length > 60 ? pageUrl.slice(0, 60) + "..." : pageUrl}
            </a>
          </div>
        </div>
      </div>

      {/* Section status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sections.map((key) => {
          const section = scraped[key] as Record<string, unknown> | undefined;
          const found =
            section && typeof section === "object" ? (section.found as boolean) || false : false;
          const Icon = SECTION_ICONS[key] || Globe;

          return (
            <div
              key={key}
              className={`rounded-xl border p-3 text-center transition-colors ${
                found
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <Icon
                className={`w-6 h-6 mx-auto mb-1 ${found ? "text-emerald-600" : "text-amber-600"}`}
              />
              <p className="text-sm font-semibold text-slate-800">{SECTION_LABELS[key]}</p>
              <Badge variant={found ? "default" : "secondary"} className={`text-xs mt-1 ${found ? "bg-emerald-600" : "bg-amber-500 text-white"}`}>
                {found ? "Found" : "Missing"}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Country DCIDs */}
      {results.country_dcids && results.country_dcids.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-semibold text-sm mb-2">Data Commons DCIDs</p>
          <div className="space-y-1">
            {results.country_dcids.map((c) => (
              <p key={c.dcid} className="text-sm">
                <span className="font-medium">{c.name}</span>:{" "}
                <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{c.dcid}</code>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
