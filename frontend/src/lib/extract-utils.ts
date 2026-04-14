import type { WorkerResult } from "./api";

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>"')\]\},]+/g);
  return matches ? [...new Set(matches)] : [];
}

export function isNotFound(text: string): boolean {
  const lower = text.toLowerCase();
  return ["not found", "not available", "could not find", "unable to"].some((p) =>
    lower.includes(p)
  );
}

export function getWorker(results: WorkerResult[], prefix: string): WorkerResult | undefined {
  return results.find((wr) => wr.name === prefix);
}

export function getPreview(resultText: string): string {
  for (const line of resultText.split("\n")) {
    const trimmed = line.trim().replace(/^[-\u2022* ]+/, "");
    if (trimmed.includes(":") && trimmed.length < 250) {
      const [key, ...rest] = trimmed.split(":");
      const val = rest.join(":").trim();
      const keyL = key.trim().toLowerCase();
      if (
        val &&
        !["evidence", "basis", "output format", "output", "note", "steps", "url to visit"].includes(keyL)
      ) {
        return val.slice(0, 200);
      }
    } else if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("You ") && trimmed.length > 10) {
      return trimmed.slice(0, 200);
    }
  }
  return resultText.slice(0, 200) || "\u2014";
}

export interface DatasetLink {
  url: string;
  domain: string;
  title: string;
  description: string;
  category: "Dataset" | "License/Terms" | "Documentation" | "Other";
}

export function extractDatasetLinks(content: string): DatasetLink[] {
  if (!content) return [];
  const links: DatasetLink[] = [];
  const seen = new Set<string>();

  // Markdown table links
  const tableRegex = /\|\s*([^|]+)\s*\|\s*(https?:\/\/[^\s|]+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(content))) {
    const url = match[2].trim().replace(/[.,;:!?]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({
      url,
      domain: new URL(url).hostname,
      title: match[1].trim(),
      description: match[3].trim(),
      category: "Dataset",
    });
  }

  // [text](url) links
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  while ((match = mdRegex.exec(content))) {
    const url = match[2].trim().replace(/[.,;:!?]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    let category: DatasetLink["category"] = "Dataset";
    const lower = url.toLowerCase();
    if (["license", "terms", "legal"].some((k) => lower.includes(k))) category = "License/Terms";
    else if (["doc", "guide", "help", "api"].some((k) => lower.includes(k)))
      category = "Documentation";
    links.push({ url, domain: new URL(url).hostname, title: match[1].trim(), description: "", category });
  }

  // Bare URLs
  const bareRegex = /(?<!\()(https?:\/\/[^\s<>"')\]\}|]+)/g;
  while ((match = bareRegex.exec(content))) {
    const url = match[1].replace(/[.,;:!?]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const title = parts.length
        ? decodeURIComponent(parts[parts.length - 1]).replace(/[-_]/g, " ").slice(0, 50)
        : parsed.hostname;
      let category: DatasetLink["category"] = "Other";
      const lower = url.toLowerCase();
      if (["license", "terms", "legal"].some((k) => lower.includes(k))) category = "License/Terms";
      else if (["dataset", "data", "table", "download", "csv"].some((k) => lower.includes(k)))
        category = "Dataset";
      else if (["doc", "guide", "help"].some((k) => lower.includes(k))) category = "Documentation";
      links.push({ url, domain: parsed.hostname, title, description: "", category });
    } catch {
      // skip invalid URLs
    }
  }

  return links;
}

export interface ParsedDataset {
  name: string;
  url: string;
  format: string;
  downloadable: boolean;
  download_steps: string;
}

export function parseDatasets(raw: string): ParsedDataset[] {
  try {
    let cleaned = raw;
    if (cleaned.includes("```json")) {
      cleaned = cleaned.split("```json")[1].split("```")[0];
    } else if (cleaned.includes("```")) {
      cleaned = cleaned.split("```")[1].split("```")[0];
    }
    const parsed = JSON.parse(cleaned.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback
  }
  return [];
}

export const CHECKLIST_SECTIONS = [
  {
    prefix: "A",
    title: "A. Initial Data Source Assessment",
    items: [
      { id: "A1", label: "Core Attributes Present?", hint: "Place, Period, Variable, Values" },
      { id: "A2", label: "Data Vertical Identified?", hint: "e.g., Education, Health" },
      { id: "A3", label: "Geo Level Identified?", hint: "Country, AA1, AA2" },
      { id: "A4", label: "License Public & Permissible?", hint: "e.g., CC BY 4.0" },
      { id: "A5", label: "License URL Documented?", hint: "" },
    ],
  },
  {
    prefix: "B",
    title: "B. Source Format & Acquisition Plan",
    items: [
      { id: "B6", label: "Parent/Provenance URL", hint: "" },
      { id: "B6.1", label: "Child Source URL(s)", hint: "Direct download links" },
      { id: "B7", label: "Source Format", hint: "CSV, API, XLS" },
      { id: "B8", label: "Programmatic Access?", hint: "Yes/No" },
      { id: "B9", label: "Rate Limits?", hint: "Yes/No" },
      { id: "B10", label: "Sample Source URL", hint: "" },
      { id: "B10.1", label: "Metadata Documentation URLs", hint: "" },
      { id: "B11", label: "Download Steps", hint: "" },
    ],
  },
  {
    prefix: "C",
    title: "C. Data Availability & Periodicity",
    items: [
      { id: "C12", label: "Min Date", hint: "" },
      { id: "C13", label: "Max Date", hint: "" },
      { id: "C14", label: "Periodicity", hint: "Annually, Monthly, etc." },
      { id: "C14.1", label: "Date Resolution", hint: "ISO YYYY-MM-DD" },
      { id: "C14.2", label: "Place Resolution", hint: "Code vs Text" },
      { id: "C15", label: "Refresh Frequency", hint: "" },
      { id: "C16", label: "Last Refresh Date", hint: "" },
      { id: "C17", label: "Next Expected Refresh", hint: "" },
    ],
  },
] as const;
