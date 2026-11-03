import { useId } from "react";
import { SIA_GROUPS } from "./siaData";
import { createSIAZone, type SIAConsumerInput, type SIAZoneInput } from "./siaModel";
import type { Inputs } from "./types";
import "./sia-table-controls.css";

type EditableNumber = number | string;
type EditableConsumer = Omit<SIAConsumerInput, "powerDensity" | "energyDensity"> & {
  powerDensity: EditableNumber;
  energyDensity: EditableNumber;
};
type EditableZone = Omit<SIAZoneInput, "area" | "kcor" | "yearGlz" | "powerTarget" | "energyTarget" | "consumers"> & {
  area: EditableNumber;
  kcor: EditableNumber;
  yearGlz: EditableNumber;
  powerTarget?: EditableNumber;
  energyTarget?: EditableNumber;
  consumers: EditableConsumer[];
};
type Props = { input: Inputs; onChange: (key: string, value: string) => void; disabled?: boolean };
type NumberField = "area" | "kcor" | "yearGlz" | "powerTarget" | "energyTarget";

// Preserve decimal punctuation and trailing zeros while typing. Conversion
// belongs to the calculation parser; even a valid intermediate 0.0 stays text.
function editableNumber(raw: string): EditableNumber {
  return raw;
}

function readEditableZones(raw: string): EditableZone[] {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Die gespeicherte Zonentabelle ist kein lesbares JSON-Dokument."); }
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error("Die Zonentabelle muss 1 bis 20 Zonen enthalten.");
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.label !== "string" || !Array.isArray(item.consumers)) throw new Error(`Zone ${index + 1}: Aufbau oder Kennung der gespeicherten Daten ist ungültig.`);
    ids.add(item.id);
    const groups = item.consumers.map((consumer: unknown) => consumer && typeof consumer === "object" && "groupId" in consumer ? consumer.groupId : undefined);
    if (groups.length !== SIA_GROUPS.length || SIA_GROUPS.some(group => groups.filter((key: unknown) => key === group.id).length !== 1)) throw new Error(`Zone ${index + 1}: Die sieben Verbrauchergruppen sind nicht eindeutig vorhanden.`);
    for (const key of ["area", "kcor", "yearGlz", "powerTarget", "energyTarget"] as const) {
      if (item[key] !== undefined && typeof item[key] !== "number" && typeof item[key] !== "string") throw new Error(`Zone ${index + 1}: Das Feld ${key} hat ein ungültiges Format.`);
    }
    for (const consumer of item.consumers) {
      if (!consumer || typeof consumer !== "object" || !["string", "number"].includes(typeof consumer.powerDensity) || !["string", "number"].includes(typeof consumer.energyDensity)) throw new Error(`Zone ${index + 1}: Verbraucherwerte haben ein ungültiges Format.`);
    }
  }
  return value as EditableZone[];
}

function Entry({ label, value, onChange, disabled, text = false, placeholder }: { label: string; value?: EditableNumber; onChange: (value: string) => void; disabled?: boolean; text?: boolean; placeholder?: string }) {
  const id = useId();
  return <label data-diagnostic-label={label} className="sia-table-entry" htmlFor={id}><span>{label}</span><input id={id} type="text" inputMode={text ? "text" : "decimal"} autoComplete="off" maxLength={text ? 100 : 24} value={value ?? ""} placeholder={placeholder} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>;
}

export default function SIATableControls({ input, onChange, disabled = false }: Props) {
  if (input.siaMode !== "manual") return null;
  let zones: EditableZone[];
  try { zones = readEditableZones(input.siaZones ?? ""); }
  catch (error) {
    return <section className="sia-table-controls" aria-label="Manuelle SIA-Verbrauchertabelle"><h2>Verbraucher & Zonen</h2><p className="lab-error" role="alert">{error instanceof Error ? error.message : "Zonentabelle konnte nicht gelesen werden."}</p><p className="lab-note">Die gespeicherten Angaben bleiben erhalten. «Neue Tabelle anlegen» ersetzt diese Tabelle ausdrücklich durch eine leere Zone.</p><button type="button" className="lab-open" disabled={disabled} onClick={() => onChange("siaZones", JSON.stringify([createSIAZone(crypto.randomUUID(), "Zone 1")]))}>Neue Tabelle anlegen</button></section>;
  }
  const save = (next: EditableZone[]) => onChange("siaZones", JSON.stringify(next));
  const edit = (index: number, key: NumberField | "label", raw: string) => save(zones.map((zone, position) => position === index ? { ...zone, [key]: key === "label" ? raw : (key === "powerTarget" || key === "energyTarget") && !raw.trim() ? undefined : editableNumber(raw) } : zone));
  const editConsumer = (zoneIndex: number, groupId: string, key: "powerDensity" | "energyDensity", raw: string) => save(zones.map((zone, position) => position === zoneIndex ? { ...zone, consumers: zone.consumers.map(consumer => consumer.groupId === groupId ? { ...consumer, [key]: editableNumber(raw) } : consumer) } : zone));
  return <section className="sia-table-controls" aria-label="Manuelle SIA-Verbrauchertabelle"><div className="sia-table-heading"><h2>Verbraucher & Zonen</h2><button type="button" className="lab-open" disabled={disabled || zones.length >= 20} onClick={() => save([...zones, createSIAZone(crypto.randomUUID(), `Zone ${zones.length + 1}`)])}>Zone hinzufügen</button></div>
    <p className="sia-table-guide">Rohwerte aus der belegten Projektgrundlage eingeben. Kcor korrigiert nur die Leistung; die Jahresgleichzeitigkeit korrigiert nur die Energie. Leere Pflichtwerte liefern kein Ergebnis.</p>
    {zones.map((zone, index) => <details data-diagnostic-field="siaZones" data-diagnostic-row={zone.id} data-diagnostic-index={index} className="sia-zone-card" key={zone.id} open={index === 0}><summary><span>{zone.label || `Zone ${index + 1}`}</span><small>{zone.area === "" || zone.area === undefined ? "–" : zone.area} m²</small></summary><div className="sia-zone-content"><div className="sia-zone-fields"><Entry label={`Zone ${index + 1} · Bezeichnung`} text value={zone.label} onChange={value => edit(index, "label", value)} disabled={disabled} /><Entry label={`${zone.label || `Zone ${index + 1}`} · Fläche (m²)`} value={zone.area} onChange={value => edit(index, "area", value)} disabled={disabled} /><Entry label={`${zone.label || `Zone ${index + 1}`} · Kcor Leistung`} value={zone.kcor} onChange={value => edit(index, "kcor", value)} disabled={disabled} /><Entry label={`${zone.label || `Zone ${index + 1}`} · Jahresgleichzeitigkeit Energie`} value={zone.yearGlz} onChange={value => edit(index, "yearGlz", value)} disabled={disabled} /></div>
      <div className="sia-consumers-scroll" role="region" tabIndex={0} aria-label={`${zone.label || `Zone ${index + 1}`} · rohe Leistungs- und Energiekennwerte`}><table className="sia-consumers-table"><caption>Rohwerte vor Kcor und Jahresgleichzeitigkeit</caption><thead><tr><th scope="col">Verbrauchergruppe</th><th scope="col">Leistung<br /><span>W/m²</span></th><th scope="col">Energie<br /><span>kWh/(m²·a)</span></th></tr></thead><tbody>{SIA_GROUPS.map(group => {
        const consumer = zone.consumers.find(row => row.groupId === group.id)!;
        return <tr key={group.id}><th scope="row"><span className="sia-group-key" style={{ background: group.color }} aria-hidden="true" />{group.label}</th><td><input data-diagnostic-property={`${group.id}.powerDensity`} aria-label={`${zone.label || `Zone ${index + 1}`} · ${group.label} · Rohleistung (W/m²)`} type="text" inputMode="decimal" autoComplete="off" maxLength={24} disabled={disabled} value={consumer.powerDensity} onChange={event => editConsumer(index, group.id, "powerDensity", event.target.value)} /></td><td><input data-diagnostic-property={`${group.id}.energyDensity`} aria-label={`${zone.label || `Zone ${index + 1}`} · ${group.label} · Rohenergie (kWh/m² pro Jahr)`} type="text" inputMode="decimal" autoComplete="off" maxLength={24} disabled={disabled} value={consumer.energyDensity} onChange={event => editConsumer(index, group.id, "energyDensity", event.target.value)} /></td></tr>;
      })}</tbody></table></div>
      <details className="sia-zone-targets"><summary>Manuelle Zielwerte · optional</summary><p className="lab-note">Leer bedeutet kein Zielvergleich. Nur mit passend belegten Werten ausfüllen; null ist ein ausdrücklicher Zielwert.</p><div className="sia-zone-fields"><Entry label={`${zone.label || `Zone ${index + 1}`} · Ziel Leistung (W/m²)`} value={zone.powerTarget} placeholder="Kein Vergleich" onChange={value => edit(index, "powerTarget", value)} disabled={disabled} /><Entry label={`${zone.label || `Zone ${index + 1}`} · Ziel Energie (kWh/m² pro Jahr)`} value={zone.energyTarget} placeholder="Kein Vergleich" onChange={value => edit(index, "energyTarget", value)} disabled={disabled} /></div></details>
      <button type="button" className="sia-zone-remove" disabled={disabled || zones.length === 1} aria-label={`${zone.label || `Zone ${index + 1}`} entfernen`} onClick={() => save(zones.filter((_, position) => position !== index))}>Zone entfernen</button>
    </div></details>)}
  </section>;
}
