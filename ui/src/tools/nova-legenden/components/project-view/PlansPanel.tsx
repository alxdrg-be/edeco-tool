import { useRef, useState } from "react";
import { api, type ProjectDetail } from "../../api";
import { formatDateTime } from "../../uiState";
import { changeHint } from "../ChangesTab";
import Desc from "../Desc";
import Menu from "../Menu";
import type { ImportStatus, Run, SetData, Tab } from "./types.ts";

const DETACH_TEXT = "Entfernt nur die gespeicherte Plandatei. Importierte Anzahlen und Versionen bleiben erhalten.";

export interface PlansPanelProps {
  projectId: string; plans: ProjectDetail["plans"]; planTotals: Record<number, number>;
  plansExpanded: boolean; toggleOpen: (next: boolean) => void; tab: Tab; busy: boolean;
  run: Run; setData: SetData; reorder: (ids: number[]) => void; openImport: (files: File[]) => void;
  setPending: (pending: { files: File[]; planId?: number }) => void;
  importStatus: ImportStatus | null; setImportStatus: (status: ImportStatus | null) => void;
}

export function PlansPanel({ projectId, plans, planTotals, plansExpanded, toggleOpen, tab, busy, run, setData, reorder, openImport, setPending, importStatus, setImportStatus }: PlansPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const reimportRef = useRef<HTMLInputElement>(null);
  const [reimportPlan, setReimportPlan] = useState<number | null>(null);
  const [dragPlan, setDragPlan] = useState<number | null>(null);
  const [dropHot, setDropHot] = useState(false);
  return (
    <details
      className={`card fold ${dropHot ? "drop-hot" : ""}`}
      open={plansExpanded}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        if (next !== plansExpanded) toggleOpen(next);
      }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDropHot(true);
      }}
      onDragLeave={() => setDropHot(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files?.length) return;
        e.preventDefault();
        setDropHot(false);
        openImport([...e.dataTransfer.files]);
      }}
    >
      <summary onClick={(e) => plans.length === 0 && e.preventDefault()}>
        Pläne · {plans.length === 1 ? "1 Geschoss" : `${plans.length} Geschosse`}
        {!plansExpanded && tab !== "legend" && <span className="hint">Dateien hierher ziehen importiert Geschosse (mehrere möglich)</span>}
        {importStatus?.kind === "busy" && <span className="hint">· importiert …</span>}
      </summary>
      <Desc short="Ein Plan pro Geschoss." more="Datei hierher ziehen oder unten wählen. Formate: DXF, N4D und N4M (Nova-Modell), DWG mit ODA File Converter. Geschosse sortierst du durch Ziehen am Griff ⠿ oder mit ↑ ↓." />
      {plans.length > 0 && (
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Geschoss</th>
                <th>Plandatei</th>
                <th className="type-col">Typ</th>
                <th>Letzter Import</th>
                <th className="num-col">Apparate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => (
                <tr
                  key={p.id}
                  draggable
                  onDragStart={() => setDragPlan(p.id)}
                  onDragOver={(e) => {
                    if ([...e.dataTransfer.types].includes("Files")) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (e.dataTransfer.files?.length || dragPlan == null || dragPlan === p.id) return;
                    e.preventDefault();
                    const ids = plans.map((x) => x.id);
                    ids.splice(ids.indexOf(dragPlan), 1);
                    ids.splice(i, 0, dragPlan);
                    setDragPlan(null);
                    reorder(ids);
                  }}
                >
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="handle" title="Ziehen zum Sortieren" aria-hidden>
                      ⠿
                    </span>
                    <b>{p.name}</b>
                  </td>
                  <td>
                    {p.file_name ? (
                      <span title={p.file_name}>{p.file_name}</span>
                    ) : (
                      <span className="hint">Plandatei entfernt</span>
                    )}
                    <div className="hint">
                      {p.versions === 1 ? "1 Importversion" : `${p.versions} Importversionen`}
                      {p.versions > 1 && p.change_summary ? ` · ${changeHint(p.change_summary)}` : ""}
                    </div>
                  </td>
                  <td className="type-col">{p.format ? p.format.toUpperCase() : ""}</td>
                  <td>
                    {p.imported_at ? formatDateTime(p.imported_at) : ""}
                    <div className="hint">{p.imported_by}</div>
                  </td>
                  <td className="num-col">{planTotals[p.id]}</td>
                  <td className="plan-actions">
                    <div>
                      <button
                        className="btn small"
                        disabled={busy}
                        title="Neue Version einlesen, die alte bleibt zum Vergleich"
                        onClick={() => {
                          setReimportPlan(p.id);
                          reimportRef.current?.click();
                        }}
                      >
                        Neue Planversion importieren
                      </button>
                      <button
                        className="btn small"
                        disabled={busy || i === 0}
                        aria-label={`${p.name} nach oben`}
                        title="Nach oben"
                        onClick={() => {
                          const ids = plans.map((x) => x.id);
                          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                          reorder(ids);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="btn small"
                        disabled={busy || i === plans.length - 1}
                        aria-label={`${p.name} nach unten`}
                        title="Nach unten"
                        onClick={() => {
                          const ids = plans.map((x) => x.id);
                          [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                          reorder(ids);
                        }}
                      >
                        ↓
                      </button>
                      <Menu label="Weitere Aktionen" disabled={busy}>
                        <button
                          onClick={async () => {
                            const name = window.prompt("Name des Geschosses", p.name);
                            if (!name || name === p.name) return;
                            const r = await run(() => api.renamePlan(projectId, p.id, name), "Geschoss umbenannt");
                            if (r) setData(r);
                          }}
                        >
                          Geschoss umbenennen
                        </button>
                        <button
                          className="danger"
                          disabled={!p.file_name}
                          onClick={async () => {
                            if (!window.confirm(`Datei von «${p.name}» entfernen?\n\n${DETACH_TEXT}`)) return;
                            const r = await run(() => api.detachPlan(projectId, p.id), "Plandatei entfernt, Anzahlen bleiben");
                            if (r) setData(r);
                          }}
                        >
                          Datei entfernen
                          <span className="hint">{p.file_name ? DETACH_TEXT : "Keine Plandatei gespeichert."}</span>
                        </button>
                      </Menu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <input
        ref={reimportRef}
        type="file"
        accept=".dxf,.dwg,.n4d,.n4m"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && reimportPlan) setPending({ files: [f], planId: reimportPlan });
          e.target.value = "";
        }}
      />
      <div className="head-fields" style={{ marginTop: 12 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".dxf,.dwg,.n4d,.n4m"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = "";
            if (list.length) openImport(list);
          }}
        />
        <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          Pläne importieren …
        </button>
        <span className="hint" style={{ lineHeight: "34px" }}>
          Mehrere DXF, DWG, N4D oder N4M auf einmal: wählen oder hierher ziehen. Danach Geschossnamen prüfen.
        </span>
      </div>
      {importStatus && (
        <div className={`import-status ${importStatus.kind}`} role="status" aria-live="polite">
          <b>{importStatus.kind === "busy" ? "Läuft: " : importStatus.kind === "ok" ? "Fertig: " : "Fehler: "}</b>
          {importStatus.text}
          {importStatus.kind !== "busy" && (
            <>
              {" "}
              <button className="btn small" onClick={() => setImportStatus(null)}>
                Ausblenden
              </button>
            </>
          )}
        </div>
      )}
    </details>
  );
}
