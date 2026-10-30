export default function ToolIcon({ id }: { id: string }) {
  const paths: Record<string, React.ReactNode> = {
    "nova-legenden": <><rect x="10" y="7" width="28" height="34" rx="3" /><path d="M17 17h14M23 25h8M23 33h8" /><circle cx="17" cy="25" r="1" /><circle cx="17" cy="33" r="1" /></>,
    bim2steiger: <><path d="m24 5 17 10v18L24 43 7 33V15Z M7 15l17 10 17-10M24 25v18M16 10l17 10v9" /></>,
    berechnungen: <><rect x="10" y="5" width="28" height="38" rx="4" /><path d="M17 13h14M17 23h3m8 0h3M17 30h3m8 0h3M17 37h3m8 0h3" /></>,
    blitzschutz: <><path d="M27 4 10 27h13l-2 17 17-24H25Z" /></>,
    "dateien-umbenennen": <><path d="M29 6H12a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h24a3 3 0 0 0 3-3V16ZM29 6v10h10M16 25h10M16 32h7" /><path d="m29 28 7 7m0-7-7 7" /></>,
  };
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id] ?? paths["nova-legenden"]}</svg>;
}
