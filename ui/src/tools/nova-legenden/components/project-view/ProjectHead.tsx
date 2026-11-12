import { api, type ProjectDetail, type ProjectSummary } from "../../api";
import Menu from "../Menu";
import { TrashIcon } from "../Icons";
import type { Navigate, Run, SetData, Tab } from "./types.ts";

export interface ProjectHeadProps {
  projectId: string; projects: ProjectSummary[]; data: ProjectDetail; busy: boolean; run: Run; setData: SetData;
  number: string; setNumber: (value: string) => void; title: string; setTitle: (value: string) => void;
  headDirty: boolean; saveHead: () => void; downloadProject: () => void; openTab: (tab: Tab) => void;
  navigate: Navigate; onBack: () => void; onOpenProject: (id: string) => void;
}

/** Project name, number, switcher and project actions above the plans. */
export function ProjectHead({ projectId, projects, data, busy, run, setData, number, setNumber, title, setTitle, headDirty, saveHead,
  downloadProject, openTab, navigate, onBack, onOpenProject }: ProjectHeadProps) {
  const plans = data.plans;
  return (
    <div className="card project-head">
      <div className="project-breadcrumb">
        <button className="btn small project-back-button" aria-label="Zurück zur Projektübersicht" onClick={() => navigate(onBack)}>
          ← Projekte
        </button>
        <label className="filter-label">
          Projekt wechseln
          <select
            className="select"
            style={{ maxWidth: 320 }}
            value={projectId}
            title="Öffnet ein anderes Projekt aus dem Projektordner"
            onChange={(e) => {
              const id = e.target.value;
              navigate(() => onOpenProject(id));
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_number ? `${p.project_number} · ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="project-heading-line">
        <div>
          <h2 className="project-title">
            {data.meta.project_number && <span className="number">{data.meta.project_number}</span>}
            {data.meta.name}
          </h2>
          <div className="hint">{plans.length} {plans.length === 1 ? "Geschoss" : "Geschosse"} · {data.rows.length} Symbolarten</div>
        </div>
        <div className="project-actions">
        <Menu label="Projektaktionen" disabled={busy}>
          <button
            className="btn small"
            disabled={busy}
            onClick={async () => {
              const name = window.prompt("Name des duplizierten Projekts", `${data.meta.name} Kopie`);
              if (!name) return;
              await navigate(async () => {
                const r = await run(() => api.copyProject(projectId, name), "Projekt dupliziert");
                if (r) onOpenProject(r.id);
              });
            }}
          >
            Projekt duplizieren
          </button>
          <a
            className="btn small"
            href={api.exportUrl(projectId)}
            download={data.export_name}
            onClick={(e) => {
              e.preventDefault();
              navigate(() => downloadProject());
            }}
            title={`Speichert ${data.export_name}: Projektdatei projekt.nlproj und eine Plandatei pro Geschoss.`}
          >
            Projekt als ZIP exportieren
          </a>
          <button className="btn small" disabled={busy} onClick={() => openTab("review")}>
            Fehleranalyse
          </button>
          <button
            className="btn small"
            disabled={busy}
            title="Ändert nur, ob das Projekt beim Anlegen eines neuen Projekts als Vorlage erscheint."
            onClick={async () => {
              const next = data.meta.use_as_template === false;
              const r = await run(
                () => api.updateProject(projectId, { use_as_template: next }),
                next ? "Wieder als Vorlage wählbar" : "Nicht mehr als Vorlage angeboten",
              );
              if (r) setData(r);
            }}
          >
            {data.meta.use_as_template === false ? "Als Vorlage anbieten" : "Vorlage ausblenden"}
          </button>
          <div className="menu-divider" />
          <button
            className="btn danger"
            disabled={busy}
            aria-label="Projekt nach ‚Gelöscht‘ verschieben"
            title="Nach _Geloescht verschieben, nichts geht verloren"
            onClick={async () => {
              if (!window.confirm(`Projekt «${data.meta.name}» in den Ordner _Geloescht verschieben? Nichts wird endgültig gelöscht.`)) return;
              await navigate(async () => {
                const r = await run(() => api.deleteProject(projectId), "Projekt nach _Geloescht verschoben");
                if (r) onBack();
              });
            }}
          >
            <TrashIcon /> Projekt nach ‚Gelöscht‘ verschieben
          </button>
        </Menu>
        </div>
      </div>
      <details className="project-details">
        <summary>Projektdetails bearbeiten{headDirty && <span className="dirty"> · Ungespeicherte Änderungen</span>}</summary>
        <div className="head-fields">
          <label className="field">
            <span>Projektnummer</span>
            <input
              className="input"
              style={{ width: 150 }}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && headDirty && saveHead()}
            />
          </label>
          <label className="field grow">
            <span>Bezeichnung</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && headDirty && saveHead()}
            />
          </label>
          <button className="btn primary" disabled={busy || !headDirty} onClick={saveHead}>
            Speichern
          </button>
          <label className="field">
            <span>Nova-Version des Projekts</span>
            <select
              className="select"
              value={data.meta.nova_version}
              title="Gespeicherte Angabe zum Projekt. Keine Zusage, dass der Import versionsabhängig arbeitet."
              onChange={async (e) => {
                const r = await run(() => api.updateProject(projectId, { nova_version: e.target.value }), "Nova-Version gespeichert");
                if (r) setData(r);
              }}
            >
              <option value="19.2">Nova 19.2</option>
              <option value="20">Nova 20</option>
            </select>
          </label>
        </div>
        <div className="muted-line" title={data.folder}>
          Ordner: {data.folder} · angelegt {data.meta.created_at?.slice(0, 10)} von {data.meta.created_by}
          {data.meta.template_from ? ` · Vorlage: ${data.meta.template_from}` : ""}
        </div>
      </details>
    </div>
  );
}
