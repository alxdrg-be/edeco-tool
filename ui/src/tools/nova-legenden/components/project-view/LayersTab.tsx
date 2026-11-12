import { useState } from "react";
import { api, type ProjectDetail } from "../../api";
import { layerStateText } from "../../uiState";
import Desc from "../Desc";
import { LayerSelect } from "./LayerSelect";
import type { Run, SetData } from "./types.ts";

export interface LayersTabProps { projectId: string; data: ProjectDetail; busy: boolean; run: Run; setData: SetData }

export function LayersTab({ projectId, data, busy, run, setData }: LayersTabProps) {
  const [allCategories, setAllCategories] = useState(false);
  const toChoose = data.category_colors.filter((c) => c.state === "waehlen").length;
  const usedCats = data.category_colors.filter((c) => c.used > 0 || c.manual);
  const shownCats = allCategories ? data.category_colors : usedCats;
  return (
    <>
      <Desc short="Jede Kategorie behält ihre Legendenebene." more="Für die Farbe sucht das Programm in den Plänen zuerst denselben Ebenennamen, danach den Namensteil nach der BKP-Nummer (E_232.5_Licht passt zu E_Licht, E_233_Leuchten nicht). Bei mehreren Treffern zählt die Ebene mit den meisten Apparaten. Eine manuell gewählte Ebene gilt nur für dieses Projekt." />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="hint">
          {allCategories
            ? `Alle ${data.category_colors.length} Kategorien`
            : `${usedCats.length} Kategorien mit Apparaten in den aktuellen Importen`}
          {toChoose ? ` · ${toChoose} brauchen eine Ebene` : " · keine offene Entscheidung"}
        </span>
        <label className="toggle">
          <input type="checkbox" checked={allCategories} onChange={(e) => setAllCategories(e.target.checked)} />
          Alle Kategorien anzeigen
        </label>
      </div>
      {shownCats.length === 0 ? (
        <div className="empty">Keine Kategorie hat Apparate in den aktuellen Importen.</div>
      ) : (
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Kategorie</th>
                <th>Zustand</th>
                <th>Farbe</th>
                <th>Ebene für dieses Projekt</th>
              </tr>
            </thead>
            <tbody>
              {shownCats.map((c) => {
                const st = layerStateText(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <b>{c.title}</b>
                      <div className="hint">
                        Legendenebene: {c.legend_layer || "keine"} ·{" "}
                        {c.used ? `${c.used} Apparate` : "keine Apparate"}
                      </div>
                    </td>
                    <td>
                      <span className={`status ${st.cls}`}>{st.text}</span>
                      {st.detail && <div className="hint">{st.detail}</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {c.color ? (
                        <>
                          <span className="swatch big" style={{ background: c.color }} />{" "}
                          <span className="hint">{c.color}</span>
                        </>
                      ) : (
                        <>
                          <span className="swatch big none" />{" "}
                          <span className="hint">{c.layer && c.no_color ? "ohne Farbangabe" : "keine Farbe"}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <LayerSelect
                        value={c.manual ? c.layer : ""}
                        layers={data.layers}
                        disabled={busy}
                        label={`Ebene für ${c.title}`}
                        onChange={async (layer) => {
                          const next = await run(() => api.setCategoryLayer(projectId, c.id, layer));
                          if (next) setData(next);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <h4 style={{ margin: "20px 0 6px" }}>Ebenen aus den Plänen ({data.layers.length})</h4>
      <p className="hint" style={{ marginTop: 0 }}>
        Alle Ebenen der importierten Pläne mit Farbe und Linienart, wie sie in der Datei stehen.
      </p>
      <div className="table-scroll">
        <table className="list-table">
          <thead>
            <tr>
              <th>Farbe</th>
              <th>Ebene</th>
              <th>Linienart</th>
            </tr>
          </thead>
          <tbody>
            {data.layers.map((l) => (
              <tr key={l.name}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span className={`swatch big ${l.color ? "" : "none"}`} style={l.color ? { background: l.color } : undefined} />{" "}
                  <span className="hint">{l.color || "ohne Farbangabe"}</span>
                </td>
                <td style={{ wordBreak: "break-word" }}>{l.name}</td>
                <td>{l.linetype}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
