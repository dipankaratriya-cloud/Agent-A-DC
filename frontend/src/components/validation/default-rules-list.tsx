"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VALIDATORS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ValidatorDef,
} from "@/lib/validation-defaults";

export interface RuleState {
  rule_id: string;
  validator: string;
  scope: { variables: { dcids: string[]; regex: string[]; contains_all: string[] } };
  params: Record<string, unknown>;
  enabled: boolean;
}

interface DefaultRulesListProps {
  rules: RuleState[];
  onToggle: (ruleId: string) => void;
  onUpdateParam: (ruleId: string, paramKey: string, value: unknown) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  stats: { bg: "from-blue-50 to-blue-100", text: "text-blue-800", badge: "bg-blue-100 text-blue-700" },
  lint: { bg: "from-amber-50 to-amber-100", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" },
  differ: { bg: "from-purple-50 to-purple-100", text: "text-purple-800", badge: "bg-purple-100 text-purple-700" },
};

export function DefaultRulesList({ rules, onToggle, onUpdateParam }: DefaultRulesListProps) {
  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map((cat) => {
        const catRules = rules.filter((r) => {
          const def = DEFAULT_VALIDATORS.find((d) => d.id === r.rule_id);
          return def?.category === cat;
        });
        const enabledCount = catRules.filter((r) => r.enabled).length;
        const colors = CATEGORY_COLORS[cat];

        return (
          <div key={cat}>
            <div
              className={cn(
                "bg-gradient-to-r border-l-4 border-indigo-600 rounded-r-xl px-4 py-3 mb-3 flex justify-between items-center",
                colors.bg
              )}
            >
              <span className={cn("font-bold", colors.text)}>
                {CATEGORY_LABELS[cat]}
              </span>
              <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                {enabledCount}/{catRules.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {catRules.map((rule) => {
                const def = DEFAULT_VALIDATORS.find((d) => d.id === rule.rule_id);
                if (!def) return null;
                return (
                  <RuleCard
                    key={rule.rule_id}
                    rule={rule}
                    def={def}
                    onToggle={() => onToggle(rule.rule_id)}
                    onUpdateParam={(key, val) => onUpdateParam(rule.rule_id, key, val)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RuleCard({
  rule,
  def,
  onToggle,
  onUpdateParam,
}: {
  rule: RuleState;
  def: ValidatorDef;
  onToggle: () => void;
  onUpdateParam: (key: string, val: unknown) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasParams = def.params.length > 0;
  const colors = CATEGORY_COLORS[def.category];

  return (
    <div
      className={cn(
        "border rounded-xl p-3 transition-all",
        rule.enabled
          ? "bg-emerald-50/50 border-emerald-200"
          : "bg-slate-50 border-slate-200 opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={onToggle}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-slate-800">{def.label}</span>
          <span className="text-xs text-slate-400 ml-2 font-mono">{def.validator}</span>
          <p className="text-xs text-slate-500 mt-0.5">{def.description}</p>
        </div>

        <Badge className={cn("text-[0.65rem]", colors.badge)}>{def.category}</Badge>

        {hasParams && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-slate-400 transition-transform",
                expanded && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {hasParams && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-3">
              {def.params.map((p) => (
                <div key={p.key}>
                  <label className="text-xs text-slate-500 font-medium mb-1 block">
                    {p.label}
                    {p.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {p.type === "string" ? (
                    <Input
                      value={(rule.params[p.key] as string) ?? ""}
                      onChange={(e) => onUpdateParam(p.key, e.target.value)}
                      placeholder={`Enter ${p.label.toLowerCase()}`}
                      className="h-8 text-sm"
                    />
                  ) : p.type === "list" ? (
                    <Input
                      value={
                        Array.isArray(rule.params[p.key])
                          ? (rule.params[p.key] as string[]).join(", ")
                          : ""
                      }
                      onChange={(e) =>
                        onUpdateParam(
                          p.key,
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="Comma-separated values"
                      className="h-8 text-sm"
                    />
                  ) : (
                    <Input
                      type="number"
                      value={rule.params[p.key] != null ? String(rule.params[p.key]) : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          onUpdateParam(p.key, null);
                        } else {
                          onUpdateParam(
                            p.key,
                            p.type === "float" ? parseFloat(val) : parseInt(val, 10)
                          );
                        }
                      }}
                      placeholder={`Enter ${p.label.toLowerCase()}`}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
