"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineResults } from "@/lib/api";

interface TabDownloadsProps {
  results: PipelineResults;
  jobId: string | null;
}

export function TabDownloads({ results, jobId }: TabDownloadsProps) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const files = [
    {
      title: "Import Document",
      desc: "Word document with all checklist findings",
      type: "docx" as const,
      available: !!results.import_doc_path,
      ext: ".docx",
    },
    {
      title: "Croissant Metadata",
      desc: "JSON-LD for ML dataset cataloging",
      type: "croissant" as const,
      available: !!results.croissant_path,
      ext: ".json",
    },
    {
      title: "Raw JSON",
      desc: "Complete extraction results",
      type: "raw" as const,
      available: true,
      ext: ".json",
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">Download Extracted Data</h3>
      <p className="text-sm text-slate-400 mb-5">Export metadata in your preferred format</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {files.map((f) => (
          <div key={f.type} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
            <p className="font-bold text-slate-800">{f.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 mb-4">{f.desc}</p>
            <div className="mt-auto">
              {f.available && jobId ? (
                <a
                  href={`${apiBase}/api/download/${jobId}/${f.type}`}
                  download
                  className={cn(
                    buttonVariants(),
                    "w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
                  )}
                >
                  <Download className="w-4 h-4 mr-2" /> Download {f.ext}
                </a>
              ) : (
                <Button disabled className="w-full">
                  Not generated
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
