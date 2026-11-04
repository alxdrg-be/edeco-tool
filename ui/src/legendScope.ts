import type { SummaryRow } from "./api";

export interface LegendScope {
  plan_ids: number[];
  only_present: boolean;
  title_suffix: boolean;
  filename_suffix: boolean;
}

export interface LegendScopeInfo {
  plans: { id: number; name: string; imported: boolean; components: number; symbol_types: number }[];
  selected_plan_ids: number[];
  missing_plan_ids: number[];
  counts: { components: number; symbol_types: number; legend_rows: number; unknown_components: number; manual_rows: number };
  rows: SummaryRow[];
  color_warnings?: { block: string; item: string; text: string; kind: string; message: string;
    available_colors: string[]; selected_colors?: string[] }[];
  color_warning_count?: number;
}

export const DEFAULT_LEGEND_SCOPE: LegendScope = {
  plan_ids: [], only_present: false, title_suffix: false, filename_suffix: false,
};

/** Empty means every current and future floor. Explicit IDs stay explicit. */
export function toggleLegendFloor(scope: LegendScope, id: number, firstChoice = false): LegendScope {
  const ids = scope.plan_ids.includes(id) ? scope.plan_ids.filter(value => value !== id) : [...scope.plan_ids, id];
  return { ...scope, plan_ids: ids, only_present: firstChoice ? true : scope.only_present };
}
