import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Small drop-down menu for rarer actions. Closes after a choice, on Escape and on a click outside. */
export default function Menu({ label, disabled, children }: { label: string; disabled?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number | "auto"; bottom: number | "auto"; right: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) {
        if (ref.current) {
          ref.current.open = false;
          if (e instanceof KeyboardEvent) {
            e.preventDefault();
            e.stopPropagation();
            ref.current.querySelector("summary")?.focus({ preventScroll: true });
          }
        }
      }
    };
    // Fixed position, so a scrolling table does not cut the menu off. Scrolling closes it.
    const rect = ref.current?.querySelector("summary")?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const height = popRef.current?.scrollHeight ?? 220;
      const width = popRef.current?.getBoundingClientRect().width ?? 250;
      const up = below < Math.min(height, above) && above > below;
      setPos({
        top: up ? "auto" : rect.bottom + 4,
        bottom: up ? window.innerHeight - rect.top + 4 : "auto",
        right: Math.max(8, Math.min(window.innerWidth - rect.right, window.innerWidth - width - 8)),
        maxHeight: Math.max(80, up ? above : below),
      });
    }
    const shut = (event: Event) => {
      if (event.type === "scroll" && event.target instanceof Node && popRef.current?.contains(event.target)) return;
      if (ref.current) ref.current.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (open && pos) popRef.current?.querySelector<HTMLElement>("button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled)")?.focus({ preventScroll: true });
  }, [open, pos]);

  return (
    <details ref={ref} className="menu" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary
        className="btn small"
        aria-disabled={disabled}
        onClick={(e) => disabled && e.preventDefault()}
        style={disabled ? { opacity: 0.5, cursor: "default" } : undefined}
      >
        {label} ▾
      </summary>
      {open && createPortal(
        <div
          ref={popRef}
          className="menu-pop"
          role="group"
          aria-label={label}
          style={pos ? { position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right, maxHeight: pos.maxHeight, overflowY: "auto" } : { position: "fixed", visibility: "hidden" }}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const controls = Array.from(popRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled)") ?? []);
            if (e.target !== (e.shiftKey ? controls[0] : controls[controls.length - 1])) return;
            e.preventDefault();
            if (ref.current) {
              ref.current.open = false;
              ref.current.querySelector("summary")?.focus({ preventScroll: true });
            }
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button, a") && ref.current) {
              ref.current.open = false;
              ref.current.querySelector("summary")?.focus({ preventScroll: true });
            }
          }}
        >
          {children}
        </div>, document.body
      )}
    </details>
  );
}
