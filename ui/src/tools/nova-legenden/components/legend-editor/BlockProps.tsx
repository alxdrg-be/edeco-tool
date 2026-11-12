import InfoTip from "../../../../shared/InfoTip";
import { LegendBlock, LegendDoc, SectionStyle, updateBlock, updateSectionStyle } from "../../legend";
import { TrashIcon } from "../Icons";
import { alignLegendSectionColors } from "../../legendViewport";
import { FieldFn, COLOR_FIELDS } from "./editorShared.ts";
import { NumberInput } from "./SymbolBits";

export function BlockProps({
  block,
  doc,
  field,
  change,
  onMove,
  onRemove,
  catTitle,
  templateTexts,
}: {
  block: LegendBlock;
  doc: LegendDoc;
  field: FieldFn;
  change: (d: LegendDoc) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  catTitle: Record<string, string>;
  templateTexts: string[];
}) {
  const setStyle = (patch: Partial<SectionStyle>) => change(updateSectionStyle(doc, block.id, patch));
  return (
    <>
      <h4>Abschnitt <InfoTip text={`${block.category_id ? `Kategorie: ${catTitle[block.category_id] ?? block.category_id}. ` : ""}${block.layer ? `Ebene im Export: ${block.layer}. ` : ""}Änderungen gelten nur für diese Legende. Die Symbole behalten ihre ursprünglichen Planfarben.`} /></h4>
      <label className="field">
        <span>Überschrift</span>
        <input className="input" list="lg-headings" value={block.title} {...field((d, v) => updateBlock(d, block.id, { title: v }))} />
        <datalist id="lg-headings">
          {templateTexts.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <div className="color-grid">
        {COLOR_FIELDS.filter(([key]) => !doc.style.compact_flow || key !== "header_text").map(([key, label]) => (
          <label key={key} className="color-field">
            <input type="color" value={String(block.style[key])} onChange={(e) => setStyle({ [key]: e.target.value } as Partial<SectionStyle>)} />
            <span>{doc.style.compact_flow && key === "header" ? "Rubrikfarbe" : label}</span>
          </label>
        ))}
      </div>
      <details className="legend-help"><summary>ⓘ Rubrik und Originalfarben</summary><div>Die Rubrikfarbe markiert Überschrift und Trennlinie. Die Symbole behalten ihre eigenen Planfarben; ein roter Rubrikmarker bedeutet deshalb nicht, dass ein blauer Schalter umgefärbt wurde. Die folgende Aktion gleicht nur diese Rubrik an die häufigste Originalfarbe ihrer sichtbaren Symbole an. Bei gleich häufigen Farben bleibt die Rubrik unverändert.</div></details>
      <button className="btn small" onClick={() => {
        const selected = alignLegendSectionColors({ ...doc, blocks: [block] }).blocks[0];
        change({ ...doc, blocks: doc.blocks.map(item => item.id === block.id ? selected : item) });
      }}>Rubrikfarbe aus Symbolen</button>
      {!doc.style.compact_flow && <div className="color-grid">
        <label className="color-field">
          <input type="checkbox" checked={block.style.background_on} onChange={(e) => setStyle({ background_on: e.target.checked })} aria-label="Hintergrundfarbe an" />
          <input type="color" value={block.style.background} onChange={(e) => setStyle({ background: e.target.value })} aria-label="Hintergrundfarbe" />
          <span>Hintergrundfarbe</span>
        </label>
        <label className="color-field">
          <input type="checkbox" checked={block.style.border_on} onChange={(e) => setStyle({ border_on: e.target.checked })} aria-label="Umrandung an" />
          <input type="color" value={block.style.border} onChange={(e) => setStyle({ border: e.target.value })} aria-label="Farbe Umrandung" />
          <span>Umrandung</span>
        </label>
      </div>}
      <label className="field" style={{ marginTop: 6 }}>
        <span>Textgrösse Überschrift (Faktor)</span>
        <NumberInput value={block.title_scale ?? 1} step={0.1} onCommit={(v) => change(updateBlock(doc, block.id, { title_scale: Math.max(0.5, Math.min(3, v)) }))} />
      </label>
      {!doc.style.compact_flow && <label className="field" style={{ marginTop: 6 }}>
        <span>Innenabstand (mm)</span>
        <NumberInput value={block.style.padding} step={0.5} onCommit={(v) => setStyle({ padding: Math.max(0, Math.min(10, v)) })} />
      </label>}
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => onMove(-1)}>
          ↑ Nach oben
        </button>
        <button className="btn small" onClick={() => onMove(1)}>
          ↓ Nach unten
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn icon danger" onClick={onRemove} aria-label="Abschnitt entfernen" title="Abschnitt entfernen">
          <TrashIcon />
        </button>
      </div>
    </>
  );
}

export function TitleProps({ doc, field, change }: { doc: LegendDoc; field: FieldFn; change: (d: LegendDoc) => void }) {
  const t = doc.title;
  const set = (patch: Partial<LegendDoc["title"]>) => change({ ...doc, title: { ...t, ...patch } });
  const mm = t.size_mm > 0 ? t.size_mm : 5;
  return (
    <>
      <h4>Titel <InfoTip text="Grösse, Farbe und Schriftart gelten nur für den Titel." /></h4>
      <label className="field">
        <span>Text</span>
        <input className="input" value={t.text} {...field((d, v) => ({ ...d, title: { ...d.title, text: v } }))} />
      </label>
      <label className="field">
        <span>Textgrösse (mm)</span>
        <NumberInput label="Textgrösse Titel" value={mm} step={0.25} onCommit={(v) => {
          const size = Math.max(1, Math.min(20, v));
          const base = doc.style.text_size || 1;
          set({ size_mm: size, scale: Math.max(0.5, Math.min(3, Math.round((size / base) * 100) / 100)) });
        }} />
      </label>
      <label className="field">
        <span>Schriftart</span>
        <select className="select" aria-label="Schriftart Titel" value={t.font || "Arial"} onChange={(e) => set({ font: e.target.value })}>
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
          <option value="Verdana">Verdana</option>
        </select>
      </label>
      <div className="color-grid">
        <label className="color-field">
          <input type="color" value={t.color || "#000000"} onChange={(e) => set({ color: e.target.value })} aria-label="Farbe Titel" />
          <span>Schrift</span>
        </label>
        <label className="color-field">
          <input type="checkbox" checked={Boolean(t.border_on)} onChange={(e) => set({ border_on: e.target.checked })} aria-label="Umrandung Titel an" />
          <input type="color" value={t.border || "#000000"} onChange={(e) => set({ border: e.target.value })} aria-label="Farbe Umrandung Titel" />
          <span>Umrandung</span>
        </label>
      </div>
    </>
  );
}
