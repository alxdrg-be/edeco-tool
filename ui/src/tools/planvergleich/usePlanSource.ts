import { useEffect, useRef, useState } from "react";
import { readJson, responseError } from "../../shared/http";

const api = "/api/tools/pdf-werkstatt";
interface Page { page: number; width: number; height: number; user_unit: number | null }
interface DocumentInfo { id: string; name: string; pages: Page[] }
interface Source extends DocumentInfo { key: string }

function dispose(source: Source | null) {
  if (source) void fetch(`${api}/crop-documents/${encodeURIComponent(source.id)}`, {
    method: "DELETE", headers: { "X-Edeco-Pdf": source.key },
  }).catch(() => {});
}

export type PlanSource = ReturnType<typeof usePlanSource>;
export function usePlanSource() {
  const [doc, setDoc] = useState<Source | null>(null), active = useRef<Source | null>(null);
  const [number, setPage] = useState(1), [image, setImage] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [previewError, setPreviewError] = useState(""), [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; dispose(active.current); }, []);

  async function open(file: File, discardPrevious: () => boolean) {
    const token = ++generation.current;
    setBusy(true); setError("");
    try {
      const state = await readJson<{ session_key: string }>(await fetch(api + "/state"), "Lokale PDF-Sitzung nicht erreichbar.");
      if (token !== generation.current) return;
      const body = new FormData(); body.append("file", file);
      // Always read the returned ID, even after leaving, so the temporary copy is released.
      const raw = await readJson<DocumentInfo>(await fetch(api + "/crop-documents", {
        method: "POST", headers: { "X-Edeco-Pdf": state.session_key }, body,
      }), "Der PDF-Plan konnte nicht geöffnet werden.");
      const source = { ...raw, key: state.session_key };
      if (token !== generation.current || (active.current && !discardPrevious())) { dispose(source); return; }
      dispose(active.current); active.current = source;
      setImage(null); setPage(1); setDoc(source);
    } catch (caught) {
      if (token === generation.current) setError(caught instanceof Error ? caught.message : "PDF-Import fehlgeschlagen.");
    } finally { if (token === generation.current) setBusy(false); }
  }
  function clear() {
    generation.current++; dispose(active.current); active.current = null;
    setDoc(null); setImage(null); setError(""); setPreviewError(""); setBusy(false); setPage(1);
  }
  useEffect(() => {
    if (!doc) return;
    const controller = new AbortController();
    let url = "";
    setPreviewError("");
    void (async () => {
      try {
        const response = await fetch(`${api}/crop-documents/${encodeURIComponent(doc.id)}/pages/${number}?width=1800`, {
          headers: { "X-Edeco-Pdf": doc.key }, signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseError(response, "Die Planseite konnte nicht gerendert werden."));
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        const img = new Image(); img.src = url;
        await img.decode();
        if (!controller.signal.aborted) setImage(img);
      } catch (caught) {
        if (!controller.signal.aborted) setPreviewError(caught instanceof Error ? caught.message : "Seitenvorschau fehlgeschlagen.");
      }
    })();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [doc, number, retry]);
  return { doc, number, page: doc?.pages[number - 1], image, busy, error, previewError, open, clear,
    changePage(value: number) { if (value !== number) { setImage(null); setPreviewError(""); setPage(value); } },
    retry() { setRetry(n => n + 1); } };
}
