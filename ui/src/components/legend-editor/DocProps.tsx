import { api, LegendInfo } from "../../api";
import { exportDiagnostic } from "../../diagnostics";
import InfoTip from "../InfoTip";
import { LegendDoc } from "../../legend";
import { FieldFn } from "./editorShared.ts";
import { NumberInput } from "./SymbolBits";

export function DocProps({
  doc,
  info,
  field,
  setStyle,
  onCompact,
  onA4,
  projectId,
  notify,
  exportBlock,
  setExportBlock,
  exportGeneral,
  setExportGeneral,
  hasGeneral,
  exporting,
  onExport,
}: {
  doc: LegendDoc;
  info: LegendInfo;
  field: FieldFn;
  setStyle: (patch: Partial<LegendDoc["style"]>) => void;
  onCompact: () => void;
  onA4: () => void;
  projectId: string;
  notify: (text: string, error?: boolean) => void;
  exportBlock: string;
  setExportBlock: (v: string) => void;
  exportGeneral: boolean;
  setExportGeneral: (v: boolean) => void;
  hasGeneral: boolean;
  exporting: boolean;
  onExport: (format: "dxf" | "dwg" | "pdf", block: string, withGeneral: boolean) => void;
}) {
  const s = doc.style;
  const company = info.company;
  const fitted = s.symbol_fit === "corridor";
  const effectiveRow = s.compact_flow && s.grid !== "custom" ? 5 : s.row;
  const tileHeight = Math.min(s.text_size * 3.6 * s.symbol_scale, s.grid === "standard" && !s.compact_flow ? Infinity : Math.max(2.4, effectiveRow - .4));
  const tileMm = String(Math.round(tileHeight * .9 * 10) / 10).replace(".", ",");
  const sizeTip = (s.symbol_size ?? "tile") === "real"
    ? "Jedes Symbol im gemeinsamen Massstab, Einfügepunkt auf der Achse. Ein grosses Symbol belegt mehr Zeilen."
    : fitted ? `Bis ${tileMm} mm Höhe und rund 13 mm Breite. Lange Leuchten und Leitungen nutzen den breiten Symbolkorridor; Proportionen und gespeicherte Drehrichtung bleiben erhalten. Grössenfaktoren vergrössern nur bis zur Feldgrenze.`
    : `Quadratische Kachel mit bis ${tileMm} mm sichtbarer Symbolhöhe. Lange schmale Zeichnungen werden durch die Quadratbreite begrenzt.`;
  return (
    <>
      <h4>Legende <InfoTip text="Eintrag oder Kopfleiste anklicken. Ziehen oder ↑ ↓ verschiebt." /></h4>
      <label className="field">
        <span>Titel</span>
        <input className="input" value={doc.title.text} {...field((d, v) => ({ ...d, title: { ...d.title, text: v } }))} />
      </label>
      <div className="form two">
        <label className="field">
          <span>Layout <InfoTip text="Dichte wie Entwurf: drei Apparatespalten mit 2,8 mm Schrift. A4 kompakt: vier Spalten mit 2,6 mm Schrift und kleineren Rändern. Beide verwenden breite Symbolfelder statt Quadratbegrenzung. Der Allgemeinteil nutzt die Geometrie der Vorlage ohne zusätzliche gespeicherte Faktoren oder Drehungen; diese bleiben für die frühere Darstellung erhalten. Inhalte, Quellfarben und Zuordnungen bleiben erhalten. Rückgängig stellt alle vorherigen Werte wieder her. Die Höhe folgt dem Inhalt." /></span>
          <select className="select" aria-label="Legendenlayout" value={s.compact_flow ? s.columns === 4 ? "a4" : "compact" : "classic"} onChange={event => event.target.value === "compact" ? onCompact() : event.target.value === "a4" ? onA4() : setStyle({ compact_flow: false })}>
            <option value="compact">Dichte wie Entwurf</option>
            <option value="a4">A4 kompakt</option>
            <option value="classic">Klassische Abschnitte</option>
          </select>
        </label>
        <label className="field">
          <span>Schriftgrösse (mm)</span>
          <NumberInput label="Schriftgrösse" value={s.text_size} step={0.25} onCommit={(v) => setStyle({ text_size: Math.max(1, Math.min(10, v)) })} />
        </label>
        <label className="field">
          <span>Symbolmassstab</span>
          <NumberInput label="Symbolmassstab" value={s.symbol_scale} step={0.1} onCommit={(v) => setStyle({ symbol_scale: Math.max(0.2, Math.min(5, v)) })} />
        </label>
        <label className="field">
          <span>Abschnitte (mm)</span>
          <NumberInput label="Abstand zwischen Abschnitten" value={s.section_gap ?? 0} step={0.5} onCommit={(v) => setStyle({ section_gap: Math.max(0, Math.min(50, v)) })} />
        </label>
        <label className="field">
          <span>Symbolgrösse <InfoTip text={sizeTip} /></span>
          <select className="select" aria-label="Symbolgrösse" value={s.symbol_size === "real" ? "real" : fitted ? s.symbol_weight === "optical" ? "optical" : "fit" : "tile"} onChange={(e) => setStyle({ symbol_size: e.target.value === "real" ? "real" : "tile", symbol_fit: e.target.value === "fit" || e.target.value === "optical" ? "corridor" : "square", symbol_weight: e.target.value === "optical" ? "optical" : "fit" })}>
            <option value="optical">Optisch angleichen</option>
            <option value="fit">Breites Symbolfeld</option>
            <option value="tile">Quadratische Kacheln</option>
            <option value="real">Originalmassstab</option>
          </select>
        </label>
        {(s.symbol_size ?? "tile") === "tile" && !fitted && (
          <label className="toggle field" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={s.normalize_size !== false}
              onChange={(e) => setStyle({ normalize_size: e.target.checked })} />
            Gleiche Fläche <InfoTip text="Jedes Symbol bekommt dieselbe Fläche, mit einem kleinen freien Rand. Ein Kreis wirkt so nicht grösser als ein langer Balken. Aus: die längere Seite bestimmt die Grösse." />
          </label>
        )}
        <label className="field">
          <span>Einträge (mm)</span>
          <NumberInput label="Abstand zwischen Einträgen" value={s.entry_gap ?? 0} step={0.5} onCommit={(v) => setStyle({ entry_gap: Math.max(0, Math.min(20, v)) })} />
        </label>
        <label className="field">
          <span>Textzeilen <InfoTip text="«Automatisch» bricht langen Text um, die Zeile wird höher. 1 bis 3 Zeilen halten alle Einträge gleich hoch." /></span>
          <select className="select" aria-label="Textzeilen" value={String(s.text_lines ?? 0)} onChange={(e) => setStyle({ text_lines: Number(e.target.value) })}>
            <option value="0">Automatisch</option>
            <option value="1">1 Zeile</option>
            <option value="2">2 Zeilen</option>
            <option value="3">3 Zeilen</option>
          </select>
        </label>
        <label className="field">
          <span>
            Blattbreite (mm)
            <InfoTip text={`Zeichnungsbreite inklusive Innenrand. Das PDF ergänzt aussen 5 mm je Seite: 200 mm ergeben 210 mm PDF-Breite. Firmen-Standard: Schrift ${String(company.text_size).replace(".", ",")} mm, Massstab ${String(company.symbol_scale).replace(".", ",")}.`} />
          </span>
          <NumberInput label="Blattbreite" value={s.width} step={5} min={80} max={210} onCommit={(v) => setStyle({ width: v })} />
        </label>
        <label className="field">
          <span>Innenrand (mm)</span>
          <NumberInput label="Innenrand" value={s.margin ?? 5} step={0.5} min={2} max={10} onCommit={value => setStyle({ margin: Math.max(2, Math.min(10, value)) })} />
        </label>
      </div>
      {hasGeneral && <label className="toggle"><input type="checkbox" checked={Boolean(s.general_source_look)} onChange={event => setStyle({ general_source_look: event.target.checked })} />Allgemeinteil mit Vorlagenwerten <InfoTip text="Nur diese Legende: ursprüngliche Symbolausrichtung, Faktor 1 und gemeinsame Schriftgrösse. Gespeicherte zusätzliche Drehungen und Vergrösserungen bleiben in der Firmenkonfiguration erhalten und werden nach Ausschalten wieder verwendet. Die Quelldatei wird nicht verändert." /></label>}
      <div className="row">
        <label className="toggle" style={{ color: "var(--fg)" }}>
          <input type="checkbox" checked={Boolean(s.hatch_off)} onChange={(e) => setStyle({ hatch_off: e.target.checked })} />
          Weiche Schraffur aus
        </label>
        <InfoTip text="Schraffur und helle Fläche hinter Linien. Gilt für alle Symbole in Vorschau, DXF und PDF. Umrisse bleiben." />
      </div>
      <div className="row">
        <label className="toggle" style={{ color: "var(--fg)" }}>
          <input type="checkbox" checked={Boolean(s.fill_off)} onChange={(e) => setStyle({ fill_off: e.target.checked })} />
          Volle Flächen aus
        </label>
        <InfoTip text="Ganz gefüllte Teile, z. B. Anschlusspunkt oder die halbe Fläche bei AP. Gilt für alle Symbole. Umrisse bleiben." />
      </div>
      <button
        className="btn small"
        disabled={!company.is_admin}
        title={company.is_admin ? "Schriftgrösse und Symbolmassstab als Firmen-Standard für neue Projekte speichern" : `Nur Admins (${company.admins.join(", ") || "noch keine"})`}
        onClick={async () => {
          try {
            const r = await api.rememberLegend(projectId, doc);
            info.company.text_size = r.text_size;
            info.company.symbol_scale = r.symbol_scale;
            notify("Für neue Projekte gemerkt. Bestehende Projekte bleiben unverändert.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        Für neue Projekte merken
      </button>

      <div className="color-grid">
        <label className="color-field">
          <input type="checkbox" checked={Boolean(s.frame_on)} onChange={(e) => setStyle({ frame_on: e.target.checked })} aria-label="Umrandung der Legende an" />
          <input type="color" value={s.frame || "#000000"} onChange={(e) => setStyle({ frame: e.target.value })} aria-label="Farbe Umrandung der Legende" />
          <span>Umrandung</span>
          <InfoTip text="Rahmen der ganzen Legende. Für den Titel in der Liste «Titel» anklicken." />
        </label>
      </div>

      <div className="section">
        Export
        <InfoTip text={"Speichert zuerst die Legende.\nDateiname aus Bezeichnung und Abschnitt.\nPDF ist dieselbe Zeichnung, 1:1 in mm, 5 mm Rand.\nDXF R2013, Truecolor, Symbole als Blöcke. Das Blatt bleibt weiss."} />
      </div>
      <label className="field">
        <span>Was exportieren</span>
        <select className="select" value={exportBlock} onChange={(e) => setExportBlock(e.target.value)}>
          <option value="">Ganze Legende</option>
          {doc.blocks.map((b) => (
            <option key={b.id} value={b.id}>
              Nur {b.title || "(ohne Überschrift)"}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label className="toggle" style={{ color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={exportGeneral && hasGeneral}
            onChange={(e) => {
              if (!hasGeneral) {
                notify("Es ist keine Servervorlage für den Allgemeinteil eingestellt. Der Export läuft ohne ihn.", true);
                return;
              }
              setExportGeneral(e.target.checked);
            }}
          />
          Allgemeinteil zeigen
        </label>
        <InfoTip text="Gilt für diese Legende: Vorschau, DXF, DWG und PDF. Aus z. B. für eine Legende nur mit UKV. Verknüpfte DXF- oder DWG-Datei unter dem Titel. Hat sie eine Textspalte, nutzt sie Schriftgrösse, Symbolgrösse, Abstand und Spalten dieser Legende. Die Zeichnung bleibt gesperrt. N4D wird nicht gelesen." />
      </div>
      <label className="field">
        <span>Liniendicke im PDF <InfoTip text="Original: jede Linie so dick wie in der Zeichnung. Proportional: ein verkleinertes Symbol bekommt dünnere Linien, ein vergrössertes dickere (0,09 bis 0,5 mm). DXF und DWG behalten die Original-Liniendicke." /></span>
        <select className="select" aria-label="Liniendicke im PDF" value={s.pdf_lines ?? "original"}
          onChange={(e) => setStyle({ pdf_lines: e.target.value as "original" | "proportional" })}>
          <option value="original">Original-Liniendicke</option>
          <option value="proportional">Proportionale Skalierung der Liniendicke</option>
        </select>
      </label>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" disabled={exporting} onClick={() => onExport("dxf", exportBlock, exportGeneral && hasGeneral)}>
          DXF
        </button>
        <button className="btn small" disabled={exporting} onClick={() => onExport("dwg", exportBlock, exportGeneral && hasGeneral)}>
          DWG
        </button>
        <button className="btn small" disabled={exporting} onClick={() => onExport("pdf", exportBlock, exportGeneral && hasGeneral)}>
          PDF
        </button>
      </div>
      {!info.oda && (
        <p className="hint">
          DWG braucht den ODA File Converter.{" "}
          <a href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noreferrer">Herunterladen</a>
        </p>
      )}
      <button className="btn small" type="button" onClick={() => exportDiagnostic(projectId, notify)}>Prüfbericht</button>
    </>
  );
}
