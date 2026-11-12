import { useCallback, useEffect, useRef, useState } from "react";
import { downloadBlob } from "../../../shared/download";
import { api, Category, ProjectDetail, ProjectSummary } from "../api";
import { planFiles } from "../floors";
import { quantityCsv, quantityFileName, type QuantitySource } from "../quantityList";
import { plansOpen, rememberPlansOpen } from "../uiState";
import ChangesTab from "./ChangesTab";
import LegendEditor from "./LegendEditor";
import LegendTabs from "./LegendTabs";
import ImportDialog from "./ImportDialog";
import ReviewPanel from "./ReviewPanel";
import Menu from "./Menu";
import { useNavigation } from "../Navigation";
import { UnknownList } from "./project-view/UnknownList";
import { PlansPanel } from "./project-view/PlansPanel";
import { QuantityTab } from "./project-view/QuantityTab";
import { LayersTab } from "./project-view/LayersTab";
import { IgnoredTab } from "./project-view/IgnoredTab";
import { ProjectHead } from "./project-view/ProjectHead";
import { useProjectReview } from "./project-view/useProjectReview.ts";
import { useProjectQuantities } from "./project-view/useProjectQuantities.ts";
import type { ImportStatus, Tab } from "./project-view/types.ts";


interface Props {
  projectId: string;
  projects: ProjectSummary[];
  categories: Category[];
  notify: (text: string, error?: boolean) => void;
  onBack: () => void;
  onOpenProject: (id: string) => void;
  onOpenTool?: (id: string) => void;
}



export default function ProjectView({ projectId, projects, categories, notify, onBack, onOpenProject, onOpenTool }: Props) {
  const { navigate } = useNavigation();
  const loadGeneration = useRef(0);
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<Tab>("list");
  const [quantityQuery, setQuantityQuery] = useState("");
  // the selected legend belongs to one project; another project starts with its first legend
  const [legendSel, setLegendSel] = useState<{ project: string; id: number } | null>(null);
  const legendId = legendSel?.project === projectId ? legendSel.id : null;
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ files: File[]; planId?: number } | null>(null);
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [open, setOpen] = useState(true);
  const [editorPlansOpen, setEditorPlansOpen] = useState(false);
  const { review, reviewLoading, loadReview } = useProjectReview(projectId, data, tab);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    try {
      const next = await api.project(projectId);
      if (generation !== loadGeneration.current) return;
      setData(next);
      setNumber(next.meta.project_number || "");
      setTitle(next.meta.name || "");
      setOpen(plansOpen(projectId, next.plans.length));
    } catch (e) {
      if (generation === loadGeneration.current) notify((e as Error).message, true);
    }
  }, [projectId, notify]);

  useEffect(() => {
    setImportStatus(null);
    setEditorPlansOpen(false);
    setQuantityQuery("");
    load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  async function run<T>(action: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await action();
      if (ok) notify(ok);
      return result;
    } catch (e) {
      notify((e as Error).message, true);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  /** New plan version of one floor (per-floor action). New floors go through the import dialog. */
  function openImport(list: File[]) {
    const files = planFiles(list);
    if (!files.length) {
      notify("Nur DXF-, DWG-, N4D- oder N4M-Dateien können importiert werden.", true);
      return;
    }
    setPending({ files });
  }

  function toggleOpen(next: boolean) {
    if (tab === "legend") {
      setEditorPlansOpen(next);
      return;
    }
    setOpen(next);
    rememberPlansOpen(projectId, next);
  }

  async function reorder(ids: number[]) {
    const r = await run(() => api.reorderPlans(projectId, ids));
    if (r) setData(r);
  }

  const { catById, quantityRows, colorById } = useProjectQuantities(data, projectId, categories);

  if (!data || data.id !== projectId) {
    return (
      <div className="page">
        <div className="page-inner">
          <div className="hint">lädt …</div>
        </div>
      </div>
    );
  }

  const plans = data.plans;
  const plansExpanded = plans.length === 0 || (tab === "legend" ? editorPlansOpen : open);
  const secondaryLabels: Partial<Record<Tab, string>> = {
    changes: "Änderungen", unknown: "Unbekannt", layers: "Ebenen und Farben", ignored: "Nicht berücksichtigt",
  };
  function openTab(next: Tab) {
    navigate(() => {
      if (next === "legend") setEditorPlansOpen(false);
      setTab(next);
    });
  }
  const planTotals = Object.fromEntries(plans.map((p) => [p.id, data.rows.reduce((n, r) => n + (r.counts[p.id] ?? 0), 0)]));
  const changeCount = plans.reduce(
    (n, p) => n + (p.change_summary ? p.change_summary.neu + p.change_summary.weg + p.change_summary.geaendert : 0),
    0,
  );
  const toChoose = data.category_colors.filter((c) => c.state === "waehlen").length;
  const headDirty = number !== (data.meta.project_number || "") || title !== data.meta.name;
  const exportName = data.export_name;
  const projectName = data.meta.name;

  function downloadQuantities(rows: QuantitySource[]) {
    const csv = quantityCsv(plans.map((plan) => ({ id: plan.id, name: plan.name })), rows);
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), quantityFileName(projectName));
  }


  async function saveHead() {
    if (!title.trim()) {
      notify("Bezeichnung fehlt", true);
      return;
    }
    await navigate(async () => {
      const r = await run(
        () => api.updateProject(projectId, { name: title.trim(), project_number: number.trim() }),
        "Projekt gespeichert",
      );
      if (r) {
        if (r.id !== projectId) onOpenProject(r.id);
        else setData(r);
      }
    });
  }

  function downloadProject() {
    const link = document.createElement("a");
    link.href = api.exportUrl(projectId);
    link.download = exportName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className={`page project-page ${tab === "legend" ? "is-editing" : ""}`}>
      <div className="page-inner full">
        <ProjectHead projectId={projectId} projects={projects} data={data} busy={busy} run={run} setData={setData}
          number={number} setNumber={setNumber} title={title} setTitle={setTitle} headDirty={headDirty} saveHead={saveHead}
          downloadProject={downloadProject} openTab={openTab} navigate={navigate} onBack={onBack} onOpenProject={onOpenProject} />

        <PlansPanel projectId={projectId} plans={plans} planTotals={planTotals} plansExpanded={plansExpanded} toggleOpen={toggleOpen}
          tab={tab} busy={busy} run={run} setData={setData} reorder={reorder} openImport={openImport} setPending={setPending}
          importStatus={importStatus} setImportStatus={setImportStatus} />

        {pending && (
          <ImportDialog
            projectId={projectId}
            files={pending.files}
            planId={pending.planId}
            plans={plans}
            onClose={() => setPending(null)}
            onDone={(result, summary) => {
              if (result) setData(result);
              setImportStatus({
                kind: summary.failed ? "error" : "ok",
                text: summary.failed
                  ? `${summary.ok} importiert, ${summary.failed} fehlgeschlagen. Details im Fenster.`
                  : `${summary.ok} ${summary.ok === 1 ? "Datei" : "Dateien"} importiert: ${summary.text}.`,
              });
              if (summary.ok) notify(`${summary.ok} ${summary.ok === 1 ? "Plan" : "Pläne"} importiert`);
            }}
          />
        )}

        {plans.length > 0 && (
          <div className="card workspace-card">
            <div className="subtabs" role="tablist">
              <button
                className={`tab ${tab === "list" ? "active" : ""}`}
                onClick={() => openTab("list")}
                title={`${data.rows.length} Zeilen: eine Zeile pro Apparat (Symbolfamilie) über alle Geschosse`}
              >
                Gesamtliste ({data.rows.length})
              </button>
              <button
                className={`tab ${tab === "legend" ? "active" : ""}`}
                onClick={() => openTab("legend")}
                title="Legenden-Editor: Symbole anordnen, Texte bearbeiten, Abschnitte nach Kategorien"
              >
                Legende
              </button>
              <button
                className={`tab ${tab === "review" ? "active" : ""}`}
                onClick={() => openTab("review")}
                title="Was vor der Weitergabe der Legende offen ist"
              >
                Prüfung
                {review && review.blocks > 0 && <span className="tab-dot">{review.blocks}</span>}
                {review?.ready && <span className="ok-text"> ✓</span>}
              </button>
              <div className={`secondary-tabs ${secondaryLabels[tab] ? "active" : ""}`}>
              <Menu label={secondaryLabels[tab] ?? "Weitere Bereiche"}>
              <button
                className="btn small"
                onClick={() => openTab("changes")}
                title="Geänderte Zeilen zum vorigen Import"
              >
                Änderungen{changeCount ? ` (${changeCount})` : ""}
              </button>
              <button
                className="btn small"
                onClick={() => openTab("unknown")}
                title={`${data.unknown.length} Elementarten ohne sichere Erkennung`}
              >
                Unbekannt ({data.unknown.length})
              </button>
              <button
                className="btn small"
                onClick={() => openTab("layers")}
                title={`${toChoose} verwendete Kategorien ohne passende Ebene · ${data.layers.length} Ebenen aus den importierten Plänen`}
              >
                Ebenen und Farben{toChoose ? ` · ${toChoose} Ebene wählen` : ""}
              </button>
              <button
                className="btn small"
                onClick={() => openTab("ignored")}
                title={`${data.ignored.length} Elementarten, die nicht als Apparat zählen (Leitungen, Masse, Beschriftungen, von Hand ignoriert)`}
              >
                Nicht berücksichtigt ({data.ignored.length})
              </button>
              </Menu>
              </div>
              {tab !== "legend" && (
                <button className="btn primary tabs-end" onClick={() => openTab("legend")} title="Legenden-Editor öffnen">
                  Legende bearbeiten
                </button>
              )}
            </div>

            {tab === "list" && (
              <QuantityTab projectId={projectId} data={data} plans={plans} busy={busy} run={run} setData={setData}
                quantityQuery={quantityQuery} setQuantityQuery={setQuantityQuery} quantityRows={quantityRows} catById={catById}
                colorById={colorById} downloadQuantities={downloadQuantities} />
            )}

            {tab === "legend" && (
              <section className="legend-workspace" aria-label="Legendeneditor">
                <header className="legend-workspace-head">
                  <span className="le-badge" aria-hidden>✎</span>
                  <h2 title="Änderungen speichern sich selbst">Legendeneditor</h2>
                  <LegendTabs key={projectId} projectId={projectId} categories={data.category_colors} active={legendId}
                    onSelect={(id) => setLegendSel({ project: projectId, id })} notify={notify} />
                  <button type="button" className="btn small" disabled={!quantityRows.length}
                    title="CSV für Excel: Apparat, Code und Anzahl je Geschoss"
                    onClick={() => downloadQuantities(quantityRows)}>Mengen als CSV</button>
                </header>
                {legendId !== null && (
                  <LegendEditor key={`${projectId}:${legendId}`} projectId={projectId} legendId={legendId || null}
                    data={data} categories={categories} notify={notify} onProjects={() => { void navigate(onBack); }} onOpenTool={onOpenTool} />
                )}
              </section>
            )}

            {tab === "changes" && (
              <ChangesTab
                projectId={projectId}
                stamp={plans.map((p) => `${p.id}:${p.current_version}:${p.versions}`).join(",")}
                notify={notify}
              />
            )}

            {tab === "unknown" && (
              <UnknownList projectId={projectId} plans={plans} items={data.unknown} notify={notify} onChanged={load} />
            )}

            {tab === "layers" && <LayersTab projectId={projectId} data={data} busy={busy} run={run} setData={setData} />}

            {tab === "review" && (
              <ReviewPanel
                review={review}
                loading={reviewLoading}
                fileName={`${data.export_name.replace(/\.zip$/i, "")}-pruefung.txt`}
                onRefresh={loadReview}
                onOpen={openTab}
              />
            )}

            {tab === "ignored" && <IgnoredTab items={data.ignored} run={run} load={load} />}
          </div>
        )}
      </div>
    </div>
  );
}

