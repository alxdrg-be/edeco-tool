import { api, DATASET_LABEL, type Category, type ProjectDetail } from "../../api";
import { quantityMatches, type QuantitySource } from "../../quantityList";
import { layerStateText } from "../../uiState";
import { GroupRows } from "./GroupRows";
import { LayerSelect } from "./LayerSelect";
import type { Run, SetData } from "./types.ts";

export interface QuantityTabProps {
  projectId: string; data: ProjectDetail; plans: ProjectDetail["plans"]; busy: boolean; run: Run; setData: SetData;
  quantityQuery: string; setQuantityQuery: (query: string) => void; quantityRows: QuantitySource[];
  catById: Record<string, Category>; colorById: Record<string, ProjectDetail["category_colors"][number]>;
  downloadQuantities: (rows: QuantitySource[]) => void;
}

export function QuantityTab({ projectId, data, plans, busy, run, setData, quantityQuery, setQuantityQuery, quantityRows, catById, colorById, downloadQuantities }: QuantityTabProps) {
  const quantityNeedle = quantityQuery.trim();
  const visibleQuantities = quantityRows.filter((row) => quantityMatches(row, quantityQuery));
  const visibleRecognized = new Set(
    visibleQuantities.filter((row) => row.assignment === "erkannt").map((row) => row.key),
  );
  const visibleUnknown = visibleQuantities.filter((row) => row.assignment === "unbekannt");

  // Group the overall list by the first category of each row
  const groups: { cat: Category | null; rows: typeof data.rows }[] = [];
  for (const row of data.rows) {
    if (quantityNeedle && !visibleRecognized.has(row.family_key)) continue;
    const cat = catById[row.categories[0]] ?? null;
    const last = groups[groups.length - 1];
    if (last && last.cat?.id === cat?.id) last.rows.push(row);
    else groups.push({ cat, rows: [row] });
  }
  return (
      <>
      <div className="quantity-bar">
        <label className="search-field">
          <input className="search" value={quantityQuery} onChange={(event) => setQuantityQuery(event.target.value)}
            placeholder="Suchen, z. B. RJ45" aria-label="Apparate suchen" />
        </label>
        <button type="button" className="btn small" disabled={!visibleQuantities.length}
          title="CSV für Excel: Apparat, Code und Anzahl je Geschoss"
          onClick={() => downloadQuantities(visibleQuantities)}>Mengen als CSV</button>
        <span className="hint">{quantityNeedle
          ? `${visibleQuantities.length} Treffer. Die CSV entspricht dieser Suche.`
          : `${data.rows.length} erkannte Apparate. Die CSV enthält auch ${data.unknown.length} noch nicht zugeordnete.`}</span>
      </div>
      {quantityNeedle && !groups.length && !visibleUnknown.length && <p className="hint">Kein Apparat passt auf die Suche.</p>}
      <div className="table-scroll sticky">
        <table className="list-table summary">
          <thead>
            <tr>
              <th className="stick stick-1" />
              <th className="stick stick-2">Symbol</th>
              <th>Code · Symbol-Datensatz</th>
              {plans.map((p) => (
                <th key={p.id} className="num-col plan-col" title={p.name}>
                  {p.name}
                </th>
              ))}
              <th className="num-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const info = g.cat ? colorById[g.cat.id] : undefined;
              return (
                <GroupRows
                  key={g.cat?.id ?? "none"}
                  title={g.cat?.title ?? "Ohne Kategorie"}
                  color={info?.color || undefined}
                  layer={info?.layer || ""}
                  state={info ? layerStateText(info).text : ""}
                  colSpan={4 + plans.length}
                  picker={
                    g.cat ? (
                      <LayerSelect
                        value={info?.manual ? info.layer : ""}
                        layers={data.layers}
                        disabled={busy}
                        label={`Ebene für ${g.cat.title}`}
                        onChange={async (layer) => {
                          const r = await run(() => api.setCategoryLayer(projectId, g.cat!.id, layer));
                          if (r) setData(r);
                        }}
                      />
                    ) : undefined
                  }
                >
                  {g.rows.map((r) => (
                    <tr key={r.family_key}>
                      <td className="stick stick-1">
                        <div className="mini-pic">
                          {r.svg ? (
                            <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: r.svg }} />
                          ) : (
                            <span className="hint" title="Keine Symbolvorschau verfügbar. Das Symbol ist erkannt.">
                              –
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="stick stick-2">
                        <b>{r.title}</b>
                        {r.names.length > 0 && <div className="hint">im Plan: {r.names.join(", ")}</div>}
                      </td>
                      <td>
                        {r.item}
                        <div className="hint">{r.datasets.map(DATASET_LABEL).join(", ")}</div>
                      </td>
                      {plans.map((p) => (
                        <td key={p.id} className="num-col plan-col">
                          {r.counts[p.id] ?? ""}
                        </td>
                      ))}
                      <td className="num-col">
                        <b>{r.total}</b>
                        {r.total === 0 && r.sources.length > 0 && (
                          <>
                            {" "}
                            <button
                              className="btn small danger"
                              disabled={busy}
                              title="Entfernt die Zeile mit Total 0 aus den aktuellen Importen"
                              onClick={async () => {
                                const next = await run(() => api.deleteRows(projectId, r.sources), "Zeile gelöscht");
                                if (next) setData(next);
                              }}
                            >
                              Zeile löschen
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </GroupRows>
              );
            })}
            {quantityNeedle && visibleUnknown.length > 0 && (
              <GroupRows title="Unbekannt" layer="" state="noch nicht zugeordnet" colSpan={4 + plans.length}>
                {data.unknown.filter((row) => visibleUnknown.some((item) => item.key === row.source_key)).map((row) => (
                  <tr key={row.source_key}>
                    <td className="stick stick-1" />
                    <td className="stick stick-2"><b>{row.name || "(ohne Namen)"}</b></td>
                    <td>{row.item}</td>
                    {plans.map((plan) => (
                      <td key={plan.id} className="num-col plan-col">{row.counts[plan.id] ?? ""}</td>
                    ))}
                    <td className="num-col"><b>{row.total}</b></td>
                  </tr>
                ))}
              </GroupRows>
            )}
          </tbody>
        </table>
      </div>
      </>
  );
}
