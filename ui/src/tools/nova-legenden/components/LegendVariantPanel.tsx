import { useId } from "react";
import { Combine } from "lucide-react";
import LegendSection from "./LegendSection";
import "./LegendVariantPanel.css";

export interface LegendVariantRules {
  labels: boolean;
  orientation: boolean;
  count: boolean;
  placement: boolean;
  mounting: boolean;
  poles: boolean;
  schema: boolean;
  angle: boolean;
}

export interface LegendVariantInfo {
  merged_rows: number;
  added_variants: number;
  applied_rules: Partial<Record<keyof LegendVariantRules, number>>;
  unmatched_rules: (keyof LegendVariantRules)[];
  groups: { block: string; item: string; source_ids: string[]; rules: (keyof LegendVariantRules)[] }[];
  notes: string[];
}

export const DEFAULT_LEGEND_VARIANT_RULES: Readonly<LegendVariantRules> = {
  labels: true, orientation: false, count: false, placement: false,
  mounting: false, poles: false, schema: false, angle: false,
};

const RULES: { key: keyof LegendVariantRules; label: string; example: string }[] = [
  { key: "labels", label: "Beschriftung", example: "Standard / ohne Text" },
  { key: "orientation", label: "Ausrichtung", example: "liegend / stehend" },
  { key: "count", label: "Anzahl", example: "1- / 2- / 3-fach" },
  { key: "placement", label: "Decke / Wand", example: "Montageort" },
  { key: "mounting", label: "UP / AP", example: "beide Montagearten zeigen" },
  { key: "poles", label: "Polzahl", example: "2- / 3-polig" },
  { key: "schema", label: "Schema", example: "0 / 1 / 3" },
  { key: "angle", label: "Erfassungswinkel", example: "90° / 180° / 360°" },
];

interface Props {
  value?: Partial<LegendVariantRules>;
  onChange: (rules: LegendVariantRules) => void;
  info?: LegendVariantInfo | null;
}

/** Changes only the generated view; source apparatus, codes and colours survive. */
export default function LegendVariantPanel({ value, onChange, info }: Props) {
  const id = useId();
  const rules = { ...DEFAULT_LEGEND_VARIANT_RULES, ...value };
  const matches = (info?.merged_rows ?? 0) + (info?.added_variants ?? 0);
  const enabled = RULES.filter(rule => rules[rule.key]).length;
  return <LegendSection id="variants" icon={Combine} title="Varianten" status={`${enabled} von ${RULES.length} Regeln`} label="Varianten dieser Legende" className="legend-variant-panel"
    help="Gilt für diese Legende. Nur eindeutig belegte Katalogvarianten derselben Funktion werden gemeinsam dargestellt, höchstens drei Symbole pro Zeile. Codes, Mengen, Farben und gespeicherte Einzelzeilen bleiben erhalten. Bestehende Bibliotheksfamilien und Firmenzuordnungen werden nicht umgebaut. UP/AP ergänzt die zweite Zeichnung nur, wenn beide Montagearten in den gewählten Geschossen vorkommen, ihr Katalog-Codepaar belegt ist und die Quellfarben jedem Mitglied eindeutig zugeordnet sind. Eine gespeicherte Farbauswahl wird für jedes Mitglied separat berücksichtigt.">
    <div className="legend-variant-rules">
      {RULES.map(rule => <label key={rule.key} htmlFor={`${id}-${rule.key}`}>
        <input id={`${id}-${rule.key}`} type="checkbox" checked={rules[rule.key]}
          onChange={event => onChange({ ...rules, [rule.key]: event.target.checked })} />
        <span>{rule.label}</span><small>{rule.example}</small>
      </label>)}
    </div>
    <div className="legend-variant-result" role="status">
      {info ? <>{info.merged_rows} {info.merged_rows === 1 ? "Zeile zusammengefasst" : "Zeilen zusammengefasst"}{info.added_variants > 0 && <> · {info.added_variants} {info.added_variants === 1 ? "Montagevariante ergänzt" : "Montagevarianten ergänzt"}</>}</> : "Vorschau wird geprüft …"}
    </div>
    {info && info.notes.length > 0 && <details className="legend-variant-explanation"><summary>{matches ? "Grundlage & unveränderte Einträge" : "Warum bleiben Einträge getrennt?"}</summary><div>{info.notes.map(note => <p key={note}>{note}</p>)}<p>Andere Funktionen, unklare Katalogdaten, bewusst beibehaltene Einträge und manuelle Kombinationen werden nicht automatisch zusammengeführt.</p></div></details>}
  </LegendSection>;
}
