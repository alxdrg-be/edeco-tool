import { useEffect, useMemo, useState } from "react";
import { api, Category, FamilyItem, Options, StencilCategoryRow } from "../api";
import { CategoryDraft, draftOf, draftPatch, isDirty } from "../uiState";
import { useNavigation, useUnsavedDraft } from "../Navigation";
import Desc from "./Desc";

interface Props {
  categories: Category[];
  options: Options;
  notify: (text: string, error?: boolean) => void;
  onChanged: () => void | Promise<void>;
}

const OPTION_TEXT: { key: keyof Options; title: string; desc: string }[] = [
  {
    key: "merge_labels",
    title: "Beschriftungsvarianten zusammenfassen",
    desc: "«(Ohne Text)», «(Text horizontal)» usw. erscheinen unter dem UP-Vertreter.",
  },
  {
    key: "merge_orientation",
    title: "Ausrichtungen zusammenfassen",
    desc: "«liegend», «stehend», «rechts» gelten als eine Funktion.",
  },
  {
    key: "show_empty_categories",
    title: "Leere Kategorien anzeigen",
    desc: "Kategorien ohne Symbole erscheinen trotzdem in der Liste.",
  },
  {
    key: "legend_by_category",
    title: "Legende nach Kategorien gliedern",
    desc: "Die Legende zeigt Abschnitte mit Überschriften (wirkt ab Phase 4).",
  },
];

const COMPANY = "Diese Einstellungen gelten für die ganze Firma.";

export default function Categories({ categories, options, notify, onChanged }: Props) {
  const { navigate } = useNavigation();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [saved, setSaved] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newParent, setNewParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [mergeInto, setMergeInto] = useState("");
  const [hints, setHints] = useState<{ kind: string; text: string; ids: string[] }[] | null>(null);

  const byId = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const tops = categories.filter((c) => !c.parent);
  const current = selected ? byId[selected] : undefined;
  const dirty = isDirty(draft, current);
  useUnsavedDraft({ label: `Kategorie «${current?.title ?? ""}»`, dirty, save });

  // After a reload: keep a draft with changes, otherwise show the stored values
  useEffect(() => {
    if (!selected) return;
    const cat = byId[selected];
    if (!cat) {
      setSelected(null);
      setDraft(null);
      return;
    }
    setDraft((d) => (d && isDirty(d, cat) ? d : draftOf(cat)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  async function run(action: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      notify(`${ok} (gilt für die ganze Firma)`);
      await onChanged();
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function select(id: string) {
    if (id === selected) return;
    navigate(() => {
      setSelected(id);
      setDraft(draftOf(byId[id]));
      setSaved("");
    });
  }

  async function save(): Promise<boolean> {
    if (!current || !draft) return true;
    const { patch, error } = draftPatch(draft, current);
    if (error) {
      notify(error, true);
      return false;
    }
    if (!Object.keys(patch).length) return true;
    const ok = await run(() => api.updateCategory(current.id, patch), "Gespeichert");
    if (ok) setSaved(`Gespeichert ${new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`);
    return ok;
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = categories.map((c) => c.id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    setOverId(null);
    run(() => api.reorder(ids), "Reihenfolge gespeichert");
  }

  function move(id: string, delta: number) {
    const ids = categories.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.reorder(ids), "Reihenfolge gespeichert");
  }

  const field = (key: keyof CategoryDraft) => ({
    value: draft?.[key] ?? "",
    onChange: (e: { target: { value: string } }) => {
      setSaved("");
      setDraft((d) => (d ? { ...d, [key]: e.target.value } : d));
    },
  });

  return (
    <div className="page">
      <div className="page-inner full">
        <div className="page-heading"><div><div className="eyebrow">Firmenstandard</div><h1>Kategorien</h1><p>Symbole strukturieren und die Darstellung der Legenden festlegen.</p></div></div>
        <p className="info-line company">
          <b>{COMPANY}</b> Kategorien, Legendenebenen, Nummernkreise und Familienregeln liegen im Firmenordner und
          wirken bei allen Mitarbeitenden.
        </p>
        <div className="split">
          <div className="card">
            <h3>Kategorien der Firma</h3>
            <Desc short="Zeile anklicken zum Bearbeiten." more="Reihenfolge: am Griff ⠿ ziehen oder im Bearbeitungsbereich mit «Nach oben» und «Nach unten». Nummernkreise ordnen Symbole automatisch zu (z. B. 230, 240 für Brandmeldeanlage)." />
            <div className="table-scroll">
              <table className="cat-table">
                <colgroup>
                  <col style={{ width: 30 }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th />
                    <th>Kategorie</th>
                    <th>Übergeordnet</th>
                    <th>Legendenebene</th>
                    <th style={{ textAlign: "right" }}>Symbole</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      aria-selected={selected === c.id}
                      className={`selectable ${selected === c.id ? "selected" : ""} ${dragId === c.id ? "dragging" : ""} ${
                        overId === c.id ? "drop-target" : ""
                      } ${c.hidden ? "hidden-cat" : ""}`}
                      onClick={() => select(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(c.id);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOverId(c.id);
                      }}
                      onDragLeave={() => setOverId(null)}
                      onDrop={() => drop(c.id)}
                    >
                      <td>
                        <span
                          className="handle"
                          draggable
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverId(null);
                          }}
                          title="Ziehen zum Verschieben"
                        >
                          ⠿
                        </span>
                      </td>
                      <td className="wrap" style={{ paddingLeft: c.parent ? 24 : 6 }}>
                        {c.color && <span className="swatch" style={{ background: c.color, width: 12, height: 12, marginRight: 6 }} title={`Firmenfarbe ${c.color}`} />}
                        <b>{c.title}</b>
                        {c.hidden && <span className="badge" style={{ marginLeft: 6 }}>ausgeblendet</span>}
                      </td>
                      <td className="wrap hint">{c.parent ? byId[c.parent]?.title ?? c.parent : "–"}</td>
                      <td className="wrap">{c.layer || <span className="hint">keine</span>}</td>
                      <td style={{ textAlign: "right" }}>{c.family_count ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="head-fields" style={{ marginTop: 12 }}>
              <label className="field grow">
                <span>Neue Kategorie</span>
                <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </label>
              <label className="field">
                <span>Einordnen</span>
                <select className="select" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
                  <option value="">als Hauptkategorie</option>
                  {tops.map((t) => (
                    <option key={t.id} value={t.id}>
                      unter «{t.title}»
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn primary"
                disabled={busy || !newTitle.trim()}
                onClick={() =>
                  run(async () => {
                    const created = await api.createCategory(newTitle.trim(), newParent || null);
                    setNewTitle("");
                    setSelected(created.id);
                    setDraft(draftOf(created));
                  }, "Kategorie angelegt")
                }
              >
                Anlegen
              </button>
            </div>
          </div>

          <div className="card editor" aria-live="polite">
            {!current || !draft ? (
              <>
                <h3>Kategorie bearbeiten</h3>
                <p className="desc">Wähle links eine Kategorie. {COMPANY}</p>
              </>
            ) : (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h3 style={{ wordBreak: "break-word" }}>{current.title}</h3>
                  {dirty ? <span className="dirty">Nicht gespeichert</span> : saved && <span className="saved">{saved}</span>}
                </div>
                <p className="desc">{COMPANY}</p>
                <div className="form">
                  <label className="field wide">
                    <span>Titel</span>
                    <input className="input" {...field("title")} />
                  </label>
                  <label className="field wide">
                    <span>Übergeordnete Kategorie</span>
                    <select className="select" {...field("parent")}>
                      <option value="">keine (Hauptkategorie)</option>
                      {tops
                        .filter((t) => t.id !== current.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field wide">
                    <span>Legendenebene</span>
                    <input className="input" {...field("layer")} placeholder="z. B. E_Licht" />
                  </label>
                  <label className="field">
                    <span>Spalten in der Legende</span>
                    <input className="input" type="number" min={1} max={6} {...field("columns")} />
                  </label>
                  <label className="field">
                    <span>Zeilenabstand (mm)</span>
                    <input className="input" inputMode="decimal" {...field("spacing")} />
                  </label>
                  <label className="field wide">
                    <span>Nummernkreise (durch Komma getrennt)</span>
                    <textarea className="input" rows={3} {...field("sheets")} />
                  </label>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" disabled={busy || !dirty} onClick={save}>
                    Speichern
                  </button>
                  <button
                    className="btn"
                    disabled={busy || !dirty}
                    onClick={() => {
                      setDraft(draftOf(current));
                      setSaved("");
                    }}
                  >
                    Verwerfen
                  </button>
                </div>
                <div className="section">Reihenfolge und Sichtbarkeit</div>
                <div className="row">
                  <button className="btn small" disabled={busy} onClick={() => move(current.id, -1)}>
                    ↑ Nach oben
                  </button>
                  <button className="btn small" disabled={busy} onClick={() => move(current.id, 1)}>
                    ↓ Nach unten
                  </button>
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => api.updateCategory(current.id, { hidden: !current.hidden }),
                        current.hidden ? "Eingeblendet" : "Ausgeblendet",
                      )
                    }
                  >
                    {current.hidden ? "Einblenden" : "Ausblenden"}
                  </button>
                  <button
                    className="btn small danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Kategorie «${current.title}» löschen? Das gilt für die ganze Firma.`))
                        run(() => api.deleteCategory(current.id), "Gelöscht");
                    }}
                  >
                    Löschen
                  </button>
                </div>
                <p className="hint">{current.family_count ?? 0} Symbolfamilien in dieser Kategorie.</p>
                <div className="section">Farbe in der Legende</div>
                <div className="row">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(current.color)}
                      disabled={busy}
                      onChange={(e) =>
                        run(() => api.setCategoryColor(current.id, e.target.checked ? "#808080" : ""),
                          e.target.checked ? "Feste Farbe gesetzt" : "Farbe kommt wieder aus dem Plan")
                      }
                    />
                    Feste Firmenfarbe
                  </label>
                  {current.color && (
                    <input
                      type="color"
                      aria-label="Firmenfarbe der Kategorie"
                      value={current.color}
                      disabled={busy}
                      onChange={(e) => run(() => api.setCategoryColor(current.id, e.target.value), "Farbe gespeichert")}
                    />
                  )}
                </div>
                <p className="hint">
                  {current.color
                    ? "Diese Farbe gilt in jedem Projekt, unabhängig von der Planebene."
                    : "Ohne feste Farbe nimmt die Legende die Farbe der Planebene."}
                </p>
                <div className="section">Zusammenführen</div>
                <div className="row">
                  <select className="select" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}
                    aria-label="Zielkategorie">
                    <option value="">Zielkategorie wählen…</option>
                    {categories.filter((c) => c.id !== current.id).map((c) => (
                      <option key={c.id} value={c.id}>{c.parent ? `${byId[c.parent]?.title ?? ""} › ` : ""}{c.title}</option>
                    ))}
                  </select>
                  <button
                    className="btn small"
                    disabled={busy || !mergeInto}
                    onClick={() => {
                      const target = byId[mergeInto];
                      if (!target) return;
                      if (!window.confirm(`«${current.title}» in «${target.title}» zusammenführen? Nummernkreise, Symbolzuordnungen und Unterkategorien gehen nach «${target.title}», «${current.title}» wird gelöscht. Das gilt für die ganze Firma.`)) return;
                      run(() => api.mergeCategories(current.id, target.id), "Zusammengeführt").then((ok) => {
                        if (ok) {
                          setMergeInto("");
                          setSelected(target.id);
                          setDraft(draftOf(target));
                        }
                      });
                    }}
                  >
                    Zusammenführen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <StencilCard notify={notify} onChanged={onChanged} />

        <UnassignedCard categories={categories} notify={notify} onChanged={onChanged} />

        <div className="card">
          <h3>Regeln für Symbolfamilien und Legende</h3>
          <p className="desc">{COMPANY}</p>
          {OPTION_TEXT.map((o) => (
            <label key={o.key} className="toggle" style={{ display: "flex", alignItems: "flex-start", margin: "8px 0" }}>
              <input
                type="checkbox"
                checked={Boolean(options[o.key])}
                onChange={(e) => run(() => api.saveOptions({ [o.key]: e.target.checked }), "Gespeichert")}
              />
              <span>
                <b style={{ color: "var(--fg)" }}>{o.title}</b>
                <br />
                {o.desc}
              </span>
            </label>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={() => api.checkCategories().then((r) => setHints(r.items), (e) => notify((e as Error).message, true))}
            >
              Kategorien prüfen
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Alle Kategorien und manuellen Zuordnungen auf den Standard zurücksetzen? Das gilt für die ganze Firma.",
                  )
                )
                  run(() => api.resetCategories(), "Standard wiederhergestellt");
              }}
            >
              Kategorien auf Standard zurücksetzen
            </button>
          </div>
          {hints && (
            <div className="category-hints">
              {hints.length === 0 ? (
                <p className="hint">Keine Auffälligkeiten: keine doppelten Namen, keine doppelten Legendenebenen, keine leeren Kategorien.</p>
              ) : (
                <ul>
                  {hints.map((h, i) => (
                    <li key={i}>
                      {h.text}{" "}
                      {h.ids.map((id) => byId[id] && (
                        <button key={id} className="btn small" onClick={() => select(id)}>{byId[id].title} öffnen</button>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Symbol families no rule places (they would land in «Diverse»): an admin sorts them once,
 *  the choice applies in every project. */
function UnassignedCard({ categories, notify, onChanged }: {
  categories: Category[];
  notify: (text: string, error?: boolean) => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<FamilyItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.families({ q: "", category: "", dataset: "", mounting: "", all_variants: false });
      setItems(r.items.filter((f) => f.category_source === "keine Regel"));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
  const options = categories.filter((c) => c.id !== "diverse");

  async function assign(f: FamilyItem, cat: string) {
    if (!cat) return;
    setBusy(true);
    try {
      await api.assign(f.id, [cat]);
      setItems((list) => (list ?? []).filter((x) => x.id !== f.id));
      notify(`«${f.title}» gehört jetzt zu «${byId[cat]?.title ?? cat}» (gilt für die ganze Firma)`);
      onChanged();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Nicht zugeordnet {items ? <span className="badge">{items.length}</span> : null}</h3>
      <Desc short="Symbole, die kein Nummernkreis und keine Namensregel einordnet." more="In der Legende landen sie in «Diverse». Ordne sie einmal einem Abschnitt oder einer Gruppe zu, dann gilt das in allen Projekten." />
      {items && !items.length && <p className="hint">Alle Symbole sind zugeordnet.</p>}
      {items && items.length > 0 && (
        <div className="table-scroll" style={{ maxHeight: 360 }}>
          <table className="list-table">
            <thead><tr><th>Symbol</th><th>Katalog</th><th>Zuordnen</th></tr></thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td className="wrap"><b>{f.title}</b></td>
                  <td className="hint">{f.representative.sheet} · {f.representative.item}</td>
                  <td>
                    <select className="select" disabled={busy} value="" aria-label={`${f.title} zuordnen`}
                      onChange={(e) => assign(f, e.target.value)}>
                      <option value="">wählen…</option>
                      {options.map((c) => (
                        <option key={c.id} value={c.id}>{c.parent ? `${byId[c.parent]?.title ?? ""} › ` : ""}{c.title}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Sections and groups from the company's user stencil: its tabs already sort by trade. */
function StencilCard({ notify, onChanged }: { notify: (text: string, error?: boolean) => void; onChanged: () => void }) {
  const [rows, setRows] = useState<StencilCategoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    api.stencilCategories().then((r) => setRows(r.items)).catch(() => setRows([]));
  }, []);

  async function run<T>(action: () => Promise<T>, ok: (r: T) => string) {
    setBusy(true);
    try {
      const r = await action();
      notify(ok(r));
      setRows((await api.stencilCategories()).items);
      onChanged();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = `/api/stencils/categories/export/${encodeURIComponent("Kategorien aus Benutzerschablone.csv")}`;
    a.download = "Kategorien aus Benutzerschablone.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!rows?.length) return null;
  const changes = rows.filter((r) => r.change);
  const shown = all ? rows : changes;
  return (
    <div className="card">
      <h3>Aus der Benutzerschablone {changes.length ? <span className="badge">{changes.length} Änderungen</span> : null}</h3>
      <Desc short="Vorschlag pro Symbol aus den Registerkarten deiner Schablone."
        more="Die Registerkarte gibt den Abschnitt vor, Namensregeln korrigieren gemischte Karten, z. B. Deckenauslass zu Licht. «Übernehmen» speichert die Zuordnungen in der Firmendatei. In Excel kannst du die Spalte «Vorschlag-ID» ändern und die Datei wieder einlesen." />
      <div className="row" style={{ gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        <button className="btn small primary" disabled={busy || !changes.length}
          onClick={() => run(api.applyStencilCategories, (r) => `${r.applied} Zuordnungen übernommen`)}>
          Alle {changes.length} übernehmen
        </button>
        <button className="btn small" onClick={download}>Als Excel (CSV)</button>
        <label className="btn small" style={{ cursor: "pointer" }}>
          Aus CSV übernehmen
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) run(() => api.importAssignments(f), (r) => `${r.applied} Zuordnungen übernommen${r.skipped ? `, ${r.skipped} übersprungen` : ""}`);
          }} />
        </label>
        <label className="toggle"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Alle {rows.length} zeigen</label>
      </div>
      {shown.length > 0 && (
        <div className="table-scroll" style={{ maxHeight: 360 }}>
          <table className="list-table">
            <thead><tr><th>Symbol</th><th>Registerkarte</th><th>Heute</th><th>Vorschlag</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.family_key} className={r.change ? "" : "muted-row"}>
                  <td className="wrap"><b>{r.name}</b> <span className="hint">{r.item}</span></td>
                  <td className="hint">{r.tab}</td>
                  <td className="wrap">{r.now_label || "–"}</td>
                  <td className="wrap" title={r.reason}>{r.change ? <b>{r.suggestion_label}</b> : r.suggestion_label || "bleibt"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
