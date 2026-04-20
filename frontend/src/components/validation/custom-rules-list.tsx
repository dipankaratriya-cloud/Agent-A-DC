"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, X, ChevronDown, PenLine, MessageSquareText, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_VALIDATORS, VALIDATOR_NAMES } from "@/lib/validation-defaults";
import type { RuleState } from "./default-rules-list";

interface CustomRulesListProps {
  rules: RuleState[];
  onAdd: (rule: RuleState) => void;
  onRemove: (ruleId: string) => void;
  onUpdate: (ruleId: string, updates: Partial<RuleState>) => void;
}

const CUSTOM_SENTINEL = "__CUSTOM__";

export function CustomRulesList({ rules, onAdd, onRemove, onUpdate }: CustomRulesListProps) {
  const [selectedValidator, setSelectedValidator] = useState("");
  const [customValidatorName, setCustomValidatorName] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [customParamsRaw, setCustomParamsRaw] = useState("");
  const [scopeDcids, setScopeDcids] = useState("");
  const [scopeRegex, setScopeRegex] = useState("");
  const [scopeContainsAll, setScopeContainsAll] = useState("");
  const [naturalLanguageRule, setNaturalLanguageRule] = useState("");

  const isCustom = selectedValidator === CUSTOM_SENTINEL;
  const selectedDef = isCustom
    ? null
    : DEFAULT_VALIDATORS.find((d) => d.validator === selectedValidator);

  const handleValidatorChange = (validator: string) => {
    setSelectedValidator(validator);
    if (validator === CUSTOM_SENTINEL) {
      setRuleId("");
      setCustomValidatorName("");
      setParams({});
      setCustomParamsRaw("");
    } else {
      const def = DEFAULT_VALIDATORS.find((d) => d.validator === validator);
      setRuleId(def?.id ?? validator.toLowerCase().replace(/_/g, "_"));
      setParams({});
      setCustomParamsRaw("");
      setCustomValidatorName("");
    }
  };

  const resolvedValidator = isCustom ? customValidatorName.trim() : selectedValidator;

  const handleAdd = () => {
    if (!resolvedValidator || !ruleId.trim()) return;

    const cleanParams: Record<string, unknown> = {};

    if (isCustom) {
      // Parse free-form params JSON
      if (customParamsRaw.trim()) {
        try {
          const parsed = JSON.parse(customParamsRaw.trim());
          if (typeof parsed === "object" && parsed !== null) {
            Object.assign(cleanParams, parsed);
          }
        } catch {
          // If not valid JSON, treat each line as key=value
          for (const line of customParamsRaw.split("\n")) {
            const [key, ...rest] = line.split("=");
            if (key?.trim() && rest.length > 0) {
              const val = rest.join("=").trim();
              const num = Number(val);
              cleanParams[key.trim()] = isNaN(num) ? val : num;
            }
          }
        }
      }
    } else if (selectedDef) {
      for (const p of selectedDef.params) {
        const val = params[p.key];
        if (val === undefined || val === "") continue;
        if (p.type === "int") cleanParams[p.key] = parseInt(val, 10);
        else if (p.type === "float") cleanParams[p.key] = parseFloat(val);
        else if (p.type === "list")
          cleanParams[p.key] = val.split(",").map((s) => s.trim()).filter(Boolean);
        else cleanParams[p.key] = val;
      }
    }

    // Add natural language description as a param if provided
    if (naturalLanguageRule.trim()) {
      cleanParams["_description"] = naturalLanguageRule.trim();
    }

    const scope = {
      variables: {
        dcids: scopeDcids.split(",").map((s) => s.trim()).filter(Boolean),
        regex: scopeRegex.split(",").map((s) => s.trim()).filter(Boolean),
        contains_all: scopeContainsAll.split(",").map((s) => s.trim()).filter(Boolean),
      },
    };

    const hasScope =
      scope.variables.dcids.length > 0 ||
      scope.variables.regex.length > 0 ||
      scope.variables.contains_all.length > 0;

    onAdd({
      rule_id: ruleId.trim(),
      validator: resolvedValidator,
      scope: hasScope ? scope : { variables: { dcids: [], regex: [], contains_all: [] } },
      params: cleanParams,
      enabled: true,
    });

    // Reset form
    setSelectedValidator("");
    setCustomValidatorName("");
    setRuleId("");
    setParams({});
    setCustomParamsRaw("");
    setScopeDcids("");
    setScopeRegex("");
    setScopeContainsAll("");
    setNaturalLanguageRule("");
  };

  return (
    <div className="space-y-5">
      {/* Add rule form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h4 className="font-semibold text-sm text-slate-800 mb-4">Add New Rule</h4>

        {/* Validator selection */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">
              Validator Type
            </label>
            <select
              value={selectedValidator}
              onChange={(e) => handleValidatorChange(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a validator...</option>
              <option disabled className="text-xs text-slate-400">
                ── Built-in Validators ──
              </option>
              {VALIDATOR_NAMES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
              <option disabled className="text-xs text-slate-400">
                ──────────────────
              </option>
              <option value={CUSTOM_SENTINEL}>Custom (write your own)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">Rule ID</label>
            <Input
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              placeholder="e.g. check_my_rule"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Custom validator name (only when "Custom" is selected) */}
        {isCustom && (
          <div className="mb-3 p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <PenLine className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700">Custom Validator</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Validator Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={customValidatorName}
                  onChange={(e) => setCustomValidatorName(e.target.value)}
                  placeholder="e.g. MY_CUSTOM_CHECK"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Parameters (JSON or key=value)
                </label>
                <Textarea
                  value={customParamsRaw}
                  onChange={(e) => setCustomParamsRaw(e.target.value)}
                  placeholder={'{"threshold": 5}\nor\nthreshold=5\nmax_count=100'}
                  className="text-sm min-h-[80px] font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Built-in validator params */}
        {selectedDef && selectedDef.params.length > 0 && (
          <div className="mb-3">
            <label className="text-xs text-slate-500 font-medium mb-1 block">Parameters</label>
            <div className="grid grid-cols-2 gap-3">
              {selectedDef.params.map((p) => (
                <div key={p.key}>
                  <label className="text-xs text-slate-400 mb-0.5 block">
                    {p.label}
                    {p.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {p.type === "string" ? (
                    <Textarea
                      value={params[p.key] ?? ""}
                      onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
                      placeholder={`Enter ${p.label.toLowerCase()}`}
                      className="text-sm min-h-[60px]"
                    />
                  ) : (
                    <Input
                      type={p.type === "list" ? "text" : "number"}
                      value={params[p.key] ?? ""}
                      onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
                      placeholder={
                        p.type === "list"
                          ? "Comma-separated"
                          : `Enter ${p.label.toLowerCase()}`
                      }
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Natural language rule description (optional, always visible) */}
        <div className="mb-3 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquareText className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              Describe Rule in Natural Language (optional)
            </span>
          </div>
          <Textarea
            value={naturalLanguageRule}
            onChange={(e) => setNaturalLanguageRule(e.target.value)}
            placeholder="e.g. Make sure all percentage values are between 0 and 100, and flag any StatVar where the max value exceeds the threshold."
            className="text-sm min-h-[60px]"
          />
        </div>

        {/* Scope */}
        <Collapsible>
          <CollapsibleTrigger className="inline-flex items-center text-xs text-slate-400 hover:text-slate-600 mb-2 h-6 px-2 rounded hover:bg-slate-100 transition-colors">
            Scope (optional) <ChevronDown className="ml-1 w-3 h-3" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 mb-0.5 block">DCIDs</label>
                <Input
                  value={scopeDcids}
                  onChange={(e) => setScopeDcids(e.target.value)}
                  placeholder="Comma-separated"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-0.5 block">Regex</label>
                <Input
                  value={scopeRegex}
                  onChange={(e) => setScopeRegex(e.target.value)}
                  placeholder="Comma-separated"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-0.5 block">Contains All</label>
                <Input
                  value={scopeContainsAll}
                  onChange={(e) => setScopeContainsAll(e.target.value)}
                  placeholder="Comma-separated"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          onClick={handleAdd}
          disabled={!resolvedValidator || !ruleId.trim()}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Existing custom rules */}
      {rules.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No custom rules added yet. Use the form above to add validation rules.
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-slate-800">
            Custom Rules ({rules.length})
          </h4>
          {rules.map((rule) => (
            <CustomRuleCard
              key={rule.rule_id}
              rule={rule}
              onRemove={() => onRemove(rule.rule_id)}
              onUpdate={(updates) => onUpdate(rule.rule_id, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomRuleCard({
  rule,
  onRemove,
  onUpdate,
}: {
  rule: RuleState;
  onRemove: () => void;
  onUpdate: (updates: Partial<RuleState>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const isKnown = VALIDATOR_NAMES.includes(rule.validator);
  const description = rule.params._description as string | undefined;

  // Edit state, seeded from the rule when edit mode opens
  const [editValidator, setEditValidator] = useState(rule.validator);
  const [editParamsRaw, setEditParamsRaw] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScopeDcids, setEditScopeDcids] = useState("");
  const [editScopeRegex, setEditScopeRegex] = useState("");
  const [editScopeContainsAll, setEditScopeContainsAll] = useState("");
  const [parseError, setParseError] = useState("");

  const openEdit = () => {
    const { _description, ...rest } = rule.params;
    setEditValidator(rule.validator);
    setEditParamsRaw(
      Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : ""
    );
    setEditDescription(typeof _description === "string" ? _description : "");
    setEditScopeDcids(rule.scope.variables.dcids.join(", "));
    setEditScopeRegex(rule.scope.variables.regex.join(", "));
    setEditScopeContainsAll(rule.scope.variables.contains_all.join(", "));
    setParseError("");
    setEditing(true);
    setExpanded(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setParseError("");
  };

  const saveEdit = () => {
    const cleanParams: Record<string, unknown> = {};
    if (editParamsRaw.trim()) {
      try {
        const parsed = JSON.parse(editParamsRaw.trim());
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setParseError("Parameters must be a JSON object.");
          return;
        }
        Object.assign(cleanParams, parsed);
      } catch {
        setParseError("Parameters must be valid JSON.");
        return;
      }
    }
    if (editDescription.trim()) {
      cleanParams._description = editDescription.trim();
    }

    onUpdate({
      validator: editValidator.trim() || rule.validator,
      params: cleanParams,
      scope: {
        variables: {
          dcids: editScopeDcids.split(",").map((s) => s.trim()).filter(Boolean),
          regex: editScopeRegex.split(",").map((s) => s.trim()).filter(Boolean),
          contains_all: editScopeContainsAll
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
    });
    setEditing(false);
    setParseError("");
  };

  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-slate-800">{rule.rule_id}</span>
          <Badge
            className={cn(
              "ml-2 text-[0.65rem]",
              isKnown
                ? "bg-indigo-100 text-indigo-700"
                : "bg-purple-100 text-purple-700"
            )}
          >
            {rule.validator}
          </Badge>
          {!isKnown && (
            <Badge className="ml-1 bg-purple-50 text-purple-500 text-[0.6rem]">
              custom
            </Badge>
          )}
        </div>

        {!editing && (
          <button
            onClick={openEdit}
            className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
            aria-label="Edit rule"
            title="Edit rule"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

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

        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {description && !editing && (
        <p className="mt-1.5 text-xs text-amber-600 italic bg-amber-50 px-2 py-1 rounded">
          {description}
        </p>
      )}

      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleContent>
          {editing ? (
            <div className="mt-3 space-y-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Validator
                </label>
                <Input
                  value={editValidator}
                  onChange={(e) => setEditValidator(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Parameters (JSON object)
                </label>
                <Textarea
                  value={editParamsRaw}
                  onChange={(e) => setEditParamsRaw(e.target.value)}
                  placeholder='{"threshold": 5}'
                  className="text-sm min-h-[90px] font-mono"
                />
                {parseError && (
                  <p className="text-xs text-red-500 mt-1">{parseError}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">
                  Description (optional)
                </label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-sm min-h-[50px]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-0.5 block">DCIDs</label>
                  <Input
                    value={editScopeDcids}
                    onChange={(e) => setEditScopeDcids(e.target.value)}
                    placeholder="Comma-separated"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-0.5 block">Regex</label>
                  <Input
                    value={editScopeRegex}
                    onChange={(e) => setEditScopeRegex(e.target.value)}
                    placeholder="Comma-separated"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-0.5 block">
                    Contains All
                  </label>
                  <Input
                    value={editScopeContainsAll}
                    onChange={(e) => setEditScopeContainsAll(e.target.value)}
                    placeholder="Comma-separated"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <pre className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-auto font-mono">
              {JSON.stringify(
                {
                  rule_id: rule.rule_id,
                  validator: rule.validator,
                  ...(Object.keys(rule.params).length > 0 ? { params: rule.params } : {}),
                  ...(rule.scope.variables.dcids.length > 0 ||
                  rule.scope.variables.regex.length > 0 ||
                  rule.scope.variables.contains_all.length > 0
                    ? { scope: rule.scope }
                    : {}),
                },
                null,
                2
              )}
            </pre>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
