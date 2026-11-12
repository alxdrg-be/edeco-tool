import { useEffect, type RefObject } from "react";

/** In the enlarged editor: lock page scroll, make the page behind inert and keep Tab inside the editor. */
export function useWindowedFocus(editorRef: RefObject<HTMLDivElement | null>, windowed: boolean) {
  useEffect(() => {
    const editor = editorRef.current;
    if (!windowed || !editor) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep the project/header behind the enlarged editor out of keyboard navigation.
    const changed: { node: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = editor;
    while (branch.parentElement) {
      for (const child of branch.parentElement.children) {
        if (child === branch || !(child instanceof HTMLElement) || child.classList.contains("legend-window-back")) continue;
        changed.push({ node: child, inert: child.inert }); child.inert = true;
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const controls = () => [...editor.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']")].filter(node => node.getClientRects().length > 0);
    (controls()[0] ?? editor).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = controls(), first = nodes[0] ?? editor, last = nodes[nodes.length - 1] ?? editor;
      if (!editor.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = oldOverflow;
      changed.forEach(({ node, inert }) => { node.inert = inert; });
      document.removeEventListener("keydown", trap);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [windowed]);
}
