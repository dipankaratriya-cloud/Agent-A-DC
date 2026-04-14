export interface ParamDef {
  key: string;
  type: "string" | "int" | "float" | "list";
  label: string;
  defaultValue: unknown;
  required: boolean;
}

export interface ValidatorDef {
  id: string;
  validator: string;
  label: string;
  description: string;
  category: "stats" | "lint" | "differ";
  params: ParamDef[];
  defaultEnabled: boolean;
}

export const DEFAULT_VALIDATORS: ValidatorDef[] = [
  {
    id: "check_latest_date_for_all",
    validator: "MAX_DATE_LATEST",
    label: "Max Date Latest",
    description: "Checks that the latest date in the data is from the current year.",
    category: "stats",
    params: [],
    defaultEnabled: true,
  },
  {
    id: "check_max_date_consistent",
    validator: "MAX_DATE_CONSISTENT",
    label: "Max Date Consistent",
    description: "Checks that the latest date is the same for all StatVars.",
    category: "stats",
    params: [],
    defaultEnabled: true,
  },
  {
    id: "check_missing_refs",
    validator: "MISSING_REFS_COUNT",
    label: "Missing Refs Count",
    description: "Checks that the total number of missing references is within a threshold.",
    category: "lint",
    params: [
      { key: "threshold", type: "int", label: "Threshold", defaultValue: 0, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_lint_errors",
    validator: "LINT_ERROR_COUNT",
    label: "Lint Error Count",
    description: "Checks that the total number of lint errors is within a threshold.",
    category: "lint",
    params: [
      { key: "threshold", type: "int", label: "Threshold", defaultValue: 0, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_deleted_records",
    validator: "DELETED_RECORDS_COUNT",
    label: "Deleted Records Count",
    description: "Checks that the total number of deleted points is within a threshold.",
    category: "differ",
    params: [
      { key: "threshold", type: "int", label: "Threshold", defaultValue: 0, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_deleted_records_pct",
    validator: "DELETED_RECORDS_PERCENT",
    label: "Deleted Records Percent",
    description: "Checks that the percentage of deleted points is within a threshold.",
    category: "differ",
    params: [
      { key: "threshold", type: "int", label: "Threshold", defaultValue: 0, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_modified_records",
    validator: "MODIFIED_RECORDS_COUNT",
    label: "Modified Records Count",
    description: "Checks that the number of modified points is the same for all StatVars.",
    category: "differ",
    params: [],
    defaultEnabled: true,
  },
  {
    id: "check_added_records",
    validator: "ADDED_RECORDS_COUNT",
    label: "Added Records Count",
    description: "Checks that the number of added points is the same for all StatVars.",
    category: "differ",
    params: [],
    defaultEnabled: true,
  },
  {
    id: "check_num_places_consistent",
    validator: "NUM_PLACES_CONSISTENT",
    label: "Num Places Consistent",
    description: "Checks that the number of places is the same for all StatVars.",
    category: "stats",
    params: [],
    defaultEnabled: true,
  },
  {
    id: "check_num_places_count",
    validator: "NUM_PLACES_COUNT",
    label: "Num Places Count",
    description: "Checks that the number of places is within a defined range.",
    category: "stats",
    params: [
      { key: "minimum", type: "int", label: "Minimum", defaultValue: null, required: false },
      { key: "maximum", type: "int", label: "Maximum", defaultValue: null, required: false },
      { key: "value", type: "int", label: "Exact Value", defaultValue: null, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_num_observations",
    validator: "NUM_OBSERVATIONS_CHECK",
    label: "Num Observations Check",
    description: "Checks that the number of observations is within a defined range.",
    category: "stats",
    params: [
      { key: "minimum", type: "int", label: "Minimum", defaultValue: null, required: false },
      { key: "maximum", type: "int", label: "Maximum", defaultValue: null, required: false },
      { key: "value", type: "int", label: "Exact Value", defaultValue: null, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_unit_consistency",
    validator: "UNIT_CONSISTENCY_CHECK",
    label: "Unit Consistency Check",
    description: "Checks that the unit is the same for all StatVars.",
    category: "stats",
    params: [],
    defaultEnabled: true,
  },
  {
    id: "check_min_value",
    validator: "MIN_VALUE_CHECK",
    label: "Min Value Check",
    description: "Checks that the minimum value is not below a defined minimum.",
    category: "stats",
    params: [
      { key: "minimum", type: "float", label: "Minimum", defaultValue: null, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_max_value",
    validator: "MAX_VALUE_CHECK",
    label: "Max Value Check",
    description: "Checks that the maximum value is not above a defined maximum.",
    category: "stats",
    params: [
      { key: "maximum", type: "float", label: "Maximum", defaultValue: null, required: false },
    ],
    defaultEnabled: true,
  },
  {
    id: "check_goldens",
    validator: "GOLDENS_CHECK",
    label: "Goldens Check",
    description: "Verifies that the data contains all records defined in a golden set.",
    category: "stats",
    params: [
      { key: "golden_files", type: "list", label: "Golden Files", defaultValue: [], required: false },
      { key: "input_files", type: "list", label: "Input Files", defaultValue: [], required: false },
    ],
    defaultEnabled: false,
  },
  {
    id: "custom_sql_check",
    validator: "SQL_VALIDATOR",
    label: "SQL Validator",
    description: "Runs a user-defined SQL query to perform complex validations.",
    category: "stats",
    params: [
      { key: "query", type: "string", label: "SQL Query", defaultValue: "", required: true },
      { key: "condition", type: "string", label: "Condition", defaultValue: "", required: true },
    ],
    defaultEnabled: false,
  },
];

export const VALIDATOR_NAMES = DEFAULT_VALIDATORS.map((v) => v.validator);

export const CATEGORY_LABELS: Record<string, string> = {
  stats: "Statistics",
  lint: "Lint",
  differ: "Differ",
};

export const CATEGORY_ORDER: Array<"stats" | "lint" | "differ"> = ["stats", "lint", "differ"];
