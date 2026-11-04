import DiagnosticDetails, { revealDiagnosticElement, type Diagnostic, type DiagnosticTarget } from "./DiagnosticDetails";

export default function LegacyGuidance({ diagnostics, controls }: { diagnostics: Diagnostic[]; controls: string }) {
  function navigate(target: DiagnosticTarget) {
    const root = document.querySelector<HTMLElement>(controls);
    const element = root?.querySelector<HTMLElement>(`[data-diagnostic-field-key="${CSS.escape(target.field)}"]`) ?? root?.querySelector<HTMLElement>(`[data-field-key="${CSS.escape(target.field)}"]`);
    if (!element) return;
    root?.querySelectorAll(".calc-diagnostic-focus").forEach(node => node.classList.remove("calc-diagnostic-focus"));
    revealDiagnosticElement(element);
  }
  return <div className="legacy-calculation-guidance" aria-label="Ergebnis und Eingaben verstehen">{diagnostics.map(diagnostic => <DiagnosticDetails key={diagnostic.id} diagnostic={diagnostic} onNavigate={navigate} />)}</div>;
}
