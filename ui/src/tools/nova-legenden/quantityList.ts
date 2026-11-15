// Floor quantities already counted by the legend import, shaped for the list and Excel.
import { csvRows, type CsvValue } from "../../shared/csv.ts";

export interface QuantityPlan {
  id: number | string;
  name: string;
}

export interface QuantitySource {
  key: string;
  category: string;
  title: string;
  names: readonly string[];
  code: string;
  dataset: string;
  assignment: "erkannt" | "unbekannt";
  counts: Readonly<Record<string, number>>;
  total: number;
}

export function quantityMatches(row: QuantitySource, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.category, row.title, row.code, row.dataset, row.assignment, ...row.names]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

export function quantityFileName(projectName: string): string {
  const clean = projectName.replace(/[^\p{L}\p{N}._ -]+/gu, " ").replace(/\s+/g, " ").trim() || "Projekt";
  return `${clean}-Mengen.csv`;
}

function floorHeaders(plans: readonly QuantityPlan[]): string[] {
  const seen = new Map<string, number>();
  return plans.map((plan) => {
    const base = plan.name.trim() || `Geschoss ${plan.id}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function quantityCsv(plans: readonly QuantityPlan[], rows: readonly QuantitySource[]): string {
  const floors = floorHeaders(plans);
  const header = ["Kategorie", "Symbol", "Bezeichnung im Plan", "Code", "Datensatz", "Zuordnung", ...floors, "Total"];
  const lines: CsvValue[][] = [header];
  for (const row of rows) {
    const amounts = plans.map((plan) => {
      const count = row.counts[String(plan.id)];
      return Number.isFinite(count) ? count : 0;
    });
    lines.push([
      row.category,
      row.title,
      row.names.join(", "),
      row.code,
      row.dataset,
      row.assignment,
      ...amounts,
      row.total,
    ]);
  }
  return csvRows(lines, { quote: "minimal", trailingNewline: true });
}
