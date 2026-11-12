/** Compare a measured short-circuit current with the E-Memory rule-of-thumb table. */
export interface IkTable { headers: string[]; rows: string[][] }
export type IkVerdict =
  | { kind: "ok"; required: number; label: string }
  | { kind: "low"; required: number; label: string }
  | { kind: "none"; label: string };

/** The required current in a cell: «DII/DIII 121» → 121, «303» → 303, «keine» → null. */
export function requiredCurrent(cell: string): number | null {
  const match = cell.match(/(\d+(?:[.,]\d+)?)\s*A?\s*$/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

/** `device` is a column index (1…), `rating` the value of the first column, `measured` in ampere. */
export function checkIk(table: IkTable, device: number, rating: string, measured: number): IkVerdict | null {
  const row = table.rows.find(item => item[0] === rating);
  if (!row || device < 1 || device >= row.length || !Number.isFinite(measured) || measured <= 0) return null;
  const label = row[device];
  const required = requiredCurrent(label);
  if (required === null) return { kind: "none", label };
  return { kind: measured >= required ? "ok" : "low", required, label };
}
