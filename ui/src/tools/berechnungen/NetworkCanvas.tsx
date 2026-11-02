import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { NetworkDocument, NetworkNode, NetworkNodeKind, NetworkOrientation, NetworkResult, NetworkTone } from "./networkTypes";

export type NetworkSelection = { kind: "node" | "edge"; id: string } | null;
export interface PaletteItem { kind: NetworkNodeKind; device?: string; label: string }
import { routeNetworkEdge, NETWORK_NODE_WIDTH as NODE_WIDTH, NETWORK_NODE_HEIGHT as NODE_HEIGHT } from "./networkRouting";
import { NETWORK_COORDINATE_LIMIT, findAttachmentParent } from "./networkEditor";
import { currentFlowClass } from "./currentFlow";
import "./current-flow.css";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const signal = (tone: NetworkTone = "neutral") => tone === "error" ? "var(--danger)" : tone === "warning" ? "var(--wire)" : tone === "ok" ? "var(--ok)" : "var(--accent)";
const number = (n: number, digits = 1) => Math.abs(n)>=1e6 ? n.toExponential(2) : n.toLocaleString("de-CH", { maximumFractionDigits: digits });

export function NetworkSymbol({ kind, device = "", x = 0, y = 0 }: { kind: NetworkNodeKind; device?: string; x?: number; y?: number }) {
  let glyph;
  if (kind === "source") glyph = <><circle r="24" /><path d="M-17 0q8-18 17 0t17 0M0-35v11M0 24v11" /></>;
  else if (kind === "transformer") glyph = <><circle cx="-11" r="22" /><circle cx="11" r="22" /><path d="M0-35v13M0 22v13" /></>;
  else if (kind === "distribution") glyph = device === "busbar" ? <><path d="M-39-6H39M-39 6H39M0-35V-6M-26 6V28M0 6V35M26 6V28" /></> : device === "meter" ? <><rect x="-26" y="-25" width="52" height="50" rx="4" /><text x="0" y="5" textAnchor="middle" className="np-symbol-text">kWh</text><path d="M0-35v10M0 25v10" /></> : <><rect x="-30" y="-24" width="60" height="48" rx="4" /><path d="M-18-6H18M-18 6H18M0-35v11M0 24v11" />{device === "hak" && <path d="M-13 17 13-17" />}</>;
  else if (kind === "protection") glyph = <><path d="M0-35v12M0 23v12" /><rect x="-22" y="-23" width="44" height="46" rx="3" />{device === "RCD" || device === "RCBO" ? <><path d="M-12 13 0-13 12 13Z" />{device === "RCBO" && <path d="M-17 16 17-16" />}</> : device === "NH" ? <path d="M-6-16V16M6-16V16" /> : device === "SWITCH" ? <path d="M-8 15 11-13" /> : <path d="M-9 15 10-15M-9-9H-4M4 9H9" />}</>;
  else if (device === "motor" || device === "fan") glyph = <><circle r="24" /><text x="0" y="8" textAnchor="middle" className="np-symbol-letter">{device === "motor" ? "M" : "V"}</text><path d="M0-35v11" /></>;
  else if (device === "light") glyph = <><circle r="24" /><path d="M-17-17 17 17M17-17-17 17M0-35v11" /></>;
  else if (device === "socket") glyph = <><circle r="24" /><circle cx="-8" cy="-3" r="2.5" /><circle cx="8" cy="-3" r="2.5" /><path d="M-8 12H8M0-35v11" /></>;
  else if (device === "heater") glyph = <><rect x="-31" y="-21" width="62" height="42" rx="3" /><path d="M-21 0h7l5-10 8 20L8-10 15 0h6M0-35v14" /></>;
  else if (device === "cooker") glyph = <><rect x="-29" y="-23" width="58" height="46" rx="4" /><circle cx="-12" cy="-7" r="7" /><circle cx="12" cy="-7" r="7" /><circle cy="12" r="6" /><path d="M0-35v12" /></>;
  else glyph = <><rect x="-29" y="-22" width="58" height="44" rx="5" /><path d="M-15 0H15M7-8l8 8-8 8M0-35v13" /></>;
  return <g transform={`translate(${x} ${y})`} className="np-symbol" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" data-symbol={device || kind}>{glyph}</g>;
}

function labelLines(label: string): string[] {
  if (label.length <= 20) return [label];
  return [`${label.slice(0, 18).trim()}…`];
}

export default function NetworkCanvas({ document, result, selection, connectFrom, connectMode, onSelect, onPort, onMove, onDrop, onConnect, dragItem, resetViewToken = 0, orientation = "horizontal" }: {
  document: NetworkDocument;
  result: NetworkResult;
  selection: NetworkSelection;
  connectFrom: string | null;
  connectMode: boolean;
  onSelect: (selection: NetworkSelection) => void;
  onPort: (id: string, port: "input" | "output") => void;
  onMove: (id: string, x: number, y: number, stage: "start" | "move" | "end") => void;
  onDrop: (item: PaletteItem, x: number, y: number) => void;
  onConnect: (from: string, to: string) => void;
  dragItem: PaletteItem | null;
  resetViewToken?: number;
  orientation?: NetworkOrientation;
}) {
  const canvas = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), unique = useId().replaceAll(":", "");
  const [size, setSize] = useState({ width: 900, height: 660 });
  const [view, setView] = useState({ x: 0, y: 0, zoom: .8 });
  const viewRef = useRef(view); viewRef.current = view;
  const [placement, setPlacement] = useState<{x:number;y:number;kind:NetworkNodeKind;parent?:NetworkNode}|null>(null);
  const [wirePreview, setWirePreview] = useState<{from:string;x:number;y:number;target?:string}|null>(null);
  const drag = useRef<{kind:"wire";id:string;port:"input"|"output";clientX:number;clientY:number;started:boolean} | { kind: "node"; id: string; x: number; y: number; clientX: number; clientY: number; started: boolean } | { kind: "pan"; x: number; y: number; clientX: number; clientY: number } | null>(null);
  const nodes = new Map(document.nodes.map(node => [node.id, node]));
  const issueTone=(kind:"node"|"edge",id:string):NetworkTone=>{const issues=result.issues.filter(issue=>(kind==="edge"?issue.edgeId:issue.nodeId)===id);return issues.some(issue=>issue.tone==="error")?"error":issues.some(issue=>issue.tone==="warning")?"warning":"neutral";};
  const edgeResults = new Map(result.edges.map(edge => [edge.id, edge])), nodeResults = new Map(result.nodes.map(node => [node.id, node]));
  const incoming = new Set(document.edges.map(edge=>edge.to));
  const routes = new Map(document.edges.map((edge,index)=>[edge.id,routeNetworkEdge(edge,nodes,orientation,index,incoming)]));
  const placementBlocked = placement && document.nodes.some(node=>node.id!==(drag.current?.kind==="node"?drag.current.id:undefined)&&Math.abs(node.x-placement.x)<228&&Math.abs(node.y-placement.y)<195);
  const blockedRoutes = [...routes.values()].filter(route=>route?.blocked).length;
  useEffect(()=>{
    const active=drag.current;
    if(active && active.kind!=="pan" && !document.nodes.some(node=>node.id===active.id)) {
      drag.current=null;setWirePreview(null);setPlacement(null);
    }
  },[document.nodes]);
  useEffect(()=>{if(!dragItem&&drag.current?.kind!=="node")setPlacement(null);},[dragItem]);
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key==="Escape"){drag.current=null;setPlacement(null);setWirePreview(null);}};window.addEventListener("keydown",cancel);return()=>window.removeEventListener("keydown",cancel);},[]);
  const fit = useCallback((complete = false) => {
    if (!document.nodes.length) { setView({ x: 0, y: 0, zoom: 1 }); return; }
    const map=new Map(document.nodes.map(node=>[node.id,node])), ins=new Set(document.edges.map(edge=>edge.to));
    const points=document.edges.flatMap((edge,index)=>routeNetworkEdge(edge,map,orientation,index,ins)?.points??[]);
    const minX = Math.min(...document.nodes.map(node => node.x),...points.map(p=>p.x)) - 45, minY = Math.min(...document.nodes.map(node => node.y),...points.map(p=>p.y)) - 45;
    const width = Math.max(...document.nodes.map(node => node.x + NODE_WIDTH),...points.map(p=>p.x)) - minX + 45, height = Math.max(...document.nodes.map(node => node.y + NODE_HEIGHT+(orientation === "horizontal" && ins.has(node.id)?62:0)),...points.map(p=>p.y)) - minY + 45;
    const zoom = clamp(Math.max(complete ? .01 : size.width >= 600 ? .72 : .8, Math.min(size.width / width, size.height / height, 1)), .01, 2);
    const focus=document.nodes.find(node=>node.kind==="source")??document.nodes[0];
    setView({ x: minX - Math.max(0, size.width / zoom - width) / 2, y: !complete&&height*zoom>size.height ? focus.y+NODE_HEIGHT/2-size.height/zoom/2 : minY - Math.max(0, size.height / zoom - height) / 2, zoom });
  }, [document.nodes,document.edges,orientation,size]);
  const fitRef = useRef(fit); fitRef.current = fit;
  useEffect(() => { fitRef.current(); }, [resetViewToken]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]; if (entry.contentRect.width && entry.contentRect.height) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    }); observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => { fitRef.current(); }, [size]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const rect = element!.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      setView(old => { const zoom = clamp(old.zoom * Math.exp(-event.deltaY * .0015), .01, 2.5); return { x: old.x + x / old.zoom - x / zoom, y: old.y + y / old.zoom - y / zoom, zoom }; });
    }
    element.addEventListener("wheel", wheel, { passive: false }); return () => element.removeEventListener("wheel", wheel);
  }, []);
  function zoomBy(factor: number) {
    setView(old => { const zoom = clamp(old.zoom * factor, .01, 2.5); return { x: old.x + size.width / old.zoom / 2 - size.width / zoom / 2, y: old.y + size.height / old.zoom / 2 - size.height / zoom / 2, zoom }; });
  }
  function startNode(event: React.PointerEvent<SVGGElement>, node: NetworkNode) {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect({ kind: "node", id: node.id });
    if (connectMode) { onPort(node.id, connectFrom ? "input" : "output"); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind: "node", id: node.id, x: node.x, y: node.y, clientX: event.clientX, clientY: event.clientY, started: false };
  }
  function startPan(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind: "pan", x: view.x, y: view.y, clientX: event.clientX, clientY: event.clientY };
    if (event.button === 0) onSelect(null);
  }
  function world(clientX:number,clientY:number) {const rect=canvas.current!.getBoundingClientRect(),v=viewRef.current;return{x:v.x+(clientX-rect.left)/v.zoom,y:v.y+(clientY-rect.top)/v.zoom};}
  function wireTarget(x:number,y:number,from:string) {return document.nodes.find(node=>node.id!==from&&node.kind!=="source"&&x>=node.x-16&&x<=node.x+NODE_WIDTH+16&&y>=node.y-16&&y<=node.y+NODE_HEIGHT+16);}
  function startPort(event:React.PointerEvent<SVGCircleElement>,id:string,port:"input"|"output") {
    event.stopPropagation(); if(event.button!==0)return;
    svg.current?.setPointerCapture(event.pointerId); drag.current={kind:"wire",id,port,clientX:event.clientX,clientY:event.clientY,started:false};
  }
  function clickPort(event:React.MouseEvent) {event.stopPropagation();}
  function move(event: React.PointerEvent<SVGSVGElement>) {
    const current = drag.current; if (!current) return;
    const dx = (event.clientX - current.clientX) / viewRef.current.zoom, dy = (event.clientY - current.clientY) / viewRef.current.zoom;
    if(current.kind === "wire") {
      if(current.port!=="output"||!current.started&&Math.hypot(dx,dy)<3)return;
      current.started=true;const p=world(event.clientX,event.clientY),target=wireTarget(p.x,p.y,current.id);
      setWirePreview({from:current.id,...p,target:target?.id});return;
    }
    if (current.kind === "pan") setView(old => ({ ...old, x: current.x - dx, y: current.y - dy }));
    else {
      if (!current.started && Math.hypot(dx, dy) < 3) return;
      if (!current.started) { current.started = true; onMove(current.id, current.x, current.y, "start"); }
      const x=Math.round(clamp(current.x+dx,-NETWORK_COORDINATE_LIMIT,NETWORK_COORDINATE_LIMIT)/10)*10,y=Math.round(clamp(current.y+dy,-NETWORK_COORDINATE_LIMIT,NETWORK_COORDINATE_LIMIT)/10)*10;
      onMove(current.id,x,y,"move"); const node=nodes.get(current.id); if(node){const parent=findAttachmentParent(document,{x,y},node.kind,node.id);setPlacement(parent?{x,y,kind:node.kind,parent}:null);}

    }
  }
  function end(event:React.PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if(current?.kind === "wire") {if(current.started){const p=world(event.clientX,event.clientY),target=wireTarget(p.x,p.y,current.id);if(target)onConnect(current.id,target.id);}else onPort(current.id,current.port);}
    setWirePreview(null);setPlacement(null);
    if (current?.kind === "node" && current.started) {
      const node = nodes.get(current.id); if (node) onMove(current.id, node.x, node.y, "end");
    }
    drag.current = null;
  }
  function portKey(event: React.KeyboardEvent, id: string, port: "input" | "output") {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onPort(id, port); }
  }
  return <div className="np-canvas-shell">
    <div className="np-canvas-heading"><span><i />Einlinienschema · {orientation === "horizontal" ? "links → rechts" : "oben → unten"}</span><span>{document.nodes.length} Bauteile · {document.edges.length} Leitungen</span></div>
    <div className={`np-canvas${connectMode ? " np-canvas-connect" : ""}`} ref={canvas} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setPlacement(null);}} onDragOver={event => { if (event.dataTransfer.types.includes("application/x-edeco-network-node")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; if(dragItem){const p=world(event.clientX,event.clientY),x=Math.round((p.x-NODE_WIDTH/2)/10)*10,y=Math.round((p.y-NODE_HEIGHT/2)/10)*10;setPlacement({x,y,kind:dragItem.kind,parent:findAttachmentParent(document,{x,y},dragItem.kind)});} } }} onDrop={event => {
      event.preventDefault(); setPlacement(null); const raw = event.dataTransfer.getData("application/x-edeco-network-node");
      try { if (raw.length > 2048) return; const item = JSON.parse(raw) as PaletteItem; if (!["source", "transformer", "distribution", "protection", "load"].includes(item.kind) || typeof item.label !== "string" || item.label.length > 100 || item.device !== undefined && (typeof item.device !== "string" || item.device.length > 30)) return; const rect = canvas.current!.getBoundingClientRect(); onDrop(item, view.x + (event.clientX - rect.left) / view.zoom - NODE_WIDTH / 2, view.y + (event.clientY - rect.top) / view.zoom - NODE_HEIGHT / 2); } catch { /* unrelated drag content is ignored */ }
    }}>
      <svg ref={svg} className="np-network-svg" viewBox={`${view.x} ${view.y} ${size.width / view.zoom} ${size.height / view.zoom}`} role="group" aria-label="Bearbeitbarer Netzplan mit Bauteilen und Leitungen" onPointerDown={startPan} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;setPlacement(null);setWirePreview(null);}} onContextMenu={event => event.preventDefault()}>
        <defs><pattern id={`${unique}-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--line-strong)" /></pattern>{(["neutral", "ok", "warning", "error"] as NetworkTone[]).map(tone => <marker key={tone} id={`${unique}-arrow-${tone}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10Z" fill={signal(tone)} /></marker>)}</defs>
        <rect x={view.x} y={view.y} width={size.width / view.zoom} height={size.height / view.zoom} fill={`url(#${unique}-grid)`} />
        {document.edges.map(edge => {
          const line = routes.get(edge.id), calculation = edgeResults.get(edge.id); if (!line) return null;
          const selected = selection?.kind === "edge" && selection.id === edge.id, tone = calculation?.tone ?? issueTone("edge",edge.id), colour = signal(tone);
          return <g key={edge.id} className={`np-edge${selected ? " np-selected" : ""}`} data-edge-id={edge.id} data-state={tone} data-routing={line.blocked ? "blocked" : "clear"} role="button" tabIndex={0} aria-label={`Leitung ${nodes.get(edge.from)?.label} nach ${nodes.get(edge.to)?.label}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect({ kind: "edge", id: edge.id }); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect({ kind: "edge", id: edge.id }); } }}>
            {selected && !line.blocked && <path d={line.path} fill="none" stroke="var(--accent-soft)" strokeWidth="13" />}
            <path d={line.path} fill="none" stroke="transparent" strokeWidth="17" className="np-edge-hit" />
            <path className={currentFlowClass(calculation?.current,result.valid && Boolean(calculation && calculation.powerKW > 0))} d={line.path} fill="none" stroke={colour} strokeWidth={selected ? 3.5 : 2.5} markerEnd={`url(#${unique}-arrow-${tone})`} />
            <g className="np-edge-label" transform={`translate(${line.labelX} ${line.labelY})`}><rect x="-5" y="-16" width="168" height="45" rx="5" fill="var(--canvas)" stroke={selected ? colour : "var(--line)"} /><text y="1" fill={colour}>{line.blocked ? "Weg überlagert" : calculation ? `${number(calculation.current)} A` : `${edge.values.length || "–"} m · ${edge.values.area || "–"} mm²`.slice(0, 18)}</text><text y="21" fill="var(--muted)">{line.blocked ? "Bitte anordnen" : calculation ? `Σ ΔU ${number(calculation.cumulativeDropPercent, 2)} %` : "Eingaben prüfen"}</text></g>
          </g>;
        })}
        {document.nodes.map(node => {
          const selected = selection?.kind === "node" && selection.id === node.id, calculation = nodeResults.get(node.id), tone = calculation?.tone ?? issueTone("node",node.id), colour = signal(tone), lines = labelLines(node.label);
          const summary = node.kind === "source" ? `${node.values.phases || "–"}~ ${node.values.voltage || "–"} V · ${node.values.maxCurrent || "–"} A` : node.kind === "transformer" ? `${node.values.kva || "–"} kVA · uₖ ${node.values.uk || "–"} %` : node.kind === "load" ? `${node.values.power || "–"} kW · ${node.values.phases || "–"}~` : `${node.values.device?.toUpperCase() || "–"}${node.kind === "protection" && ["LS", "RCBO"].includes(node.values.device) ? ` ${node.values.curve || ""}` : ""} · ${node.values.rated || "–"} A`;
          return <g key={node.id} transform={`translate(${node.x} ${node.y})`} className={`np-node${selected ? " np-selected" : ""}${connectFrom === node.id ? " np-connecting" : ""}`} data-node-id={node.id} data-kind={node.kind} data-state={tone} role="button" tabIndex={0} aria-label={`Bauteil ${node.label}`} onPointerDown={event => startNode(event, node)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect({ kind: "node", id: node.id }); if (connectMode) onPort(node.id, connectFrom ? "input" : "output"); } }}>
            <title>{node.label}</title>
            <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="11" fill="var(--panel)" stroke={selected || connectFrom === node.id || wirePreview?.target === node.id ? "var(--accent)" : colour} strokeWidth={selected ? 3 : 1.5} />
            <text x={NODE_WIDTH / 2} y="20" textAnchor="middle" className="np-node-title">{lines.map((line, index) => <tspan x={NODE_WIDTH / 2} dy={index ? 14 : 0} key={index}>{line}</tspan>)}</text>
            <g color={colour}><NetworkSymbol kind={node.kind} device={node.values.device} x={NODE_WIDTH / 2} y={lines.length === 1 ? 63 : 68} /></g>
            <text x={NODE_WIDTH / 2} y="120" textAnchor="middle" className="np-node-value">{summary.length > 20 ? `${summary.slice(0, 19)}…` : summary}</text>
            {node.kind !== "source" && <circle className="np-port" cx={orientation === "horizontal" ? 0 : NODE_WIDTH / 2} cy={orientation === "horizontal" ? NODE_HEIGHT / 2 : 0} r="6" fill="var(--canvas)" stroke={colour} strokeWidth="2" role="button" tabIndex={0} aria-label={`${node.label}: Eingang verbinden`} onPointerDown={event => startPort(event,node.id,"input")} onClick={event => clickPort(event)} onKeyDown={event => portKey(event, node.id, "input")} />}
            {node.kind !== "load" && <circle className="np-port" cx={orientation === "horizontal" ? NODE_WIDTH : NODE_WIDTH / 2} cy={orientation === "horizontal" ? NODE_HEIGHT / 2 : NODE_HEIGHT} r="6" fill="var(--canvas)" stroke={colour} strokeWidth="2" role="button" tabIndex={0} aria-label={`${node.label}: Ausgang verbinden`} onPointerDown={event => startPort(event,node.id,"output")} onClick={event => clickPort(event)} onKeyDown={event => portKey(event, node.id, "output")} />}
          </g>;
        })}
        {placement && <g className="np-placement-preview" pointerEvents="none" data-attachment-parent={!placementBlocked?placement.parent?.id??"":""}>
          <rect x={placement.x} y={placement.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx="11" fill="var(--accent-soft)" stroke={placementBlocked?"var(--danger)":"var(--accent)"} strokeDasharray="7 5"/>
          {placementBlocked && <text x={placement.x+10} y={placement.y-14} fill="var(--danger)">Bereich belegt · Abstand vergrössern</text>}
          {placement.parent && !placementBlocked && <><path d={orientation==="horizontal"?`M${placement.parent.x+NODE_WIDTH} ${placement.parent.y+NODE_HEIGHT/2}H${placement.x-28}V${placement.y+NODE_HEIGHT/2}H${placement.x}`:`M${placement.parent.x+NODE_WIDTH/2} ${placement.parent.y+NODE_HEIGHT}V${placement.y-25}H${placement.x+NODE_WIDTH/2}V${placement.y}`} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="7 5"/><text x={placement.x+10} y={placement.y-14} fill="var(--accent)">{`Anschluss: ${placement.parent.label.length>19?placement.parent.label.slice(0,18)+"…":placement.parent.label}`}</text></>}
        </g>}
        {wirePreview && nodes.has(wirePreview.from) && (()=>{const from=nodes.get(wirePreview.from)!;const x=orientation==="horizontal"?from.x+NODE_WIDTH:from.x+NODE_WIDTH/2,y=orientation==="horizontal"?from.y+NODE_HEIGHT/2:from.y+NODE_HEIGHT;return <path className="np-wire-preview" d={orientation==="horizontal"?`M${x} ${y}H${(x+wirePreview.x)/2}V${wirePreview.y}H${wirePreview.x}`:`M${x} ${y}V${(y+wirePreview.y)/2}H${wirePreview.x}V${wirePreview.y}`} fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="7 5" pointerEvents="none"/>;})()}
        {!document.nodes.length && <g className="np-empty-canvas"><text x={view.x + size.width / view.zoom / 2} y={view.y + size.height / view.zoom / 2} textAnchor="middle">Bauteile aus der Palette hinzufügen</text></g>}
      </svg>
      <div className="np-view-controls"><button type="button" onClick={() => zoomBy(.8)} aria-label="Netzplan verkleinern"><Minus size={16} /></button><span>{Math.round(view.zoom * 100)} %</span><button type="button" onClick={() => zoomBy(1.25)} aria-label="Netzplan vergrössern"><Plus size={16} /></button><button type="button" onClick={() => fit(true)} aria-label="Netzplan vollständig einpassen" title="Alles einpassen"><Maximize2 size={16} /></button></div>
      {blockedRoutes>0 && <div className="np-routing-hint" role="status">{blockedRoutes} Leitungsweg{blockedRoutes>1?"e":""} durch überlagerte Bauteile blockiert. „Anordnen“ oder Bauteile verschieben.</div>}
      {connectMode && <div className="np-connect-hint" role="status">{connectFrom ? "Ziel-Eingang oder Zielbauteil wählen" : "Ausgang eines Bauteils wählen"}</div>}
    </div>
    <div className="np-canvas-legend"><span><i style={{ background: "var(--accent)" }} />Schema / Live-Modell</span><span><i style={{ background: "var(--ok)" }} />Berechnete Bedingungen erfüllt</span><span><i style={{ background: "var(--wire)" }} />Prüfung offen / nahe Grenze</span><span><i style={{ background: "var(--danger)" }} />Grenze überschritten / ungültig</span><span>Bewegte Linie: berechnete Last &gt; 0 · symbolischer Leistungsfluss</span><span className="np-pan-hint">Ausgang → Eingang ziehen: verbinden · Bauteil ziehen: verschieben · Mausrad: zoomen</span></div>
  </div>;
}
