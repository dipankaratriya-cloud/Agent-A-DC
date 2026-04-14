"use client";

import { useState, useMemo, useCallback } from "react";
import { ModeToggle } from "./mode-toggle";
import { DefaultRulesList, type RuleState } from "./default-rules-list";
import { CustomRulesList } from "./custom-rules-list";
import { JsonPreview } from "./json-preview";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_VALIDATORS } from "@/lib/validation-defaults";
import { saveValidationConfig, type ValidationConfig } from "@/lib/api";
import { FileJson } from "lucide-react";

interface ValidationConfigBuilderProps {
  jobId?: string | null;
}

function buildDefaultRules(): RuleState[] {
  return DEFAULT_VALIDATORS.map((def) => ({
    rule_id: def.id,
    validator: def.validator,
    scope: { variables: { dcids: [], regex: [], contains_all: [] } },
    params: Object.fromEntries(
      def.params.map((p) => [p.key, p.defaultValue])
    ),
    enabled: def.defaultEnabled,
  }));
}

export function ValidationConfigBuilder({ jobId }: ValidationConfigBuilderProps) {
  const [mode, setMode] = useState<"default" | "custom">("default");
  const [defaultRules, setDefaultRules] = useState<RuleState[]>(buildDefaultRules);
  const [customRules, setCustomRules] = useState<RuleState[]>([]);
  const [saving, setSaving] = useState(false);

  const activeRules = mode === "default" ? defaultRules : customRules;

  const computedConfig = useMemo<ValidationConfig>(() => {
    const enabledRules = activeRules.filter((r) => r.enabled);
    return {
      schema_version: "1.0",
      rules: enabledRules.map((r) => {
        const hasScope =
          r.scope.variables.dcids.length > 0 ||
          r.scope.variables.regex.length > 0 ||
          r.scope.variables.contains_all.length > 0;

        // Clean params: remove null/undefined/empty values
        const cleanParams: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r.params)) {
          if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
            cleanParams[k] = v;
          }
        }

        return {
          rule_id: r.rule_id,
          validator: r.validator,
          ...(hasScope ? { scope: r.scope } : {}),
          params: cleanParams,
        };
      }),
    };
  }, [activeRules]);

  const handleToggle = useCallback((ruleId: string) => {
    setDefaultRules((prev) =>
      prev.map((r) => (r.rule_id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  }, []);

  const handleUpdateParam = useCallback(
    (ruleId: string, paramKey: string, value: unknown) => {
      setDefaultRules((prev) =>
        prev.map((r) =>
          r.rule_id === ruleId
            ? { ...r, params: { ...r.params, [paramKey]: value } }
            : r
        )
      );
    },
    []
  );

  const handleAddCustom = useCallback((rule: RuleState) => {
    setCustomRules((prev) => {
      // Prevent duplicate rule_id
      if (prev.some((r) => r.rule_id === rule.rule_id)) {
        const uniqueId = `${rule.rule_id}_${Date.now()}`;
        return [...prev, { ...rule, rule_id: uniqueId }];
      }
      return [...prev, rule];
    });
  }, []);

  const handleRemoveCustom = useCallback((ruleId: string) => {
    setCustomRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
  }, []);

  const handleUpdateCustom = useCallback(
    (ruleId: string, updates: Partial<RuleState>) => {
      setCustomRules((prev) =>
        prev.map((r) => (r.rule_id === ruleId ? { ...r, ...updates } : r))
      );
    },
    []
  );

  const handleSaveToServer = useCallback(async () => {
    setSaving(true);
    try {
      await saveValidationConfig(computedConfig, jobId);
    } catch {
      // Silently handle - the file still downloads
    } finally {
      setSaving(false);
    }
  }, [computedConfig, jobId]);

  const enabledCount = activeRules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <FileJson className="w-6 h-6 text-indigo-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Validation Config Builder</h2>
            <p className="text-sm text-slate-400">
              Configure validation rules for the Import Validation Framework
            </p>
          </div>
          {jobId && (
            <Badge className="ml-auto bg-emerald-100 text-emerald-700">
              Job: {jobId}
            </Badge>
          )}
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Main layout: rules + preview */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: rules list */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-800">
              {mode === "default" ? "Default Validation Rules" : "Custom Validation Rules"}
            </h3>
            <Badge variant="secondary">{enabledCount} active</Badge>
          </div>

          {mode === "default" ? (
            <DefaultRulesList
              rules={defaultRules}
              onToggle={handleToggle}
              onUpdateParam={handleUpdateParam}
            />
          ) : (
            <CustomRulesList
              rules={customRules}
              onAdd={handleAddCustom}
              onRemove={handleRemoveCustom}
              onUpdate={handleUpdateCustom}
            />
          )}
        </div>

        {/* Right: JSON preview */}
        <div className="lg:col-span-2">
          <JsonPreview
            config={computedConfig}
            jobId={jobId}
            onSaveToServer={handleSaveToServer}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
}
