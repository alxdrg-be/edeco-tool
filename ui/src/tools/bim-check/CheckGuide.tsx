import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export interface GuideAction { label: string; run: () => void; primary?: boolean }
interface Step { title: string; text: string; done: boolean; actions: GuideAction[] }

const STORAGE_KEY = "bim-check-guide-hidden";

function readHidden() {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

/** Four short steps from the IFC to the report. The current step shows its text and buttons. */
export default function CheckGuide({ steps }: { steps: Step[] }) {
  const [hidden, setHidden] = useState(readHidden);
  const current = steps.findIndex(step => !step.done);
  const active = current === -1 ? steps.length - 1 : current;
  function toggle() {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* private mode */ }
  }
  return <section className="bc-guide" aria-label="IFC-Prüfung in vier Schritten">
    <div className="bc-guide-head">
      <ol className="bc-guide-steps">
        {steps.map((step, index) => <li key={step.title} data-state={step.done ? "done" : index === active ? "active" : "open"}
          aria-current={index === active ? "step" : undefined}>
          <span className="bc-guide-dot">{step.done ? <Check size={13} strokeWidth={3} /> : index + 1}</span>{step.title}
        </li>)}
      </ol>
      <button type="button" className="bc-guide-toggle" aria-expanded={!hidden} onClick={toggle}>
        {hidden ? <>Anleitung <ChevronDown size={14} /></> : <>Ausblenden <ChevronUp size={14} /></>}
      </button>
    </div>
    {!hidden && <div className="bc-guide-body">
      <p><b>{active + 1}. {steps[active].title}.</b> {steps[active].text}</p>
      {steps[active].actions.length > 0 && <div className="bc-guide-actions">
        {steps[active].actions.map(action => <button key={action.label} type="button" className={action.primary ? "btn bc-primary" : "btn"} onClick={action.run}>{action.label}</button>)}
      </div>}
    </div>}
  </section>;
}
