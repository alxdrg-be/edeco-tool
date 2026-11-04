import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { buildNetworkCheckpoints, summarizeNetworkCheckpoints } from "./networkCheckpoints";
import { networkVariantFields, networkVariantIsCurrent, networkVariantValue, previewNetworkVariant, type NetworkVariantPreview, type NetworkVariantSelection } from "./networkVariants";
import type { NetworkDocument, NetworkResult } from "./networkTypes";
import "./network-variants.css";

const format = (number: number, unit: string) => `${number.toLocaleString("de-CH", { maximumFractionDigits: 3 })} ${unit}`;

export default function NetworkVariantPanel({ document, selection, onApply }: {
  document: NetworkDocument;
  selection: NetworkVariantSelection;
  onApply: (preview: NetworkVariantPreview) => void;
}) {
  const fields = networkVariantFields(document, selection);
  const [fieldKey, setFieldKey] = useState(fields[0]?.key ?? "");
  const [value, setValue] = useState(() => networkVariantValue(document, selection, fields[0]?.key ?? ""));
  const [preview, setPreview] = useState<NetworkVariantPreview | null>(null);
  const [error, setError] = useState("");
  if (!fields.length) return null;
  const field = fields.find(field => field.key === fieldKey) ?? fields[0];
  const currentValue = networkVariantValue(document, selection, field.key);
  const current = preview ? networkVariantIsCurrent(document, preview) : false;
  const currentLabel = field.options?.find(option => option.value === currentValue)?.label ?? currentValue;
  const selectedLabel = field.options?.find(option => option.value === value)?.label ?? value;
  function prepare() {
    try { setPreview(previewNetworkVariant(document, { ...selection, field: field.key, value })); setError(""); }
    catch (error) { setPreview(null); setError(error instanceof Error ? error.message : "Variante konnte nicht berechnet werden."); }
  }
  const beforeSummary = preview ? summarizeNetworkCheckpoints(buildNetworkCheckpoints(preview.beforeDocument, preview.before)) : null;
  const afterSummary = preview ? summarizeNetworkCheckpoints(buildNetworkCheckpoints(preview.afterDocument, preview.after)) : null;
  const metric = (result: NetworkResult, key: "current" | "drop") => !result.valid ? "nicht berechenbar" : key === "current" ? format(result.maxCurrent, "A") : format(result.maxDropPercent, "%");

  return <details className="np-variant-panel" data-network-variant={`${selection.kind}:${selection.id}`}>
    <summary><FlaskConical size={16} aria-hidden="true" /><span>Variante prüfen<small>Vorschau ohne Änderung am Entwurf</small></span></summary>
    <div className="np-variant-body">
      <label>Parameter<select aria-label="Variantenparameter" value={field.key} onChange={event => { setFieldKey(event.target.value); setValue(networkVariantValue(document, selection, event.target.value)); setPreview(null); setError(""); }}>{fields.map(field => <option key={field.key} value={field.key}>{field.label}{field.unit ? ` (${field.unit})` : ""}</option>)}</select></label>
      <div className="np-variant-current">Aktuell: <strong>{currentLabel}{field.unit && !field.options ? ` ${field.unit}` : ""}</strong></div>
      <label>Wert der Variante{field.options ? <select aria-label="Wert der Variante" value={value} onChange={event => { setValue(event.target.value); setPreview(null); setError(""); }}>{!field.options.some(option => option.value === value) && <option value={value}>{value || "Wert wählen"}</option>}{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input aria-label="Wert der Variante" inputMode="decimal" value={value} maxLength={40} onChange={event => { setValue(event.target.value); setPreview(null); setError(""); }} />}</label>
      <button type="button" className="np-variant-calculate" onClick={prepare} disabled={value === currentValue}>Gesamtes Netz als Variante prüfen</button>
      {error && <p role="alert" className="np-variant-error">{error}</p>}
      {preview && <div className="np-variant-comparison" role="region" aria-label="Variantenvergleich">
        <h3>Vorschau · {field.label}</h3><p>{preview.beforeValue} → {selectedLabel}{field.unit && !field.options ? ` ${field.unit}` : ""}</p>
        {!current && <p role="status" className="np-variant-error">Eingaben geändert. Variante vor dem Übernehmen erneut prüfen.</p>}
        <table><caption>Gesamtnetz neu berechnet</caption><thead><tr><th>Kriterium</th><th>Aktuell</th><th>Variante</th></tr></thead><tbody>
          <tr><th>Fehlerhafte Kriterien</th><td>{beforeSummary?.failed}</td><td>{afterSummary?.failed}</td></tr>
          <tr><th>Offene Kriterien</th><td>{beforeSummary?.open}</td><td>{afterSummary?.open}</td></tr>
          <tr><th>Grösster Pfad-Spannungsfall</th><td>{metric(preview.before, "drop")}</td><td>{metric(preview.after, "drop")}</td></tr>
          <tr><th>Stärkster Aussenleiter</th><td>{metric(preview.before, "current")}</td><td>{metric(preview.after, "current")}</td></tr>
        </tbody></table>
        <details><summary>Alle Befunde der Variante ({preview.after.issues.length})</summary>{preview.after.issues.length ? <ul>{preview.after.issues.map((issue, index) => <li key={index}>{issue.text}</li>)}</ul> : <p>Keine numerischen Modellverletzungen. Separate Nachweise bleiben erforderlich.</p>}</details>
        {!preview.after.valid && <p className="np-variant-error">Die Variante ist nicht berechenbar und kann nicht übernommen werden.</p>}
        <p>Last und Anlauf, Gerätekennlinie, Selektivität und Ausschaltvermögen fachlich abgleichen. Ein erfülltes Einzelkriterium ist keine Anlagenfreigabe.</p>
        <button type="button" className="np-variant-apply" disabled={!current || !preview.after.valid} onClick={() => onApply(preview)}>Variante übernehmen &amp; neu prüfen</button>
        <small>Änderung bewusst übernehmen · Rückgängig bleibt verfügbar.</small>
      </div>}
    </div>
  </details>;
}
