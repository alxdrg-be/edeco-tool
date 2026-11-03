/** Keep the application chrome at 100%; individual document viewers own zoom. */
export function isBrowserZoomKey(event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "key" | "code">): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  return ["+", "-", "=", "0"].includes(event.key) || ["NumpadAdd", "NumpadSubtract", "Numpad0"].includes(event.code);
}

export function installAppZoomGuard(host: Window = window): () => void {
  const attached = new Map<Window, { document: Document; dispose: () => void }>();
  let stopped = false, pending = false;
  function synchronize() {
    pending = false;
    if (stopped) return;
    const reachable = new Set<Window>();
    function visit(target: Window) {
      if (reachable.has(target)) return;
      reachable.add(target);
      let doc: Document;
      try { doc = target.document; } catch { attached.get(target)?.dispose(); attached.delete(target); return; }
      const previous = attached.get(target);
      if (previous?.document !== doc) {
        previous?.dispose();
        // Window bubble follows canvas/document handlers, so local document zoom
        // is applied before the browser's default page zoom is cancelled.
        const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) event.preventDefault(); };
        const key = (event: KeyboardEvent) => { if (isBrowserZoomKey(event)) event.preventDefault(); };
        const gesture = (event: Event) => event.preventDefault();
        const load = (event: Event) => { if ((event.target as Element | null)?.tagName === "IFRAME") schedule(); };
        target.addEventListener("wheel", wheel, { passive: false });
        target.addEventListener("keydown", key);
        target.addEventListener("gesturestart", gesture, { passive: false });
        target.addEventListener("gesturechange", gesture, { passive: false });
        doc.addEventListener("load", load, true);
        const observer = new MutationObserver(records => {
          if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && ((node as Element).tagName === "IFRAME" || (node as Element).querySelector("iframe"))))) schedule();
        });
        if (doc.documentElement) observer.observe(doc.documentElement, { childList: true, subtree: true });
        attached.set(target, { document: doc, dispose: () => {
          target.removeEventListener("wheel", wheel);
          target.removeEventListener("keydown", key);
          target.removeEventListener("gesturestart", gesture);
          target.removeEventListener("gesturechange", gesture);
          doc.removeEventListener("load", load, true);
          observer.disconnect();
        } });
      }
      doc.querySelectorAll("iframe").forEach(frame => { if (frame.contentWindow) visit(frame.contentWindow); });
    }
    visit(host);
    for (const [target, record] of attached) if (!reachable.has(target)) { record.dispose(); attached.delete(target); }
  }
  function schedule() {
    if (pending || stopped) return;
    pending = true; queueMicrotask(synchronize);
  }
  synchronize();
  return () => { stopped = true; attached.forEach(record => record.dispose()); attached.clear(); };
}
