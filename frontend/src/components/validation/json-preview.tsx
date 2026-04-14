"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, Copy, Check, Save } from "lucide-react";
import type { ValidationConfig } from "@/lib/api";

interface JsonPreviewProps {
  config: ValidationConfig;
  jobId?: string | null;
  onSaveToServer?: () => void;
  saving?: boolean;
}

export function JsonPreview({ config, jobId, onSaveToServer, saving }: JsonPreviewProps) {
  const [copied, setCopied] = useState(false);
  const jsonStr = JSON.stringify(config, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "validation_config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sticky top-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Config Preview</CardTitle>
          <CardDescription>
            {config.rules.length} rule{config.rules.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-900 text-emerald-400 text-xs rounded-lg p-4 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap">
            {jsonStr}
          </pre>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            onClick={handleDownload}
            className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Config
          </Button>
          <Button variant="outline" onClick={handleCopy} className="px-3">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          {jobId && onSaveToServer && (
            <Button variant="outline" onClick={onSaveToServer} disabled={saving} className="px-3">
              <Save className="w-4 h-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
