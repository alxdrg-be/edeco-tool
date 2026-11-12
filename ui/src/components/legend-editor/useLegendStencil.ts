import { useEffect, useMemo, useState } from "react";
import { api, type StencilData } from "../../api";

export function useLegendStencil(projectId: string) {
  // your Nova user stencil: loaded once per editor, one tab open at a time
  const [stencil, setStencil] = useState<StencilData | null>(null);
  const [stencilTab, setStencilTab] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.stencils(projectId).then((r) => alive && setStencil(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [projectId]);
  const openStencilEntries = useMemo(() => {
    if (!stencil || !stencilTab) return [];
    const [si, ti] = stencilTab.split(":").map(Number);
    return stencil.sets[si]?.tabs[ti]?.entries ?? [];
  }, [stencil, stencilTab]);
  return { stencil, stencilTab, setStencilTab, openStencilEntries };
}
