const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ExtractRequest {
  source_name: string;
  description?: string;
}

export interface JobStatus {
  id: string;
  status: "running" | "completed" | "error";
  url: string | null;
  progress: { step: number; total: number; message: string };
  error: string | null;
}

export interface WorkerResult {
  name: string;
  description: string;
  result: string;
  success: boolean;
}

export interface CountryDcid {
  name: string;
  dcid: string;
}

export interface PipelineResults {
  url: string;
  scraped_data: Record<string, unknown>;
  scraped_data_path: string;
  worker_results: WorkerResult[];
  import_doc_path: string | null;
  croissant_path: string | null;
  token_usage: { prompt: number; completion: number; total: number };
  country_dcids: CountryDcid[];
}

export interface SearchVariableResult {
  dcid: string;
  properties: Record<string, string[]>;
  url: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export async function checkHealth() {
  return apiFetch<{ status: string; api_key_configured: boolean }>("/api/health");
}

export async function startExtraction(req: ExtractRequest) {
  return apiFetch<{ job_id: string }>("/api/extract", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getJobStatus(jobId: string) {
  return apiFetch<JobStatus>(`/api/status/${jobId}`);
}

export async function getResults(jobId: string) {
  return apiFetch<PipelineResults>(`/api/results/${jobId}`);
}

export function getDownloadUrl(jobId: string, fileType: "docx" | "croissant" | "raw") {
  return `${API_BASE}/api/download/${jobId}/${fileType}`;
}

export function createEventSource(jobId: string) {
  return new EventSource(`${API_BASE}/api/stream/${jobId}`);
}

export async function searchVariables(query: string) {
  return apiFetch<{ success: boolean; results?: SearchVariableResult[]; error?: string }>(
    "/api/search-variables",
    { method: "POST", body: JSON.stringify({ query }) }
  );
}

// ─── Validation Config ───

export interface ValidationRule {
  rule_id: string;
  validator: string;
  scope?: { variables: { dcids: string[]; regex: string[]; contains_all: string[] } };
  params: Record<string, unknown>;
}

export interface ValidationConfig {
  schema_version: string;
  rules: ValidationRule[];
}

export async function saveValidationConfig(config: ValidationConfig, jobId?: string | null) {
  return apiFetch<ValidationConfig>("/api/validation-config", {
    method: "POST",
    body: JSON.stringify({ ...config, job_id: jobId }),
  });
}

export function getOutputUrl(jobId: string) {
  return `${API_BASE}/api/output/${jobId}`;
}
