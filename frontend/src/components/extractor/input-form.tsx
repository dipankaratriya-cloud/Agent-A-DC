"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2 } from "lucide-react";

const EXAMPLES = [
  { label: "French Open Data", value: "https://www.data.gouv.fr" },
  { label: "Norway Statistics", value: "https://www.ssb.no/en" },
  { label: "Statistics Canada", value: "https://www.statcan.gc.ca" },
  { label: "US Census Bureau", value: "https://data.census.gov" },
];

interface InputFormProps {
  isRunning: boolean;
  initialSource?: string;
  onSubmit: (sourceName: string, description: string) => void;
}

export function InputForm({ isRunning, initialSource, onSubmit }: InputFormProps) {
  const [source, setSource] = useState(initialSource || "");
  const [description, setDescription] = useState("");
  const [examplesOpen, setExamplesOpen] = useState(false);

  useEffect(() => {
    if (initialSource) setSource(initialSource);
  }, [initialSource]);

  const handleSubmit = () => {
    if (!source.trim()) return;
    onSubmit(source.trim(), description.trim());
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <p className="font-semibold text-slate-800 mb-0.5">Data Source</p>
        <p className="text-sm text-slate-400 mb-4">
          Enter a dataset portal name or direct URL to extract metadata
        </p>

        <Input
          placeholder="e.g., Statistics Canada, or https://statcan.gc.ca"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isRunning && handleSubmit()}
          className="mb-3"
        />

        <Textarea
          placeholder="What specific information are you looking for... (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mb-3 resize-none"
        />

        <Collapsible open={examplesOpen} onOpenChange={setExamplesOpen}>
          <CollapsibleTrigger className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors mb-2">
            Quick start — example sources
            <ChevronDown
              className={`ml-1 w-4 h-4 transition-transform ${examplesOpen ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {EXAMPLES.map((ex) => (
                <Button
                  key={ex.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSource(ex.value)}
                >
                  {ex.label}
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={handleSubmit}
          disabled={!source.trim() || isRunning}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/35"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            "Extract Metadata"
          )}
        </Button>
      </div>
    </div>
  );
}
