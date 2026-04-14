"use client";

import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle } from "lucide-react";
import type { JobStatus } from "@/lib/api";

interface ProgressBannerProps {
  progress: JobStatus["progress"];
  resolvedUrl: string | null;
  error: string | null;
}

export function ProgressBanner({ progress, resolvedUrl, error }: ProgressBannerProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-semibold">Pipeline failed:</span>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  const pct = progress ? (progress.step / progress.total) * 100 : 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
      {resolvedUrl && (
        <p className="text-sm text-blue-700 mb-2">
          <span className="font-semibold">URL:</span>{" "}
          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {resolvedUrl}
          </a>
        </p>
      )}
      <div className="flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-800 mb-1">
            {progress?.message || "Starting..."}
          </p>
          <Progress value={pct} className="h-2" />
        </div>
        <span className="text-xs text-blue-600 font-semibold">
          {progress?.step}/{progress?.total}
        </span>
      </div>
    </div>
  );
}
