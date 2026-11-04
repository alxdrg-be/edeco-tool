import { useEffect, useRef, useState } from "react";

/** The existing bounded crop session supplies a sharp preview for the large
 * canvas. Thumbnail lists remain small; no second PDF renderer is introduced.
 */
export default function NativePdfPreview({ file, page, thumbnail, sessionKey, zoom, width, height, onZoom }: {
  file: File; page: number; thumbnail: string; sessionKey: string; zoom: number;
  width: number; height: number; onZoom: (value: number) => void;
}) {
  const [documentId, setDocumentId] = useState("");
  const [image, setImage] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => setSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); onZoom(Math.max(.5, Math.min(4, zoom * Math.exp(-event.deltaY / 500)))); } };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [zoom, onZoom]);
  useEffect(() => {
    const controller = new AbortController();
    let id = "";
    const headers = { "X-Edeco-Pdf": sessionKey };
    const remove = (value: string) => { void fetch(`/api/tools/pdf-werkstatt/crop-documents/${encodeURIComponent(value)}`, { method: "DELETE", headers }).catch(() => {}); };
    setDocumentId(""); setImage("");
    void (async () => {
      try {
        const body = new FormData(); body.append("file", file);
        const response = await fetch("/api/tools/pdf-werkstatt/crop-documents", { method: "POST", headers, body, signal: controller.signal });
        if (!response.ok) return;
        const value = await response.json(); id = value.id;
        if (controller.signal.aborted) remove(id); else setDocumentId(id);
      } catch { /* The inspected thumbnail remains available if a high-resolution session is full. */ }
    })();
    return () => { controller.abort(); if (id) remove(id); };
  }, [file, sessionKey]);
  useEffect(() => {
    const controller = new AbortController();
    let url = "";
    setImage("");
    if (documentId) void (async () => {
      try {
        const response = await fetch(`/api/tools/pdf-werkstatt/crop-documents/${encodeURIComponent(documentId)}/pages/${page}?width=1800`, { headers: { "X-Edeco-Pdf": sessionKey }, signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setImage(url); }
      } catch { /* Switching pages aborts the preceding preview. */ }
    })();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [documentId, page, sessionKey]);
  const fit = Math.min(size.width / width, size.height / height);
  return <div ref={viewport} className="pdf-native-preview" tabIndex={0} aria-label="PDF-Vorschau mit Dokumentzoom" data-document-zoom={zoom} onKeyDown={event => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (["0", "+", "=", "-"].includes(event.key)) {
      event.preventDefault(); onZoom(event.key === "0" ? 1 : Math.max(.5, Math.min(4, zoom * (event.key === "-" ? 1 / 1.2 : 1.2))));
    }
  }}><img src={image || thumbnail} alt={`Vorschau Seite ${page}`} style={{ width: fit > 0 ? width * fit * zoom : "100%", maxWidth: "none" }} /></div>;
}
