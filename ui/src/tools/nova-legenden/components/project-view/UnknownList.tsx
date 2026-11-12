import { useEffect, useState } from "react";
import { api, DATASET_LABEL, FamilyItem, ProjectDetail, Suggestion, UnknownElement } from "../../api";
import Desc from "../Desc";

export function UnknownList({
  projectId,
  plans,
  items,
  notify,
  onChanged,
}: {
  projectId: string;
  plans: ProjectDetail["plans"];
  items: UnknownElement[];
  notify: (text: string, error?: boolean) => void;
  onChanged: () => void;
}) {
  if (!items.length) return <div className="empty">Alle Elemente sind erkannt.</div>;
  return (
    <div className="unknown-list">
      <Desc short="Wähle für jedes Element das passende Symbol." more="Die Entscheidung gilt für die ganze Firma und bei jedem weiteren Import automatisch." />
      {items.map((u) => (
        <UnknownCard key={u.source_key} projectId={projectId} plans={plans} item={u} notify={notify} onChanged={onChanged} />
      ))}
    </div>
  );
}

export function UnknownCard({
  projectId,
  plans,
  item,
  notify,
  onChanged,
}: {
  projectId: string;
  plans: ProjectDetail["plans"];
  item: UnknownElement;
  notify: (text: string, error?: boolean) => void;
  onChanged: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FamilyItem[]>([]);

  useEffect(() => {
    api
      .suggestions(projectId, item.source_key)
      .then((r) => setSuggestions(r.items))
      .catch((e) => notify((e as Error).message, true));
  }, [projectId, item.source_key, notify]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = window.setTimeout(() => {
      api
        .families({ q: search, category: "", dataset: "", mounting: "", all_variants: true })
        .then((r) => setResults(r.items.slice(0, 12)))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(h);
  }, [search]);

  async function choose(symbolKey: string, label: string) {
    try {
      await api.setMapping(item.source_key, symbolKey, item.name);
      notify(symbolKey === "__ignore__" ? `«${item.name}» wird ignoriert` : `«${item.name}» = ${label}`);
      onChanged();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }

  return (
    <div className="unknown-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <b>{item.name || "(ohne Namen)"}</b>
          <div className="hint">
            {item.item && `Code ${item.item} · `}
            {item.graphic_name && `Grafik «${item.graphic_name}» · `}
            {plans
              .filter((p) => item.counts[p.id])
              .map((p) => `${p.name}: ${item.counts[p.id]}`)
              .join(", ")}{" "}
            · Ebenen: {Object.keys(item.layers).join(", ")}
          </div>
        </div>
        <button className="btn small" onClick={() => choose("__ignore__", "")}>
          Kein Apparat (ignorieren)
        </button>
      </div>
      <div className="suggestions">
        {suggestions === null && <span className="hint">Vorschläge werden berechnet …</span>}
        {suggestions?.map((s) => (
          <button
            key={s.symbol_key}
            className="suggestion"
            onClick={() => choose(s.symbol_key, s.name)}
            title={Object.entries(s.parts).map(([k, v]) => `${k} ${v} %`).join(" · ")}
          >
            <div className="pic">
              {s.svg ? <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: s.svg }} /> : "–"}
            </div>
            <div className="name">{s.name}</div>
            <div className="hint">
              {s.item} · {DATASET_LABEL(s.dataset)}
            </div>
            <div className="score">{s.score} %</div>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Anderes Symbol suchen (Name oder Code)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {results.length > 0 && (
        <div className="suggestions">
          {results.map((r) => (
            <button key={r.id} className="suggestion" onClick={() => choose(r.representative.key, r.representative.name)}>
              <div className="pic">
                {r.representative.svg ? (
                  <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: r.representative.svg }} />
                ) : (
                  "–"
                )}
              </div>
              <div className="name">{r.representative.name}</div>
              <div className="hint">
                {r.representative.item} · {DATASET_LABEL(r.representative.dataset)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
