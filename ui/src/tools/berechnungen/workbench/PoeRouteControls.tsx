import { useId } from "react";
import type { Inputs } from "./types";
import { POE_CABLE_REFERENCES } from "./referenceInstallationData";
import { defaultPoeRouteSegment, parsePoeSegments, POE_INSTALLATIONS, POE_ROUTE_QUALIFICATION, POE_ROUTE_TYPES, type PoeRouteSegmentInput } from "./poeRoute";
import "./poe-route.css";

type Props = { input: Inputs; onChange: (key: string, value: string) => void; disabled?: boolean };
function Entry({ label, value, onChange, options, disabled, text = false }: { label: string; value: string; onChange: (value: string) => void; options?: readonly { value: string; label: string }[]; disabled?: boolean; text?: boolean }) {
  const id = useId();
  return <label className="poe-route-entry" data-wide={text || Boolean(options) ? true : undefined} htmlFor={id}><span>{label.replace(/^Abschnitt \d+ · /, "").replace("Dokumentierte Leitertemperatur", "Leitertemperatur")}</span>{options ? <select id={id} aria-label={label} disabled={disabled} value={value} onChange={event => onChange(event.target.value)}>{!options.some(option => option.value === value) && <option value={value}>{value || "Bitte wählen …"} · Projektwert</option>}{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={id} aria-label={label} disabled={disabled} value={value} maxLength={text ? 180 : 24} inputMode={text ? "text" : "decimal"} onChange={event => onChange(event.target.value)} />}</label>;
}
export default function PoeRouteControls({ input, onChange, disabled }: Props) {
  if (input.poeRouteMode !== "published") return null;
  let segments: PoeRouteSegmentInput[];
  try { segments = parsePoeSegments(input.poeSegments, true); } catch (error) { return <p role="alert" className="lab-error">{(error as Error).message}</p>; }
  const save = (rows: PoeRouteSegmentInput[]) => onChange("poeSegments", JSON.stringify(rows));
  const change = (index: number, key: keyof PoeRouteSegmentInput, value: string) => save(segments.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <section className="poe-route-controls" aria-label="PoE-Kabelabschnitte"><div className="poe-route-controls-heading"><h2>Kabelabschnitte</h2><button type="button" className="lab-open" disabled={disabled || segments.length >= 32} onClick={() => save([...segments, { ...defaultPoeRouteSegment(crypto.randomUUID()), label: `Kabelabschnitt ${segments.length + 1}`, length: "10" }])}>Abschnitt hinzufügen</button></div>
    <p className="lab-note">Reihenfolge: Patch Verteiler → diese Kabelabschnitte → Patch Endgerät. Längen und Temperaturen werden einzeln berücksichtigt.</p>
    <details className="poe-route-type-data"><summary>Typströme und aktive Paare · Referenzannahmen</summary><table><thead><tr><th>Typ</th><th>Paare / Adern</th><th>Strom je Ader</th></tr></thead><tbody>{POE_ROUTE_TYPES.map(type => <tr key={type.type}><td>{type.label}</td><td>{type.pairs} / {type.conductors}</td><td>{type.conductorCurrent.toLocaleString("de-CH")} A</td></tr>)}</tbody></table><p>Publizierte Richtwerte zur RP-Bündelrechnung, keine bestätigten IEEE-Gerätegrenzwerte.</p></details>
    {segments.map((segment, index) => {
      const cable = POE_CABLE_REFERENCES.find(option => option.id === segment.cableType), lengthFactor = cable?.referenceLengthFactors[input.poeClass];
      const label = `Abschnitt ${index + 1}`;
      return <details className="poe-route-control-card" key={segment.id} open={index === 0}><summary>{segment.label || label} · {segment.length || "–"} m</summary><div className="poe-route-input-grid">
        <Entry label={`${label} · Bezeichnung`} text value={segment.label} onChange={value => change(index, "label", value)} disabled={disabled} />
        <Entry label={`${label} · Kabeldatensatz`} value={segment.cableType} options={[...POE_CABLE_REFERENCES.map(row => ({ value: row.id, label: row.label })), { value: "custom", label: "Eigener dokumentierter Datensatz" }]} onChange={value => change(index, "cableType", value)} disabled={disabled} />
        <Entry label={`${label} · Physische Länge (m)`} value={segment.length} onChange={value => change(index, "length", value)} disabled={disabled} />
        <Entry label={`${label} · Kabel im Bündel`} value={segment.numCables} onChange={value => change(index, "numCables", value)} disabled={disabled} />
        <Entry label={`${label} · Kanalbreite (mm)`} value={segment.width} onChange={value => change(index, "width", value)} disabled={disabled} />
        <Entry label={`${label} · Umgebung (°C)`} value={segment.ambient} onChange={value => change(index, "ambient", value)} disabled={disabled} />
        <Entry label={`${label} · Einbauzustand`} value={segment.installCondition} options={POE_INSTALLATIONS} onChange={value => change(index, "installCondition", value)} disabled={disabled} />
        {input.poeThermalMode === "manual" && <Entry label={`${label} · Dokumentierte Leitertemperatur (°C)`} value={segment.temperature} onChange={value => change(index, "temperature", value)} disabled={disabled} />}
      </div>
      {cable && <p className={`poe-route-data-note${lengthFactor === undefined ? " poe-route-data-error" : ""}`}>d = {cable.diameter} mm · R₂₀ = {cable.resistance20} Ω/100 m je Ader · a = {cable.attenuationPerDegree} %/K · {lengthFactor === undefined ? `Klasse ${input.poeClass} nicht belegt` : `Längenfaktor Klasse ${input.poeClass}: ${lengthFactor}`}<br/>{POE_ROUTE_QUALIFICATION}</p>}
      {segment.cableType === "custom" && <div className="poe-route-custom"><p className="poe-route-data-note">Eigene Kabeldaten benötigen manuell dokumentierte Leitertemperaturen. Die kalibrierte Bündelerwärmung ist für diesen Datensatz nicht belegt.</p><div className="poe-route-input-grid">
        <Entry label={`${label} · Datenblatt / Quelle`} text value={segment.evidence} onChange={value => change(index, "evidence", value)} disabled={disabled} />
        <Entry label={`${label} · Durchmesser (mm)`} value={segment.diameter} onChange={value => change(index, "diameter", value)} disabled={disabled} />
        <Entry label={`${label} · Aderwiderstand 20 °C (Ω/100 m)`} value={segment.resistance} onChange={value => change(index, "resistance", value)} disabled={disabled} />
        <Entry label={`${label} · Temperatur-Dämpfungskoeffizient (%/K)`} value={segment.attenuation} onChange={value => change(index, "attenuation", value)} disabled={disabled} />
        <Entry label={`${label} · Elektrischer Längenfaktor`} value={segment.classFactor} onChange={value => change(index, "classFactor", value)} disabled={disabled} />
        <Entry label={`${label} · Schirmung`} value={segment.shielding} options={[{ value: "/s", label: "Geschirmt" }, { value: "/u", label: "Ungeschirmt" }]} onChange={value => change(index, "shielding", value)} disabled={disabled} />
      </div></div>}
      <button type="button" className="poe-route-remove" disabled={disabled || segments.length === 1} aria-label={`${label} entfernen`} onClick={() => save(segments.filter((_, i) => i !== index))}>Abschnitt entfernen</button>
      </details>;
    })}
  </section>;
}
