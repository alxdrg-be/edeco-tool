import { type PointerEvent as ReactPointerEvent } from "react";
import { GeneralInfo, LegendLayout, LegendPrim, SymbolRender } from "../../api";
import { LegendDoc, LineStyle, Selection, symbolRequestKey } from "../../legend";
import { DASH, DropTarget, tint, innerSvg } from "./editorShared.ts";

export function Prim({
  p,
  symbols,
  general,
  sel,
  pick,
  stale,
  dups,
  variants,
  onSelect,
  onDragStart,
  inert,
}: {
  p: LegendPrim;
  symbols: Record<string, SymbolRender>;
  general: (GeneralInfo & { svg: string; prims: LegendPrim[] }) | null;
  sel: Selection;
  pick?: string;
  stale: Set<string>;
  dups?: Set<string>;
  variants?: Set<string>;
  onSelect: (s: Selection, add?: boolean) => void;
  onDragStart?: (e: ReactPointerEvent, block: string, item: string) => void;
  inert?: boolean;
}) {
  switch (p.t) {
    case "rect":
      if (p.role === "general") {
        if (p.rows) return null;                 // drawn row by row (prims "grow")
        if (general?.kind === "dxf" && general.svg)
          return <image x={p.x} y={p.y} width={p.w} height={p.h} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(general.svg)}`} preserveAspectRatio="xMinYMin meet" />;
        if (general?.kind === "project")
          return (
            <g transform={`translate(${p.x} ${p.y}) scale(${p.fit ?? 1})`}>
              {general.prims.map((q, i) => (
                <Prim key={i} p={q} symbols={symbols} general={null} sel={null} stale={new Set()} onSelect={() => undefined} inert />
              ))}
            </g>
          );
        return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#f5f5f5" stroke="#bbb" strokeWidth={0.2} strokeDasharray="1 1" />;
      }
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} stroke={p.stroke ?? "none"} strokeWidth={p.stroke ? 0.25 : 0} pointerEvents="none" />;
    case "text":
      return (
        <text x={p.x} y={p.y} fontSize={p.size} fontWeight={p.bold ? 700 : 400} fill={p.color} pointerEvents="none">
          {p.text}
        </text>
      );
    case "line":
      // the pattern comes from the layout (same rule as the DXF): it stays readable at any size
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={0.35}
        strokeDasharray={(p.dash?.length ? p.dash.join(" ") : DASH[p.style as LineStyle]) || undefined} strokeLinecap="round" pointerEvents="none" />;
    case "half":
      return (
        <g pointerEvents="none">
          <circle cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={p.color} strokeWidth={0.18} />
          <path d={`M${p.cx} ${p.cy - p.r} A${p.r} ${p.r} 0 0 1 ${p.cx} ${p.cy + p.r} Z`} fill={p.color} />
        </g>
      );
    case "symbol": {
      const r = symbols[symbolRequestKey({ symbol_key: p.key, length_mm: p.length_mm, width_mm: p.width_mm, flat: Boolean(p.flat) })];
      if (!r?.svg || !r.box)
        return (
          <g pointerEvents="none">
            <rect x={p.x0 ?? p.cx - p.w / 2} y={p.y0 ?? p.cy - p.h / 2} width={p.w} height={p.h} fill="none" stroke="#999" strokeWidth={0.15} strokeDasharray="0.6 0.4" />
            <title>{r ? "Keine Symbolvorschau verfügbar" : "lädt …"}</title>
          </g>
        );
      // The drawing keeps its own colours. Its insertion point (ax, ay; Nova y up) sits on the
      // symbol axis; turned around that point, counter-clockwise like the DXF.
      // Parts without own colour take the section colour (currentColor), areas next to
      // coloured lines its lighter tone; own colours stay. Mirrored left-right, then turned.
      const ax = p.ax ?? r.box[0] + r.box[2] / 2;
      const ay = p.ay ?? -(r.box[1] + r.box[3] / 2);
      const color: string = p.color || "#000000";
      return (
        <g
          transform={`translate(${p.cx} ${p.cy}) rotate(${-(p.rot || 0)}) scale(${(p.mirror ? -1 : 1) * p.scale} ${p.scale}) translate(${-ax} ${ay})`}
          pointerEvents="none"
          style={{ color, ["--sym-layer" as string]: tint(color, 0.45) }}
          dangerouslySetInnerHTML={{ __html: innerSvg(r.svg) }}
        />
      );
    }
    case "grow": {
      // one row graphic of the general part. A long stroke is drawn at symbol size and
      // cut at the tile, so the symbol itself stays as large as the other sections.
      const r = general?.row_svgs?.[p.row];
      if (!r) return null;
      if (p.draw_w && p.draw_h) {
        return <g transform={`translate(${p.x + p.w / 2} ${p.y + p.h / 2}) rotate(${-Number(p.rot || 0)})`} pointerEvents="none">
          <svg x={-p.draw_w / 2} y={-p.draw_h / 2} width={p.draw_w} height={p.draw_h} viewBox={r.vb}
            preserveAspectRatio="xMidYMid meet" overflow="visible" dangerouslySetInnerHTML={{ __html: r.svg }} />
        </g>;
      }
      const fullW = Number(p.full_w) || p.w;
      const fullH = Number(p.full_h) || p.h;
      const crop = fullW > p.w + 0.05 || fullH > p.h + 0.05;
      const fx = Number(p.fx) || 0;
      const fy = Number(p.fy) || 0;
      const innerX = crop ? -(fx * fullW) : 0;
      const innerY = crop ? -((1 - fy - p.h / fullH) * fullH) : 0;
      const graphic = (
        <svg x={p.x} y={p.y} width={p.w} height={p.h} overflow={crop ? "hidden" : "visible"} pointerEvents="none">
          <svg x={innerX} y={innerY} width={fullW} height={fullH} viewBox={r.vb} preserveAspectRatio="xMidYMid meet" overflow="visible"
            dangerouslySetInnerHTML={{ __html: r.svg }} />
        </svg>
      );
      const rot = Number(p.rot) || 0;
      if (!rot) return graphic;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      return (
        <g transform={`translate(${cx} ${cy}) rotate(${-rot}) translate(${-cx} ${-cy})`} pointerEvents="none">
          {graphic}
        </g>
      );
    }
    case "hit": {
      if (inert) return null;
      const selected =
        (p.kind === "item" && sel?.type === "item" && sel.item === p.id) ||
        (p.kind === "block" && sel?.type === "block" && sel.block === p.id) ||
        (p.kind === "general" && sel?.type === "general") ||
        (p.kind === "general-row" && sel?.type === "general-row" && sel.id === p.id) ||
        (p.kind === "title" && sel?.type === "title");
      const isStale = p.kind === "item" && stale.has(p.id);
      const picked = p.kind === "item" && pick === p.id;
      const isDup = p.kind === "item" && Boolean(dups?.has(p.id));
      const multiColor = p.kind === "item" && Boolean(variants?.has(p.id));
      if (p.kind === "section")
        return (
          <rect
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            fill="transparent"
            data-hit="section"
            data-block={p.block}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "block", block: p.block });
            }}
          />
        );
      return (
        <rect
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill={selected || picked ? "rgba(11,107,203,0.10)" : "transparent"}
          stroke={multiColor ? "#e8590c" : selected || picked ? "#0b6bcb" : isDup ? "#e8590c" : isStale ? "#c92a2a" : "none"}
          strokeWidth={0.3}
          strokeDasharray={picked ? "1 0.5" : (isStale || isDup) && !selected ? "0.8 0.5" : undefined}
          className="lg-hit"
          data-hit={p.kind}
          data-block={p.block ?? undefined}
          data-id={p.id}
          data-layer-variants={multiColor || undefined}
          onPointerDown={p.kind === "item" && onDragStart ? (e) => onDragStart(e, p.block, p.id) : undefined}
          onClick={(e) => {
            e.stopPropagation();
            const add = e.ctrlKey || e.metaKey || e.shiftKey;
            onSelect(
              p.kind === "item"
                ? { type: "item", block: p.block, item: p.id }
                : p.kind === "block"
                  ? { type: "block", block: p.block }
                  : p.kind === "general-row"
                    ? { type: "general-row", id: p.id }
                    : p.kind === "title"
                      ? { type: "title" }
                      : { type: "general" },
              add,
            );
          }}
        >
          <title>
            {p.kind === "general"
              ? "Kategorie des Allgemeinteils"
              : p.kind === "general-row"
                ? "Anklicken zum Bearbeiten"
                : isDup
                ? "doppelt: Dieses Symbol steht schon weiter oben in der Legende"
                : isStale
                  ? "Kommt in den aktuellen Importen nicht vor"
                  : p.kind === "item"
                    ? "Anklicken zum Bearbeiten, ziehen zum Verschieben"
                    : "Anklicken zum Bearbeiten"}
          </title>
        </rect>
      );
    }
    default:
      return null;
  }
}

/** Grid of one section: the placeholders the entries sit in (rows in the chosen step,
 *  column edges, symbol axis and text line of every column). From the layout, so the
 *  lines match the entries exactly. */
export function GridLines({ g }: { g: LegendPrim }) {
  // one slot per entry (tile or grid row), then the gap between entries
  const slot: number = g.slot ?? g.row;
  const gap: number = g.gap ?? 0;
  const step = slot + gap;
  const tops: number[] = [];
  for (let y = g.y; y < g.y + g.h - 1e-6; y += step) tops.push(y);
  const cols = Array.from({ length: g.cols }, (_, c) => g.x + c * g.colw);
  const tile: number | null = g.tile ?? null;
  return (
    <g className="lg-grid" strokeWidth={0.07} pointerEvents="none" data-step={g.row}>
      <g stroke="#5b87b5" strokeOpacity={0.45}>
        {tops.map((y) => (
          <g key={`y${y}`}>
            <line x1={g.x} y1={y} x2={g.x + g.w} y2={y} />
            <line x1={g.x} y1={y + slot} x2={g.x + g.w} y2={y + slot} />
          </g>
        ))}
        {[...cols, g.x + g.w].map((x) => (
          <line key={`c${x}`} x1={x} y1={g.y} x2={x} y2={g.y + g.h} />
        ))}
      </g>
      {gap > 0 && (
        <g fill="#e8590c" fillOpacity={0.08} stroke="#e8590c" strokeOpacity={0.55} strokeDasharray="0.5 0.4">
          {tops.slice(0, -1).map((y) => (
            <rect key={`gap${y}`} x={g.x} y={y + slot} width={g.w} height={gap}>
              <title>Abstand zwischen Einträgen</title>
            </rect>
          ))}
        </g>
      )}
      {tile && (
        <g stroke="#2b8a3e" strokeOpacity={0.5} fill="none">
          {(g.frames as { x: number; y: number; w: number; h: number }[] | undefined)?.map((r, i) => (
            <rect key={`f${i}`} x={r.x} y={r.y} width={r.w} height={r.h} />
          )) ?? cols.flatMap((x) =>
            tops.map((y) => <rect key={`t${x}-${y}`} x={x + g.axis - tile / 2} y={y + (slot - tile) / 2} width={tile} height={tile} />),
          )}
        </g>
      )}
      <g stroke="#5b87b5" strokeOpacity={0.45} strokeDasharray="0.6 0.6">
        {cols.map((x) => (
          <g key={`a${x}`}>
            <line x1={x + g.axis} y1={g.y} x2={x + g.axis} y2={g.y + g.h} />
            <line x1={x + g.text} y1={g.y} x2={x + g.text} y2={g.y + g.h} />
          </g>
        ))}
      </g>
    </g>
  );
}

/** The cell a dragged entry will take, in the preview where the others already made room. */
export function DropCell({ layout, id }: { layout: LegendLayout; id: string }) {
  const c = layout.prims.find((p) => p.t === "cell" && p.id === id);
  if (!c) return null;
  return (
    <rect x={c.x + 0.3} y={c.y + 0.3} width={c.w - 0.6} height={c.h - 0.6} rx={0.8} fill="rgba(11,107,203,0.12)"
      stroke="#0b6bcb" strokeWidth={0.5} pointerEvents="none" />
  );
}

/** Blue line where a dragged entry will land. */
export function DropMarker({ placed, target, doc }: { placed: LegendLayout; target: DropTarget; doc: LegendDoc }) {
  const hits = placed.prims.filter((p) => p.t === "hit");
  let x = 0;
  let y = 0;
  let w = 0;
  const before = target.before ? hits.find((h) => h.kind === "item" && h.id === target.before) : null;
  if (before) {
    [x, y, w] = [before.x, before.y, before.w];
  } else {
    const items = doc.blocks.find((b) => b.id === target.block)?.items.filter((it) => !it.hidden) ?? [];
    const last = items.length ? hits.find((h) => h.kind === "item" && h.id === items[items.length - 1].id) : null;
    const section = hits.find((h) => h.kind === "section" && h.block === target.block);
    if (last) [x, y, w] = [last.x, last.y + last.h, last.w];
    else if (section) [x, y, w] = [section.x, section.y + section.h - 1, section.w];
    else return null;
  }
  return <line x1={x} y1={y} x2={x + w} y2={y} stroke="#0b6bcb" strokeWidth={0.6} pointerEvents="none" />;
}
