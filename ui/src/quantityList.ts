// Floor quantities already counted by the legend import, shaped for the list and Excel.

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

/** Excel de-CH: semicolon, and a leading apostrophe so a symbol name is not a formula. */
function cell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[;"\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function quantityCsv(plans: readonly QuantityPlan[], rows: readonly QuantitySource[]): string {
  const floors = floorHeaders(plans);
  const header = ["Kategorie", "Symbol", "Bezeichnung im Plan", "Code", "Datensatz", "Zuordnung", ...floors, "Total"];
  const lines = [header.map(cell).join(";")];
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
    ].map(cell).join(";"));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
