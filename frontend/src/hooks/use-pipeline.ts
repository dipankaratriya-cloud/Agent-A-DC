"use client";

import { useState, useCallback, useRef } from "react";
import {
  startExtraction,
  getResults,
  createEventSource,
  type PipelineResults,
  type JobStatus,
} from "@/lib/api";

export interface PipelineState {
  status: "idle" | "running" | "completed" | "error";
  jobId: string | null;
  progress: JobStatus["progress"] | null;
  resolvedUrl: string | null;
  results: PipelineResults | null;
  error: string | null;
  elapsed: number;
}

export function usePipeline() {
  const [state, setState] = useState<PipelineState>({
    status: "idle",
    jobId: null,
    progress: null,
    resolvedUrl: null,
    results: null,
    error: null,
    elapsed: 0,
  });

  const startTimeRef = useRef<number>(0);
  const esRef = useRef<EventSource | null>(null);

  const run = useCallback(async (sourceName: string, description: string) => {
    // Clean up previous SSE
    esRef.current?.close();

    setState({
      status: "running",
      jobId: null,
      progress: { step: 0, total: 4, message: "Starting..." },
      resolvedUrl: null,
      results: null,
      error: null,
      elapsed: 0,
    });

    startTimeRef.current = Date.now();

    try {
      const { job_id } = await startExtraction({ source_name: sourceName, description });
      setState((prev) => ({ ...prev, jobId: job_id }));

      // Listen via SSE
      const es = createEventSource(job_id);
      esRef.current = es;

      es.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        const elapsed = (Date.now() - startTimeRef.current) / 1000;

        if (data.url) {
          setState((prev) => ({ ...prev, resolvedUrl: data.url }));
        }

        if (data.status === "completed") {
          es.close();
          try {
            const results = await getResults(job_id);
            setState((prev) => ({
              ...prev,
              status: "completed",
              progress: data.progress,
              results,
              elapsed,
            }));
          } catch (err) {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: err instanceof Error ? err.message : "Failed to fetch results",
              elapsed,
            }));
          }
        } else if (data.status === "error") {
          es.close();
          setState((prev) => ({
            ...prev,
            status: "error",
            progress: data.progress,
            error: data.error,
            elapsed,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            progress: data.progress,
            elapsed,
          }));
        }
      };

      es.onerror = () => {
        es.close();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Connection lost. The pipeline may still be running.",
        }));
      };
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to start extraction",
      }));
    }
  }, []);

  const clear = useCallback(() => {
    esRef.current?.close();
    setState({
      status: "idle",
      jobId: null,
      progress: null,
      resolvedUrl: null,
      results: null,
      error: null,
      elapsed: 0,
    });
  }, []);

  return { ...state, run, clear };
}
