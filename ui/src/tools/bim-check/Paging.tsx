import { ChevronLeft, ChevronRight } from "lucide-react";
import { count } from "./model";

export const PAGE_SIZE = 50;
export function pageStart(page: number, total: number, size = PAGE_SIZE) {
  return Math.max(0, Math.min(page, Math.ceil(total / size) - 1)) * size;
}
export default function Paging({ page, total, onChange, size = PAGE_SIZE }: {
  page: number; total: number; size?: number; onChange: (page: number) => void;
}) {
  if (total <= size) return null;
  const start = pageStart(page, total, size);
  return <div className="bc-paging">
    <button type="button" aria-label="Vorherige Seite" disabled={start === 0} onClick={() => onChange(start / size - 1)}><ChevronLeft size={16} /></button>
    <span>{count(start + 1)}–{count(Math.min(start + size, total))} von {count(total)}</span>
    <button type="button" aria-label="Nächste Seite" disabled={start + size >= total} onClick={() => onChange(start / size + 1)}><ChevronRight size={16} /></button>
  </div>;
}
