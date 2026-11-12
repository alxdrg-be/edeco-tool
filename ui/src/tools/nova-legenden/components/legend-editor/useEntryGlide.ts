import { useLayoutEffect, useRef, type RefObject } from "react";
import type { LegendLayout } from "../../api";

export function useEntryGlide(paperRef: RefObject<SVGSVGElement | null>, layoutNow: LegendLayout | null) {
  // Entries glide to their new place when the layout changes (drag preview, drop, undo):
  // FLIP, start where the entry was, then let CSS move it to where it is now.
  const entryPos = useRef<Map<string, { x: number; y: number }>>(new Map());
  useLayoutEffect(() => {
    const svg = paperRef.current;
    if (!svg || !layoutNow) return;
    const now = new Map<string, { x: number; y: number }>();
    for (const p of layoutNow.prims) if (p.t === "hit" && p.kind === "item") now.set(p.id, { x: p.x, y: p.y });
    const before = entryPos.current;
    entryPos.current = now;
    if (!before.size || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    svg.querySelectorAll<SVGGElement>("g[data-entry]").forEach((g) => {
      const id = g.dataset.entry ?? "";
      const a = before.get(id);
      const b = now.get(id);
      if (!a || !b || (Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01)) return;
      g.style.transition = "none";
      g.style.transform = `translate(${a.x - b.x}px, ${a.y - b.y}px)`;
      g.getBoundingClientRect();           // apply the start position before the move
      requestAnimationFrame(() => {
        g.style.transition = "transform 180ms cubic-bezier(.2,.7,.3,1)";
        g.style.transform = "";
      });
    });
  }, [layoutNow]);
}
