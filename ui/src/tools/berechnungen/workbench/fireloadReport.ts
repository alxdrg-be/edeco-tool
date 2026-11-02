import type { Inputs } from "./types.ts";
import { parseFireLoadRows } from "./installation.ts";

export function fireloadReportInputs(input: Inputs): { label: string; value: string }[] {
  if (input.fireloadMode !== "dynamic") return [];
  const list = (key: string, prefix = "") => parseFireLoadRows(input[key]).flatMap((row, index) => [
    { label: `${prefix}Kabelposition ${index + 1}`, value: row.name },
    { label: `${prefix}${row.name} · Bestand`, value: `${row.quantity} × ${row.length} m · ${row.mjPerMeter} MJ/m` },
    { label: `${prefix}${row.name} · Nachweisstatus`, value: row.evidence === "documented" ? "Am Projekt dokumentiert" : row.evidence === "critical" ? "Kritisches Brandverhalten" : "Nachweis offen" },
  ]);
  return input.fireloadRowsAfter === undefined ? list("fireloadRows") : [...list("fireloadRows", "Vorher · "), ...list("fireloadRowsAfter", "Nachher · ")];
}
