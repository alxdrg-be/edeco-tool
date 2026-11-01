import { useState } from "react";
import EVSchema from "../EVSchema";
import { schemaState } from "../EVSchemaState";
import { Segments } from "../LabUI";
import type { CalculationResult } from "./types";

export default function ChargingView({ result }: { result: CalculationResult }) {
  const [selected, setSelected] = useState("0");
  const data = result.charging!;
  const active = data.grids.map((grid, i) => ({ grid, key: String(i) })).filter(item => item.grid.count > 0);
  const chosen = active.find(item => item.key === selected) ?? active[0];
  if (!chosen) return null;
  const grid = chosen.grid;
  const input = { house: String(data.houseAmps), grid: String(grid.amps), count: String(grid.count), power: String(grid.power), reserve: "0", diversity: "1", mode: data.mode };
  const diagramResult = { houseKW: data.houseKW, gridKW: Math.sqrt(3) * 400 * grid.amps / 1000, perPoint: grid.assigned / grid.count, reserveExceeded: result.status.tone === "error" && data.mode !== "none", capacityOK: result.status.tone !== "error" };
  const signals = schemaState({ houseKW: data.houseKW, reserveKW: data.reserveKW, totalAssignedKW: data.totalAssignedKW, gridKW: diagramResult.gridKW, gridAssignedKW: grid.assigned, nominalPerPointKW: grid.power, assignedPerPointKW: diagramResult.perPoint, managed: data.mode !== "none" });
  return <section className="wb-charging" aria-label="Stromlaufplan der Ladegrids"><Segments label="Ladegrid auswählen" value={chosen.key} onChange={setSelected} options={active.map(item => ({ value: item.key, label: item.grid.label }))} /><p className="lab-note">{grid.label} · {grid.assigned.toLocaleString("de-CH", { maximumFractionDigits: 1 })} kW Zuteilung. Beide Grids teilen das gemeinsame Hausbudget.</p><EVSchema input={input} result={diagramResult} signals={signals} /></section>;
}
