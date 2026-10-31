export const ROOT = "/api/tools/dokumenten-assistent";
export interface DocumentInfo {
  id: string; title: string; filename: string; edition: string; kind: string;
  pages: number; empty_pages: number;
}
export interface AISettings {
  provider: "ollama" | "openai";
  endpoint: string; model: string; configured: boolean; has_key: boolean; key_persistent: boolean;
}
export interface LibraryState { documents: DocumentInfo[]; settings: AISettings; session_key: string }
export interface Source {
  id: string; document_id: string; title: string; filename: string; edition: string; kind: string;
  page: number; label: string; start_line: number; end_line: number; text: string;
}
export interface Answer {
  question: string; sources: Source[]; blocks: { text: string; source_ids: string[] }[];
  mode: "search" | "ai"; message: string;
}
export interface DocumentPage {
  document: DocumentInfo; number: number; label: string; image: string | null;
  lines: { number: number; text: string; box: number[] | null }[];
}

export async function request<T>(path: string, key = "", init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (key) headers.set("X-Edeco-Documents", key);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  const response = await fetch(ROOT + path, { ...init, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Die Aktion konnte nicht abgeschlossen werden.");
  return data as T;
}

export function sourceLabel(source: Source) {
  if (source.kind !== "pdf") return `${source.title} · ${source.edition || "Stand nicht angegeben"} · Dateizeilen ${source.start_line}–${source.end_line}`;
  return `${source.title} · ${source.edition || "Stand nicht angegeben"} · Seite ${source.page}${source.label && source.label !== String(source.page) ? ` (Blatt ${source.label})` : ""} · Textzeilen ${source.start_line}–${source.end_line}`;
}
