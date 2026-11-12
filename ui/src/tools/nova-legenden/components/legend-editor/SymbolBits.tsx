import { useEffect, useState } from "react";
import { SymbolRender } from "../../api";
import InfoTip from "../../../../shared/InfoTip";
import { legendLayerColors, legendVisibleLayerColors, type LayerColorSource } from "../../legendViewport";
import { tint, innerSvg } from "./editorShared.ts";

/** Small symbol icon for the lists on the left: the same drawing as on the sheet. */
export function SymIcon({ r, color = "#000000" }: { r?: SymbolRender; color?: string }) {
  if (!r?.svg || !r.box) return <span className="sym-icon empty" aria-hidden />;
  // the icon sits on white: draw it in the section colour (black outside a section),
  // never in the light text colour of the dark theme
  return (
    <svg className="sym-icon" viewBox={r.box.join(" ")} aria-hidden style={{ color, ["--sym-layer" as string]: tint(color, 0.45) }}
      dangerouslySetInnerHTML={{ __html: innerSvg(r.svg) }} />
  );
}

/** Source-colour repetitions belong to one logical apparatus. Semantic parts
 * get independent controls, so choosing red never removes its UP/AP partner. */
export function ColorVariantChoice({ source, label, onChoose, overridden = false }: {
  source: LayerColorSource;
  label: string;
  onChoose: (colors: string[]) => void;
  overridden?: boolean;
}) {
  const colors = legendLayerColors(source);
  if (colors.length < 2) return null;
  const visible = legendVisibleLayerColors(source);
  const selected = overridden ? "override" : visible.length === colors.length ? "all" : visible.length === 1 ? visible[0] : "subset";
  const colorName = (index: number) => `Farbe ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;
  return <div className="field legend-color-variant-field">
    <span>Farbvarianten <InfoTip text="Alle zeigt die Originalfarben nebeneinander. Mit Nur Farbe A/B zeigst du eine Quellfarbe dieses Symbols. Die Auswahl wird in dieser Legende gespeichert und auch exportiert. Die anderen Originalfarben bleiben erhalten; weitere kombinierte Apparate werden nicht entfernt. Eine eigene Symbolfarbe wird bei dieser Auswahl zurückgesetzt." /></span>
    <div className="legend-color-options" role="group" aria-label={label}>
      {colors.length > 4 ? <select className="select" aria-label={label} value={selected} onChange={event => onChoose(event.target.value === "all" ? [] : [event.target.value])}>
        <option value="all">Alle Farben</option>
        {(selected === "override" || selected === "subset") && <option value={selected} disabled>{selected === "override" ? "Eigene Symbolfarbe aktiv" : `${visible.length} Farben gewählt`}</option>}
        {colors.map((color, index) => <option key={color} value={color}>Nur {colorName(index)} · {color.toUpperCase()}</option>)}
      </select> : <>
        <button type="button" aria-pressed={selected === "all"} onClick={() => onChoose([])}>Alle</button>
        {colors.map((color, index) => <button key={color} type="button" aria-pressed={selected === color} title={color.toUpperCase()} onClick={() => onChoose([color])}>
          <span className="legend-choice-swatch" style={{ background: color }} aria-hidden="true" />Nur {colorName(index)}
        </button>)}
      </>}
    </div>
    {overridden && <small className="hint">Eigene Symbolfarbe aktiv</small>}
  </div>;
}

/** Number field: one change (one undo step) when leaving the field or pressing Enter. */
export function NumberInput({
  value,
  step,
  placeholder,
  label,
  min,
  max,
  disabled,
  onCommit,
}: {
  value: number | null;
  step: number;
  placeholder?: string;
  label?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  const done = () => {
    const raw = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(raw)) {
      setText(value == null ? "" : String(value));
      return;
    }
    const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, raw));
    setText(String(v)); // show the value that applies, e.g. 210 after typing 250
    if (v !== value) onCommit(v);
  };
  return (
    <input
      className="input"
      inputMode="decimal"
      aria-label={label}
      value={text}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (!disabled) done(); }}
      onKeyDown={(e) => e.key === "Enter" && !disabled && done()}
    />
  );
}
