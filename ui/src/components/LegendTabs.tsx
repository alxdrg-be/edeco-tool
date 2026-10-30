import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { CategoryColor, LegendListItem } from "../api";
import { useNavigation } from "../Navigation";
import { useDialogFocus } from "../useDialogFocus";

interface Props {
  projectId: string;
  categories: CategoryColor[];
  active: number | null;
  onSelect: (legendId: number) => void;
  notify: (text: string, error?: boolean) => void;
}

/** The named legends of a project: switch, add, rename and delete. */
export default function LegendTabs({ projectId, categories, active, onSelect, notify }: Props) {
  const { navigate } = useNavigation();
  const [items, setItems] = useState<LegendListItem[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    api.legends(projectId)
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        // 0: the project has no legend yet; the editor creates the first one when it saves
        if (!r.items.some((l) => l.id === active)) onSelect(r.items.length ? r.items[0].id : 0);
      })
      .catch((e) => alive && notify((e as Error).message, true));
    return () => {
      alive = false;
    };
    // the list is reloaded when the project changes; the selection only checks it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, notify]);

  const current = items.find((l) => l.id === active) ?? null;

  async function saveAs() {
    if (!current) return;
    const name = window.prompt("Name der gespeicherten Legende", current.name)?.trim();
    if (!name) return;
    await navigate(async () => {
      try {
        const r = await api.newLegend(projectId, { name, source: "copy", copy_of: current.id });
        setItems(r.items);
        onSelect(r.legend.id!);
        notify(`Legende «${r.legend.name}» gespeichert`);
      } catch (e) {
        notify((e as Error).message, true);
      }
    });
  }

  async function rename() {
    if (!current) return;
    const name = window.prompt("Neuer Name der Legende", current.name)?.trim();
    if (!name || name === current.name) return;
    try {
      setItems((await api.renameLegend(projectId, current.id, name)).items);
    } catch (e) {
      notify((e as Error).message, true);
    }
  }

  async function remove() {
    if (!current || items.length < 2) return;
    if (!window.confirm(`Legende «${current.name}» löschen? Das lässt sich nicht rückgängig machen.`)) return;
    // pending edits of the legend go out first, then it is deleted
    await navigate(async () => {
      try {
        const r = await api.deleteLegend(projectId, current.id);
        setItems(r.items);
        onSelect(r.items[0]?.id ?? 0);
        notify(`Legende «${current.name}» gelöscht`);
      } catch (e) {
        notify((e as Error).message, true);
      }
    });
  }

  return (
    <div className="legend-tabs">
      <label className="filter-label">
        Legende
        <select
          className="select"
          value={active ?? ""}
          aria-label="Legende wählen"
          title="Gespeicherte Legenden dieses Projekts. Auf dem Server liegt jede in einem eigenen Ordner unter Legenden."
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id !== active) navigate(() => onSelect(id));
          }}
        >
          {items.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>
      <button className="btn small" disabled={!current} onClick={saveAs}
        title="Die aktuelle Legende unter einem neuen Namen speichern">
        Speichern unter…
      </button>
      <button className="btn small" onClick={() => setCreating(true)}>+ Neu</button>
      {current && (
        <span className="legend-tabs-end">
          <button className="btn small" onClick={rename}>Umbenennen</button>
          <button className="btn small" disabled={items.length < 2} onClick={remove}
            title={items.length < 2 ? "Die letzte Legende eines Projekts bleibt bestehen." : "Diese Legende löschen"}>
            Löschen
          </button>
        </span>
      )}
      {creating && (
        <NewLegendDialog
          projectId={projectId}
          categories={categories}
          current={current}
          notify={notify}
          onClose={() => setCreating(false)}
          onDone={(list, id) => {
            setItems(list);
            setCreating(false);
            navigate(() => onSelect(id));
          }}
        />
      )}
    </div>
  );
}

type Source = "proposal" | "categories" | "empty" | "copy";

function NewLegendDialog({ projectId, categories, current, notify, onClose, onDone }: {
  projectId: string;
  categories: CategoryColor[];
  current: LegendListItem | null;
  notify: (text: string, error?: boolean) => void;
  onClose: () => void;
  onDone: (items: LegendListItem[], id: number) => void;
}) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<Source>("categories");
  const [chosen, setChosen] = useState<string[]>([]);
  const [general, setGeneral] = useState<boolean | null>(null);   // null: follows the choice
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, onClose, busy);

  function toggle(id: string) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    // a single chosen category names the legend, as long as no name was typed
    if (!name.trim() && !chosen.length) setName(categories.find((c) => c.id === id)?.title ?? "");
  }

  const valid = name.trim() && (source !== "categories" || chosen.length > 0);
  // sections with their groups; only what the project uses
  const used = categories.filter((c) => (c.used ?? 0) > 0 || !("used" in c));
  const sections = used.filter((c) => !c.parent || !used.some((p) => p.id === c.parent));
  const groupsOf = (id: string) => used.filter((c) => c.parent === id);
  // the full legend shows the general part, a themed one (chosen categories) not
  const withGeneral = general ?? source !== "categories";

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await api.newLegend(projectId, {
        name: name.trim(),
        source: source === "categories" ? "proposal" : source,
        categories: source === "categories" ? chosen : undefined,
        copy_of: source === "copy" ? current?.id ?? null : null,
        general: source === "copy" ? undefined : withGeneral,
      });
      notify(`Legende «${r.legend.name}» angelegt`);
      onDone(r.items, r.legend.id!);
    } catch (e) {
      notify((e as Error).message, true);
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="new-legend-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <h3 id="new-legend-title">Neue Legende</h3>
        <p className="desc">Zum Beispiel eine eigene Legende für die Brandmelder. Jede Legende wird im Projekt gespeichert.</p>
        <div className="form-grid">
          <label htmlFor="new-legend-name">Name</label>
          <input id="new-legend-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Brandmelder" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <label className="toggle choice">
          <input type="radio" checked={source === "categories"} onChange={() => setSource("categories")} />
          Vorschlag aus gewählten Kategorien
        </label>
        {source === "categories" && (
          <div className="legend-cat-pick">
            {sections.map((c) => (
              <div key={c.id} className="legend-cat-section">
                <label className="toggle">
                  <input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span className="swatch" style={{ background: c.color }} /> <b>{c.title}</b>
                  {c.used ? <span className="hint"> {c.used}</span> : null}
                </label>
                {groupsOf(c.id).length > 1 && (
                  <div className="legend-cat-groups">
                    {groupsOf(c.id).map((g) => (
                      <label key={g.id} className="toggle" title={`Nur ${g.title}: eigener Abschnitt «${g.title}»`}>
                        <input type="checkbox" checked={chosen.includes(g.id) || chosen.includes(c.id)}
                          disabled={chosen.includes(c.id)} onChange={() => toggle(g.id)} />
                        {g.title} {g.used ? <span className="hint">{g.used}</span> : null}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!sections.length && <p className="desc">Das Projekt hat noch keine Kategorien mit Apparaten.</p>}
            <p className="hint">Ein Abschnitt nimmt alle seine Gruppen. Eine einzelne Gruppe, z. B. «UKV», wird ein eigener Abschnitt.</p>
          </div>
        )}
        <label className="toggle choice">
          <input type="radio" checked={source === "proposal"} onChange={() => setSource("proposal")} />
          Vorschlag aus allen Kategorien
        </label>
        <label className="toggle choice">
          <input type="radio" checked={source === "copy"} disabled={!current} onChange={() => setSource("copy")} />
          Kopie von «{current?.name ?? "…"}»
        </label>
        <label className="toggle choice">
          <input type="radio" checked={source === "empty"} onChange={() => setSource("empty")} />
          Leer
        </label>
        {source !== "copy" && (
          <label className="toggle" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={withGeneral} onChange={(e) => setGeneral(e.target.checked)} />
            Mit Allgemeinteil
          </label>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn primary" disabled={busy || !valid} onClick={submit}>Anlegen</button>
        </div>
      </div>
    </div>
  );
}
