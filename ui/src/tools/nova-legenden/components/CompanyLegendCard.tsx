import { useEffect, useState } from "react";
import { api, CompanyLegend, GeneralInfo } from "../api";
import GeneralPartEditor from "./GeneralPartEditor";
import Desc from "./Desc";
import { downloadBlob } from '../../../shared/download';

/** Legende Allgemein (the drawing) and, separate from it, everything an admin sets. */
export default function CompanyLegendCard({
  canPick,
  choose,
  notify,
}: {
  canPick: boolean;
  choose: (kind: "legend" | "folder", start: string) => Promise<string | null>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [info, setInfo] = useState<(CompanyLegend & { general: GeneralInfo }) | null>(null);
  const [path, setPath] = useState("");
  const [generalMode, setGeneralMode] = useState<"flow" | "cad">("flow");
  const [cadPreview, setCadPreview] = useState<(GeneralInfo & { svg: string }) | null>(null);
  const [admins, setAdmins] = useState("");
  const [textSize, setTextSize] = useState("");
  const [scale, setScale] = useState("");
  const [busy, setBusy] = useState(false);
  const [generalRev, setGeneralRev] = useState(0);

  function apply(r: CompanyLegend & { general: GeneralInfo }) {
    setInfo(r);
    setPath(r.general_path);
    setGeneralMode(r.general_mode ?? "flow");
    setAdmins(r.admins.join(", "));
    setTextSize(String(r.text_size));
    setScale(String(r.symbol_scale));
  }

  useEffect(() => {
    api.companyLegend().then(apply).catch((e) => notify((e as Error).message, true));
  }, [notify]);

  useEffect(() => {
    if (info?.general_mode !== "cad") return;
    let current = true;
    api.companyGeneralPreview().then(result => { if (current) setCadPreview(result); })
      .catch(e => { if (current) notify((e as Error).message, true); });
    return () => { current = false; };
  }, [info?.general_mode, generalRev, notify]);

  if (!info) return null;
  const locked = !info.is_admin;

  async function save(values: Parameters<typeof api.saveCompanyLegend>[0], ok: string) {
    setBusy(true);
    try {
      apply(await api.saveCompanyLegend(values));
      if ("general_path" in values || "general_mode" in values) setGeneralRev((n) => n + 1);
      notify(ok);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  const num = (v: string) => Number(v.replace(",", "."));

  async function downloadCad(format: "dxf" | "pdf") {
    setBusy(true);
    try {
      const name = `edeco-Allgemeinteil-CAD.${format}`;
      downloadBlob(await api.legendExportFile(`/api/company/general/export/${name}?format=${format}`), name);
    } catch (e) { notify((e as Error).message, true); }
    finally { setBusy(false); }
  }

  const me = info.user.toLocaleLowerCase("de-CH");
  return (
    <>
      <div className="card">
        <h3>Legende Allgemein</h3>
        <Desc short="Gemeinsame CAD-Vorlage oder automatisch angeordnete Zeilen." more="Im CAD-Modus bleiben Anordnung, Schrift, Symbole und Farben der Vorlagendatei erhalten. Im Zeilenmodus gelten das Raster und die Zeileneinstellungen des Legendeneditors. Nur Firmen-Admins ändern Quelle und Übernahmemodus." />

        <label className="field"><span>Übernahme der Vorlage</span>
          <select className="input" value={generalMode} disabled={locked || busy} onChange={e => setGeneralMode(e.target.value as "flow" | "cad")}>
            <option value="flow">Zeilen automatisch anordnen</option>
            <option value="cad">CAD-Vorlage wie gezeichnet übernehmen</option>
          </select>
        </label>

        <label className="field">
          <span>Datei oder Ordner (DXF, DWG oder Ordner eines Vorlagen-Projekts)</span>
          <div className="row">
            <input className="input" style={{ flex: 1, minWidth: 260 }} value={path} disabled={locked} title={path} onChange={(e) => setPath(e.target.value)} placeholder="\\\\Server\\CAD\\Legenden\\Legende Allgemein" aria-label="Legende Allgemein" />
            <button
              className="btn"
              disabled={locked || busy || !canPick}
              onClick={async () => {
                const p = await choose("legend", path);
                if (p) setPath(p);
              }}
            >
              Datei wählen …
            </button>
            <button
              className="btn"
              disabled={locked || busy || !canPick}
              title="Ordner eines Vorlagen-Projekts mit Legende"
              onClick={async () => {
                const p = await choose("folder", path);
                if (p) setPath(p);
              }}
            >
              Ordner wählen …
            </button>
            <button className="btn primary" disabled={locked || busy || (path === info.general_path && generalMode === (info.general_mode ?? "flow"))} onClick={() => save({ general_path: path, general_mode: generalMode }, "Legende Allgemein gespeichert")}>
              Speichern
            </button>
            <button className="btn" disabled={busy || path !== info.general_path || generalMode !== (info.general_mode ?? "flow")} title="Gespeicherte Vorlage neu laden; Änderungen zuerst speichern." onClick={async () => {
              setBusy(true);
              try { await api.reloadGeneral(); apply(await api.companyLegend()); setGeneralRev(n => n + 1); }
              catch (e) { notify((e as Error).message, true); }
              finally { setBusy(false); }
            }}>Neu laden</button>
          </div>
        </label>
        <details className="help-inline"><summary>Eigene Vorlagendatei verwenden</summary><p className="hint">
          Empfehlung: die einspaltige Legende einmal als DXF direkt aus Nova speichern und hier eintragen. Eine DXF braucht keinen
          ODA File Converter, eine DWG schon (auf jedem Arbeitsplatz). Im CAD-Modus zeichnest du die komplette Anordnung selbst;
          im Zeilenmodus ordnet das Programm sie in Spalten. Änderst du
          die lokale Datei oder gemeinsame Netzwerkdatei, liest das Programm sie beim nächsten Öffnen der Legende neu. Liegt die Zeichnung im
          Ordner oder heisst sie wie der Ordner mit Endung .dxf oder .dwg, reicht der Ordnerpfad.
        </p></details>
        {info.general.kind ? (
          <p className="hint">
            Gelesen: {info.general.kind === "dxf" ? "DXF/DWG" : "Vorlagen-Projekt"}, {info.general.w} × {info.general.h} mm.
            {info.general.file ? <><br />Datei: {info.general.file}</> : null}
            <br />Steht in jeder Legende zuoberst.
            <br />{info.general_mode === "cad" ? "Die vollständige CAD-Zeichnung bleibt zusammen; es werden keine Titel oder Projektfarben ergänzt." : "Kachelgrösse, Schrift und Abstand gelten für die erzeugte Legende."}
            <br />Einträge darin lassen sich nicht ziehen.
          </p>
        ) : info.general.error ? (
          <p className="warn-text">{info.general.error}</p>
        ) : (
          <p className="hint">
            Keine Legende Allgemein eingetragen.
            <br />Pfad einfügen oder im Programmfenster die Datei wählen.
            <br />Erlaubt sind DXF, DWG und der Ordner eines Vorlagen-Projekts.
            <br />N4D wird nicht gelesen.
          </p>
        )}

        {info.general_mode === "cad" ? <section aria-label="CAD-Allgemeinvorlage Vorschau">
          <p className="hint">Standard-A4: 190 mm Nutzbreite. Breitere Vorlagen werden proportional auf die gewählte Blattbreite verkleinert. Höhe und Seitenverhältnis bleiben zusammengehörig.</p>
          {cadPreview?.error && <p className="warn-text">{cadPreview.error}</p>}
          {cadPreview?.svg && <div role="img" aria-label="Vorschau der vollständigen CAD-Allgemeinvorlage" style={{ background: "#fff", color: "#000", maxHeight: 360, overflow: "auto", border: "1px solid #cbd5e1", padding: 12 }} dangerouslySetInnerHTML={{ __html: cadPreview.svg }} />}
          {cadPreview?.source_hash && <details className="help-inline"><summary>Vorlagenstand</summary><p className="hint">SHA-256: {cadPreview.source_hash}<br />Zeichnungsbreite: {cadPreview.source_width_mm} mm. Die Serverdatei wird nicht verändert.</p></details>}
          <div className="row"><button className="btn" disabled={busy || !cadPreview?.svg} onClick={() => void downloadCad("dxf")}>CAD als DXF herunterladen</button><button className="btn" disabled={busy || !cadPreview?.svg} onClick={() => void downloadCad("pdf")}>CAD als PDF herunterladen</button></div>
        </section> : <GeneralPartEditor notify={notify} reloadKey={generalRev} onSourceChanged={() => {
          api.companyLegend().then(apply).catch(e => notify((e as Error).message, true));
        }} />}
      </div>

      <section className="card admin-box" aria-label="Admin">
        <div className="admin-title">
          <h3>Admin</h3>
          <span className={`admin-badge ${info.is_admin && !info.bootstrap ? "on" : ""}`}>
            {info.bootstrap ? "Offen für alle" : info.is_admin ? "Du bist Admin" : "Nicht Admin"}
          </span>
        </div>
        <p className="desc">
          Angemeldet als <b>{info.user}</b>. Das ist der Windows-Name dieses Computers. Er steht nicht fest im Programm
          und ist im Feld nur ein Vorschlag.
          {info.bootstrap && " Noch kein Admin eingetragen: trage dich zuerst selbst ein."}
        </p>
        <p className="hint">
          {info.bootstrap
            ? "Noch niemand eingetragen: jeder darf ändern und sich selbst eintragen. Steht ein Name drin, sehen das alle. Weitere Namen trägt nur ein Admin ein."
            : info.is_admin
              ? "Du stehst in der Liste. Nur Admins können weitere Namen eintragen oder entfernen."
              : "Die Liste ist gesperrt. Nur die markierten Admins können sie ändern."}
        </p>
        <ul className="admin-list">
          {info.admins.length ? info.admins.map((name) => {
            const mine = name.toLocaleLowerCase("de-CH") === me;
            return (
              <li key={name} className={mine ? "me" : ""}>
                <span className="star" aria-hidden="true">★</span>
                <span>{name}</span>
                {mine && <span className="you">du</span>}
              </li>
            );
          }) : <li className="empty">Noch keine Admins</li>}
        </ul>
        <label className="field">
          <span>Windows-Benutzernamen, durch Komma getrennt</span>
          <div className="row">
            <input className="input" style={{ flex: 1, minWidth: 260 }} value={admins} disabled={locked} onChange={(e) => setAdmins(e.target.value)} placeholder={info.user} aria-label="Admin-Liste" />
            <button
              className="btn primary"
              disabled={locked || busy || admins === info.admins.join(", ")}
              onClick={() => save({ admins: admins.split(",").map((a) => a.trim()).filter(Boolean) }, "Admin-Liste gespeichert")}
            >
              Speichern
            </button>
          </div>
        </label>

        <h4>Standard für neue Projekte</h4>
        <div className="head-fields" style={{ marginTop: 10 }}>
          <label className="field">
            <span>Schriftgrösse (mm)</span>
            <input className="input" style={{ width: 120 }} inputMode="decimal" value={textSize} disabled={locked} onChange={(e) => setTextSize(e.target.value)} />
          </label>
          <label className="field">
            <span>Symbolmassstab</span>
            <input className="input" style={{ width: 120 }} inputMode="decimal" value={scale} disabled={locked} onChange={(e) => setScale(e.target.value)} />
          </label>
          <button
            className="btn primary"
            disabled={locked || busy || (num(textSize) === info.text_size && num(scale) === info.symbol_scale) || !Number.isFinite(num(textSize)) || !Number.isFinite(num(scale))}
            onClick={() => save({ text_size: num(textSize), symbol_scale: num(scale) }, "Firmen-Standard gespeichert. Bestehende Projekte bleiben unverändert.")}
          >
            Speichern
          </button>
        </div>
        <label className="toggle" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={info.hatch_off} disabled={locked || busy}
            onChange={(e) => save({ hatch_off: e.target.checked }, "Firmen-Standard gespeichert. Bestehende Projekte bleiben unverändert.")} />
          Weiche Schraffur in Symbolen aus
        </label>
        <label className="toggle">
          <input type="checkbox" checked={info.fill_off} disabled={locked || busy}
            onChange={(e) => save({ fill_off: e.target.checked }, "Firmen-Standard gespeichert. Bestehende Projekte bleiben unverändert.")} />
          Volle Flächen in Symbolen aus
        </label>
        <p className="hint">Jedes neue Projekt startet mit diesen Werten, ausser es wird aus einer Vorlage erstellt. Dann gelten die Werte der Vorlage.</p>
      </section>
    </>
  );
}
