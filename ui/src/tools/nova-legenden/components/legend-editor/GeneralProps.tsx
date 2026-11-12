import { useEffect, useState } from "react";
import { GeneralInfo, LegendInfo } from "../../api";
import InfoTip from "../../../../shared/InfoTip";
import { GeneralSection, LegendDoc } from "../../legend";
import { generalSectionOf } from "./editorShared.ts";
import { NumberInput } from "./SymbolBits";

export function GeneralProps({
  doc,
  general,
  company,
  change,
}: {
  doc: LegendDoc;
  general: (GeneralInfo & { svg: string }) | null;
  company: LegendInfo["company"];
  change: (d: LegendDoc) => void;
}) {
  const section = generalSectionOf(doc);
  const set = (patch: Partial<GeneralSection>) => change({ ...doc, general_section: { ...section, ...patch } });
  return (
    <>
      <h4>
        Allgemein
        <InfoTip text={"Der Allgemeinteil beginnt mit einer Überschrift mit Farbakzent. Die Farbcodes stehen kompakt direkt darunter. Eine Zeile anklicken, um Text und Grösse zu ändern. Die Zeichnung selbst bleibt die Firmenvorlage."} />
      </h4>
      <label className="field">
        <span>Titel</span>
        <input className="input" aria-label="Kategorientitel Allgemeinteil" value={section.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="color-grid">
        <label className="color-field">
          <input type="color" value={section.header || "#007f91"} onChange={event => set({ header: event.target.value })} aria-label="Akzentfarbe Allgemeinteil" />
          <span>Akzent</span>
        </label>
        <label className="color-field">
          <input type="color" value={section.text || (section.header_text !== "#ffffff" ? section.header_text : "#000000")} onChange={(e) => set({ text: e.target.value })} aria-label="Schriftfarbe Überschrift Allgemeinteil" />
          <span>Schrift</span>
        </label>
      </div>
      <label className="field">
        <span>Textgrösse Überschrift (Faktor)</span>
        <NumberInput value={section.title_scale} step={0.1} onCommit={(v) => set({ title_scale: Math.max(0.5, Math.min(3, v)) })} />
      </label>
      <details className="legend-help"><summary>ⓘ Quelle und Berechtigung</summary><div><dl className="kv">
        <dt>Quelle</dt>
        <dd style={{ wordBreak: "break-all" }}>{general?.source || "–"}</dd>
        <dt>Admins</dt>
        <dd>
          {company.is_admin && company.admins.length > 0 && <span className="admin-badge on">Du bist Admin</span>}
          {company.admins.length ? company.admins.map((name) => (
            <span key={name} className="admin-chip">★ {name}{name.toLocaleLowerCase("de-CH") === company.user.toLocaleLowerCase("de-CH") ? " (du)" : ""}</span>
          )) : "noch keine"}
        </dd>
      </dl></div></details>
    </>
  );
}

export function GeneralRowProps({
  row,
  admin,
  sourceLook,
  onCompanyLook,
  onSave,
  notify,
}: {
  row: { id: string; key?: string; text: string; heading: boolean; text_scale?: number; symbol_factor?: number; rotation?: number; text_place?: "top" | "middle" | "bottom"; line?: boolean; picture?: "line" | "swatch" | "symbol" } | null;
  admin: boolean;
  sourceLook: boolean;
  onCompanyLook: () => void;
  onSave: (patch: { text?: string; text_scale?: number; symbol_factor?: number; rotation?: number; text_place?: "top" | "middle" | "bottom" }) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [text, setText] = useState(row?.text ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(row?.text ?? ""); }, [row?.id, row?.text]);
  if (!row) return <p className="hint">Zeile nicht gefunden.</p>;
  async function save(patch: { text?: string; text_scale?: number; symbol_factor?: number; rotation?: number; text_place?: "top" | "middle" | "bottom" }) {
    setBusy(true);
    try {
      await onSave(patch);
      notify("Zeile gespeichert. Gilt in allen Legenden.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h4>{row.heading ? "Zwischenüberschrift" : "Zeile im Allgemeinteil"}</h4>
      <details className="legend-help"><summary>ⓘ Darstellung und Geltungsbereich</summary><div>
        {row.heading
          ? "Zwischenüberschrift ohne Symbol, zum Beispiel «Farbcodes». Die Lage in der Rasterzeile stellst du unten ein."
          : row.picture === "swatch"
            ? "Ein Farbcode wird als gleich grosses Farbfeld gezeichnet. Der Text steht daneben."
            : row.line
              ? "Eine Linie bleibt immer gleich lang, damit Strich, Punkt und Farbe lesbar bleiben. Die Symbolgrösse ändert sie nicht."
              : "Das Symbol wird vollständig in die Kachel gesetzt, ohne Führungslinie und ohne Beschriftung aus der Vorlage. Der Text bleibt waagrecht."}
        {admin ? " Die Änderung gilt in allen Projekten." : " Nur Admins können das ändern."}
      </div></details>
      <label className="field">
        <span>Text</span>
        <input className="input" aria-label="Text der Allgemeinteil-Zeile" value={text} disabled={!admin || busy} onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (admin && text.trim() && text !== row.text) save({ text }); }} />
      </label>
      {sourceLook && <div className="legend-source-look"><p className="hint">Diese Legende verwendet die Vorlagenwerte: Faktor 1 und keine zusätzliche Drehung. Texte und Zuordnungen bleiben erhalten.</p>
        <button className="btn small" onClick={onCompanyLook}>Gespeicherte Darstellung verwenden</button></div>}
      <fieldset disabled={sourceLook} style={{ border: 0, margin: 0, padding: 0 }}>
      <div className="form two">
        <label className="field">
          <span>Textgrösse (Faktor)</span>
          <NumberInput label="Textgrösse Faktor Allgemeinteil" value={sourceLook ? 1 : row.text_scale ?? 1} step={0.1} disabled={!admin}
            onCommit={(v) => save({ text_scale: Math.max(0.5, Math.min(3, v)) })} />
        </label>
        {!row.heading && !row.line && row.picture !== "swatch" && (
          <label className="field">
            <span>Symbolgrösse (Faktor)</span>
            <NumberInput label="Symbolgrösse Faktor Allgemeinteil" value={sourceLook ? 1 : row.symbol_factor ?? 1} step={0.1} disabled={!admin}
              onCommit={(v) => save({ symbol_factor: Math.max(0.5, Math.min(2, v)) })} />
          </label>
        )}
      </div>
      {row.heading && (
        <label className="field">
          <span>Lage in der Zeile</span>
          <select className="select" aria-label="Lage der Zwischenüberschrift" value={row.text_place || "bottom"} disabled={!admin || busy}
            onChange={(e) => save({ text_place: e.target.value as "top" | "middle" | "bottom" })}>
            <option value="top">Oben</option>
            <option value="middle">Mittig</option>
            <option value="bottom">Unten</option>
          </select>
        </label>
      )}
      {!row.heading && !row.line && row.picture !== "swatch" && (
        <div className="field">
          <span>Drehung {sourceLook ? 0 : row.rotation || 0}°</span>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            <button className="btn small" disabled={!admin || busy} onClick={() => save({ rotation: ((row.rotation || 0) + 45) % 360 })} title="Um 45 Grad drehen. Der Text bleibt waagrecht.">
              ↻ 45°
            </button>
            <button className="btn small" disabled={!admin || busy} onClick={() => save({ rotation: ((row.rotation || 0) + 90) % 360 })} title="Um 90 Grad drehen. Der Text bleibt waagrecht.">
              ↻ 90°
            </button>
            {(row.rotation || 0) !== 0 && (
              <button className="btn small" disabled={!admin || busy} onClick={() => save({ rotation: 0 })} title="Nur die zusätzliche Drehung aufheben. Die Geometrie aus der Firmenvorlage bleibt erhalten.">
                Vorlagendrehung
              </button>
            )}
          </div>
        </div>
      )}
      </fieldset>
    </>
  );
}
