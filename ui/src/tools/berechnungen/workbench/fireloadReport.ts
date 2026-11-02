import type { Inputs } from "./types.ts";
import { fireLoadRowsToPositions, parseFireLoadRows } from "./installation.ts";
import { FIRE_CABLE_REFERENCE, fireCableFact } from "./fireCableData.ts";

export function fireloadReportInputs(input: Inputs): { label: string; value: string }[] {
  if (input.fireloadMode !== "dynamic") return [];
  const list = (key: string, prefix = "") => {
    const rows=parseFireLoadRows(input[key]),positions=fireLoadRowsToPositions(rows);
    return rows.flatMap((row, index) => {
      const catalog=row.catalogId?fireCableFact(row.catalogId):null;
      const supplier=catalog?.suppliers.find(item=>item.supplier===row.supplier);
      const evidence=positions[index].evidence;
      return [
        { label: `${prefix}Kabelposition ${index + 1}`, value: row.name },
        { label: `${prefix}${row.name} · Bestand`, value: `${row.quantity} × ${row.length} m · ${row.mjPerMeter} MJ/m` },
        { label: `${prefix}${row.name} · Nachweisstatus`, value: evidence === "documented" ? "Am Projekt dokumentiert" : evidence === "critical" ? "Kritisches Brandverhalten" : "Nachweis offen" },
        ...((row.cpr||catalog?.cpr)?[{label:`${prefix}${row.name} · CPR`,value:row.cpr&&catalog&&row.cpr!==catalog.cpr?`${row.cpr} · abweichend vom Katalog (${catalog.cpr})`:row.cpr||catalog!.cpr}]:[]),
        ...(catalog?[
          {label:`${prefix}${row.name} · Datenquelle`,value:`Referenzkatalog ${FIRE_CABLE_REFERENCE.version} · ${FIRE_CABLE_REFERENCE.observed}; ${catalog.basis==='richtwert'&&!supplier?'ca.-Richtwert, Herstellerbeleg offen':'publizierter Lieferantenwert; Originalbeleg am Projekt prüfen'}`},
          {label:`${prefix}${row.name} · Lieferant`,value:supplier?`${supplier.supplier} · Artikel ${supplier.article}${supplier.declaration?` · Leistungserklärung ${supplier.declaration}`:''}`:'Höchster publizierter plausibler Wert'},
        ]:[]),
      ];
    });
  };
  return input.fireloadRowsAfter === undefined ? list("fireloadRows") : [...list("fireloadRows", "Vorher · "), ...list("fireloadRowsAfter", "Nachher · ")];
}
