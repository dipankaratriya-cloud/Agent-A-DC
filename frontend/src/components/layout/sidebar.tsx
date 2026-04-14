"use client";

import { CheckCircle2, XCircle, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const PIPELINE_STEPS = [
  { num: "1", name: "Scraper", desc: "Browser automation" },
  { num: "2", name: "Workers", desc: "22 text-only agents" },
  { num: "3", name: "Import Doc", desc: "DOCX generation" },
  { num: "4", name: "Croissant", desc: "JSON-LD metadata" },
];

interface SidebarProps {
  apiKeyOk: boolean | null;
  history: string[];
  onSelectHistory: (source: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ apiKeyOk, history, onSelectHistory, collapsed, onToggleCollapsed }: SidebarProps) {

  return (
    <aside
      className={`border-r bg-white flex flex-col shrink-0 hidden lg:flex transition-all duration-300 overflow-hidden ${
        collapsed ? "w-14 p-2" : "w-72 p-5"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={onToggleCollapsed}
        className="self-end p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors mb-2"
      >
        {collapsed ? (
          <PanelLeftOpen className="w-5 h-5" />
        ) : (
          <PanelLeftClose className="w-5 h-5" />
        )}
      </button>

      {collapsed ? (
        /* Collapsed: show only step icons */
        <div className="flex flex-col items-center gap-3 mt-2">
          {apiKeyOk === true && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {apiKeyOk === false && <XCircle className="w-5 h-5 text-red-500" />}
          {apiKeyOk === null && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
          <div className="w-6 border-t border-slate-200" />
          {PIPELINE_STEPS.map((s) => (
            <div
              key={s.num}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold"
              title={s.name}
            >
              {s.num}
            </div>
          ))}
        </div>
      ) : (
        /* Expanded: full sidebar */
        <div className="flex flex-col gap-6 overflow-y-auto">
          {/* API key status */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
              Configuration
            </p>
            {apiKeyOk === null ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking...
              </div>
            ) : apiKeyOk ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4" /> API Key loaded
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <XCircle className="w-4 h-4" /> No GROQ_API_KEY
              </div>
            )}
          </div>

          {/* Pipeline architecture */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-3">
              Pipeline Architecture
            </p>
            <div className="space-y-2">
              {PIPELINE_STEPS.map((s) => (
                <div
                  key={s.num}
                  className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {s.num}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800 leading-tight">{s.name}</div>
                    <div className="text-xs text-slate-400">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent sources */}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
              Recent Sources
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-slate-400">No sources yet</p>
            ) : (
              <div className="space-y-1">
                {[...history].reverse().slice(0, 5).map((h, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectHistory(h)}
                    className="w-full text-left text-sm text-slate-600 hover:text-indigo-600 hover:bg-slate-50 px-3 py-2 rounded-lg truncate transition-colors"
                  >
                    {h.length > 40 ? h.slice(0, 40) + "..." : h}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
