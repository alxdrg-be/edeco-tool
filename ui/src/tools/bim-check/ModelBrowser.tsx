import { lazy, Suspense, useMemo, useState } from "react";
import { Box, Boxes, List, Map as MapIcon, Search } from "lucide-react";
import RoomPlan from "./RoomPlan";
import Paging, { pageStart, PAGE_SIZE } from "./Paging";
import { count, elementLabel, floorLabel, isRoom, measure, quantity, type BuildingModel, type ModelElement, type Report } from "./model";

const RoomScene3D = lazy(() => import("./RoomScene3D").catch(() => ({
  default: () => <p className="bc-inline-error" role="alert">Die 3D-Ansicht konnte nicht geladen werden. Die Raumliste und der Inspektor stehen weiterhin zur Verfügung.</p>,
})));

const IfcViewer = lazy(() => import("./IfcViewer").catch(() => ({
  default: () => <p className="bc-inline-error" role="alert">Der IFC-Viewer konnte nicht geladen werden. Die bisherige 3D-Ansicht steht weiterhin zur Verfügung.</p>,
})));

export type RoomView = "plan" | "scene" | "viewer" | "list";

export default function ModelBrowser({ model, modelUrl, floor, roomsOnly, view, onView, query, onQuery, selected, onSelect, report, colorMode, onColorMode }: {
  model: BuildingModel; modelUrl: string; floor: string | null; roomsOnly: boolean; view: RoomView; report: Report | null;
  colorMode: "ifc" | "status"; onColorMode: (mode: "ifc" | "status") => void;
  onView: (view: RoomView) => void; query: string; onQuery: (query: string) => void;
  selected: string | null; onSelect: (id: string) => void;
}) {
  const [pagination, setPagination] = useState({ floor, page: 0 });
  const page = pagination.floor === floor ? pagination.page : 0;
  const setPage = (n: number) => setPagination({ floor, page: n });
  const byFloor = useMemo(() => model.elements.filter(item => isRoom(item) === roomsOnly && (floor === null || item.storey === floor)),
    [model, roomsOnly, floor]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de-CH");
    if (!q) return byFloor;
    return byFloor.filter(item => [item.name, item.number, item.ifc_class, item.id, item.storey].some(s => s.toLocaleLowerCase("de-CH").includes(q)));
  }, [byFloor, query]);
  const visibleIds = useMemo(() => new Set(filtered.map(item => item.id)), [filtered]);
  const withGeometry = useMemo(() => roomsOnly ? byFloor.filter(item => item.polygons.length > 0) : [], [roomsOnly, byFloor]);
  const roomLabels = useMemo(() => new Map(model.elements.filter(isRoom).map(item => [item.id, elementLabel(item)])), [model]);
  const roomStoreys = useMemo(() => model.summary.storeys.filter(entry => entry.rooms > 0), [model]);
  const singleFloor = floor !== null || roomStoreys.length === 1;
  const canDraw = roomsOnly && singleFloor && withGeometry.length > 0;
  const hasViews = model.source === "IFC" && (roomsOnly || model.summary.rooms === 0);
  const hasViewer = model.source === "IFC";
  const viewer = hasViewer && view === "viewer";
  const scene = hasViews && view === "scene";
  const plan = canDraw && view === "plan";
  const start = pageStart(page, filtered.length);
  return <section className="bc-panel bc-browser" aria-label={roomsOnly ? "Raumansicht" : "Elementliste"}>
    <div className="bc-browser-tools">
      <label className="bc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label={roomsOnly ? "Räume suchen" : "Elemente suchen"} value={query}
        placeholder={roomsOnly ? "Raumnummer oder Name suchen …" : "Name, Klasse oder Kennung suchen …"} onChange={e => { onQuery(e.target.value); setPage(0); }} /></label>
      {hasViewer && <div className="bc-mode" role="group" aria-label="Darstellung">
        {roomsOnly && <button type="button" aria-pressed={plan} disabled={!withGeometry.length}
          title={!withGeometry.length ? "Für diese Auswahl liegt keine IFC-Raumkontur vor" : undefined}
          onClick={() => onView("plan")}><MapIcon size={15} />Grundriss</button>}
        {hasViews && <button type="button" aria-pressed={scene} onClick={() => onView("scene")}><Box size={15} />3D</button>}
        <button type="button" aria-pressed={viewer} onClick={() => onView("viewer")} title="Ganzes IFC mit allen Bauteilen. Probe mit That Open Engine"><Boxes size={15} />IFC-Viewer · Probe</button>
        <button type="button" aria-pressed={!plan && !scene && !viewer} onClick={() => onView("list")}><List size={15} />Liste</button>
      </div>}
    </div>
    {scene && <Suspense fallback={<p className="bc-note" role="status">3D-Ansicht wird geladen …</p>}>
      <RoomScene3D sceneUrl={modelUrl + "/scene"} floor={floor} visibleIds={visibleIds} selected={selected} onSelect={onSelect} roomLabels={roomLabels} />
    </Suspense>}
    {viewer && <Suspense fallback={<p className="bc-note" role="status">IFC-Viewer wird geladen …</p>}>
      <IfcViewer ifcUrl={modelUrl + "/model.ifc"} filename={model.filename} elements={model.elements} floor={floor}
        selected={selected} onSelect={onSelect} report={report} colorMode={colorMode} onColorMode={onColorMode} />
    </Suspense>}
    {plan && <RoomPlan key={floor} rooms={withGeometry} visibleIds={visibleIds} selected={selected} onSelect={onSelect} />}
    {roomsOnly && !canDraw && !scene && !viewer && byFloor.length > 0 && <p className="bc-note">{model.source === "NOVA"
      ? "Raumbezüge aus der Nova-Objektliste. Die Tabelle enthält keine Grundrisskonturen."
      : !singleFloor && withGeometry.length > 0 ? "Wähle ein Geschoss für den Grundriss." : "Die Räume dieses Ausschnitts liegen ohne darstellbare IFC-Kontur vor."}</p>}
    <div className="bc-list-title"><h2>{roomsOnly ? "Raumliste" : "Modellelemente"}</h2><span>{roomsOnly ? (model.source === "NOVA" ? quantity(filtered.length, "Raumbezug", "Raumbezüge") : quantity(filtered.length, "Raum", "Räume")) : quantity(filtered.length, "Element", "Elemente")}{plan ? ` · ${count(withGeometry.length)} mit Kontur im Geschoss` : ""}</span></div>
    {filtered.length ? <div className="bc-table-wrap"><table><caption className="sr-only">{roomsOnly ? "Räume im Modell" : "Elemente im Modell"}</caption>
      <thead><tr><th>{roomsOnly ? "Raumnummer / Name" : "Bezeichnung"}</th><th>Geschoss</th>
        {roomsOnly ? <><th className="bc-numeric">Fläche</th><th className="bc-numeric">Volumen</th></> : <><th>Klasse</th><th className="bc-numeric">Raumbezüge</th></>}</tr></thead>
      <tbody>{filtered.slice(start, start + PAGE_SIZE).map((item: ModelElement) => <tr key={item.id} data-selected={item.id === selected}>
        <td><button type="button" className="bc-link" aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>{elementLabel(item)}</button></td>
        <td>{floorLabel(item.storey)}</td>{roomsOnly ? <><td className="bc-numeric">{measure(item.area_m2, "m²")}</td><td className="bc-numeric">{measure(item.volume_m3, "m³")}</td></> :
          <><td>{item.ifc_class}</td><td className="bc-numeric">{count(item.room_ids.length)}</td></>}</tr>)}</tbody>
    </table></div> : <p className="bc-note">{query.trim() ? "Keine Treffer für diesen Suchbegriff." : roomsOnly ? "In dieser Auswahl gibt es keine Räume." : "In dieser Auswahl gibt es keine weiteren Elemente."}</p>}
    <Paging page={page} total={filtered.length} onChange={setPage} />
  </section>;
}
