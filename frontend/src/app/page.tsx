"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { InputForm } from "@/components/extractor/input-form";
import { ProgressBanner } from "@/components/extractor/progress-banner";
import { ResultTabs } from "@/components/extractor/result-tabs";
import { EntitySearch } from "@/components/entity/entity-search";
import { ValidationConfigBuilder } from "@/components/validation/validation-config-builder";
import { usePipeline } from "@/hooks/use-pipeline";
import { checkHealth } from "@/lib/api";
import { Clock, Hash, MessageSquare, Cpu, X } from "lucide-react";

export default function Home() {
  const [apiKeyOk, setApiKeyOk] = useState<boolean | null>(null);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const pipeline = usePipeline();

  useEffect(() => {
    checkHealth()
      .then((h) => {
        setBackendAvailable(true);
        setApiKeyOk(h.api_key_configured);
      })
      .catch(() => {
        setBackendAvailable(false);
        setApiKeyOk(false);
      });
  }, []);

  const handleSubmit = useCallback(
    (sourceName: string, description: string) => {
      setHistory((prev) =>
        prev.includes(sourceName) ? prev : [...prev, sourceName]
      );
      pipeline.run(sourceName, description);
    },
    [pipeline]
  );

  const handleSelectHistory = useCallback((source: string) => {
    setSelectedSource(source);
  }, []);

  const workerCount = pipeline.results?.worker_results.length || 0;
  const tokenUsage = pipeline.results?.token_usage;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        apiKeyOk={apiKeyOk}
        history={history}
        onSelectHistory={handleSelectHistory}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((p) => !p)}
      />

      <main className="flex-1 overflow-y-auto">
        <div className={`mx-auto px-6 py-6 transition-all duration-300 ${sidebarCollapsed ? "max-w-full" : "max-w-5xl"}`}>
          <Header />

          {backendAvailable === false && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 mb-4 flex items-start gap-2">
              <span className="text-lg leading-none">i</span>
              <div>
                <p className="font-semibold">Backend not connected</p>
                <p className="text-blue-600 mt-0.5">
                  The Validation Config Builder is fully available. Metadata extraction and entity search require the backend server.
                </p>
              </div>
            </div>
          )}

          <Tabs defaultValue={backendAvailable === false ? "validation" : "extractor"} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="extractor">Metadata Extractor</TabsTrigger>
              <TabsTrigger value="entity">Entity Properties</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="entity">
              {backendAvailable === false ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-lg font-semibold text-slate-500 mb-1">Backend Required</p>
                  <p className="text-sm">Entity search needs the backend server to query Data Commons.</p>
                </div>
              ) : (
                <EntitySearch />
              )}
            </TabsContent>

            <TabsContent value="validation">
              <ValidationConfigBuilder jobId={pipeline.jobId} />
            </TabsContent>

            <TabsContent value="extractor">
              {backendAvailable === false ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-lg font-semibold text-slate-500 mb-1">Backend Required</p>
                  <p className="text-sm">Metadata extraction needs the backend server running with a GROQ_API_KEY.</p>
                </div>
              ) : (
              <>
              {apiKeyOk === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4">
                  No GROQ_API_KEY configured. Set it in your <code>.env</code> file.
                </div>
              )}

              <InputForm
                isRunning={pipeline.status === "running"}
                initialSource={selectedSource}
                onSubmit={handleSubmit}
              />

              {/* Progress */}
              {pipeline.status === "running" && pipeline.progress && (
                <div className="mt-4">
                  <ProgressBanner
                    progress={pipeline.progress}
                    resolvedUrl={pipeline.resolvedUrl}
                    error={null}
                  />
                </div>
              )}

              {/* Error */}
              {pipeline.status === "error" && (
                <div className="mt-4">
                  <ProgressBanner
                    progress={pipeline.progress || { step: 0, total: 4, message: "" }}
                    resolvedUrl={pipeline.resolvedUrl}
                    error={pipeline.error}
                  />
                </div>
              )}

              {/* Results */}
              {pipeline.status === "completed" && pipeline.results && (
                <div className="mt-4 space-y-4">
                  {/* Success banner */}
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-600 text-xl">&#10003;</span>
                      <span className="font-semibold text-emerald-800">
                        Pipeline completed in {pipeline.elapsed.toFixed(0)}s
                      </span>
                      <span className="text-emerald-600 text-sm">
                        | {workerCount} checklist items processed
                      </span>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-5 gap-3">
                    <MetricCard
                      icon={Hash}
                      label="Total Tokens"
                      value={(tokenUsage?.total || 0).toLocaleString()}
                    />
                    <MetricCard
                      icon={MessageSquare}
                      label="Prompt Tokens"
                      value={(tokenUsage?.prompt || 0).toLocaleString()}
                    />
                    <MetricCard
                      icon={Cpu}
                      label="Completion Tokens"
                      value={(tokenUsage?.completion || 0).toLocaleString()}
                    />
                    <MetricCard
                      icon={Clock}
                      label="Processing Time"
                      value={`${pipeline.elapsed.toFixed(0)}s`}
                    />
                    <div className="flex items-end justify-center pb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={pipeline.clear}
                        className="text-slate-500"
                      >
                        <X className="w-4 h-4 mr-1" /> Clear
                      </Button>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  <ResultTabs results={pipeline.results} jobId={pipeline.jobId} />
                </div>
              )}
              </>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400">
              Powered by <span className="font-semibold text-slate-500">Groq Compound</span> +{" "}
              <span className="font-semibold text-slate-500">LangGraph</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
      <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
