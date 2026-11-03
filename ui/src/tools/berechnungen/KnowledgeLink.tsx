import type { MouseEvent, ReactNode } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { topicForCalculatorId } from "./knowledgeData";
import "./knowledge-link.css";

export function openKnowledge(onOpenTool?: (id: string) => void, calculatorId?: string) {
  const topic = topicForCalculatorId(calculatorId);
  let previous = calculatorId;
  try {
    previous ??= sessionStorage.getItem("edeco-toolbox-active") ?? undefined;
    if (previous && previous !== "wissens-hub") sessionStorage.setItem("edeco-knowledge-return", previous);
  } catch { /* The hub still works without browser storage. */ }
  // Give the current calculator a history entry before pushing the article.
  // This also makes browser Back work when the calculator was opened from an
  // older session without a hash, rather than through a direct deep link.
  if (!window.location.hash) {
    const origin = previous && previous !== "wissens-hub" ? `rechner/${previous}` : "toolbox";
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${origin}`);
  }
  window.location.hash = `wissen${topic ? `/${topic}` : ""}`;
  onOpenTool?.("wissens-hub");
}

export function KnowledgeLink({ calculatorId, onOpenTool, children }: {
  calculatorId?: string; onOpenTool?: (id: string) => void; children?: ReactNode;
}) {
  const topic = topicForCalculatorId(calculatorId);
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openKnowledge(onOpenTool, calculatorId);
  }
  return <a className="lab-knowledge-link" aria-label={children ? undefined : "Wissens-Hub"} title={children ? undefined : "Wissens-Hub"} href={`#wissen${topic ? `/${topic}` : ""}`} onClick={open}>
    <BookOpen size={16} aria-hidden="true" /><span>{children ?? "Wissens-Hub"}</span><ArrowUpRight size={14} aria-hidden="true" />
  </a>;
}
