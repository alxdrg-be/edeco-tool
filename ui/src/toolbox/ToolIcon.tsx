import CalculatorIcon, { CALCULATOR_ICONS } from "../tools/berechnungen/CalculatorIcon";
import { BookOpen, Sigma } from "lucide-react";
export default function ToolIcon({ id }: { id: string }) {
  if (id === "elektro-memory") return <BookOpen size={48} strokeWidth={1.6} aria-hidden="true" />;
  if (id === "formelrechner") return <Sigma size={48} strokeWidth={1.6} aria-hidden="true" />;
  if (CALCULATOR_ICONS[id]) return <CalculatorIcon id={id} size={48} />;
  const paths: Record<string, React.ReactNode> = {
    berechnungen: <><rect x="10" y="4" width="28" height="40" rx="4"/><path d="M16 11h16v8H16ZM16 27h4m-2-2v4m9-2h5m-16 9h4m7-2 5 5m0-5-5 5"/></>,
    blitzschutz: <><path d="M28 3 10 27h13l-3 18 19-27H26Z"/></>,
    planlieferung: <><path d="M8 7h22v27H8ZM15 15h9M15 22h9M17 41h23V16M28 34h17m-6-6 6 6-6 6"/></>,
    "nova-legenden": <><rect x="10" y="7" width="28" height="34" rx="3" /><path d="M17 17h14M23 25h8M23 33h8" /><circle cx="17" cy="25" r="1" /><circle cx="17" cy="33" r="1" /></>,
    bim2steiger: <><path d="m24 5 17 10v18L24 43 7 33V15Z M7 15l17 10 17-10M24 25v18M16 10l17 10v9" /></>,
    "dokumenten-assistent": <><path d="M27 6H12a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h13M27 6v12h12M27 6l12 12M16 25h10M16 32h6" /><circle cx="33" cy="32" r="8" /><path d="m39 38 6 6M30 32h6M33 29v6" /></>,
    "dateien-umbenennen": <><path d="M29 6H12a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h24a3 3 0 0 0 3-3V16ZM29 6v10h10M16 25h10M16 32h7" /><path d="m29 28 7 7m0-7-7 7" /></>,
    "pdf-werkzeuge": <><path d="M29 5H14a3 3 0 0 0-3 3v29a3 3 0 0 0 3 3h23a3 3 0 0 0 3-3V16ZM29 5v11h11M18 24h15M18 31h10M6 13v28a3 3 0 0 0 3 3h22" /></>,
    projektzentrale: <><path d="M5 17v-6a3 3 0 0 1 3-3h11l5 6h16a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" /><path d="M5 20h38M24 26v9M19.5 30.5h9" /></>,
    aenderungsbericht: <><path d="M27 5H13a3 3 0 0 0-3 3v32a3 3 0 0 0 3 3h23a3 3 0 0 0 3-3V17ZM27 5v12h12M17 24h13m-4-4 4 4-4 4M32 35H19m4-4-4 4 4 4" /></>,
    leistungsbilanz: <><path d="M7 7v34h35M15 33V23h6v10M27 33V15h6v18M14 15l9-6 10-3" /></>,
    kabelberechnung: <><path d="M11 6v7a8 8 0 0 0 8 8h10a8 8 0 0 1 8 8v3a9 9 0 0 1-18 0v-1M7 6h8M33 30h8M16 33h6" /><path d="M19 24v-3M25 24v-3M25 18v3M31 18v3" /></>,
    anlagetool: <><rect x="16" y="5" width="16" height="11" rx="2" /><path d="M24 16v9M9 30v-5h30v5M24 25v5" /><rect x="4" y="30" width="10" height="12" rx="2" /><rect x="19" y="30" width="10" height="12" rx="2" /><rect x="34" y="30" width="10" height="12" rx="2" /></>,
  };
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id] ?? paths["nova-legenden"]}</svg>;
}
