export const ARCHIVE_API = "/api/tools/berechnungsablage";
export interface ArchiveProject { id: string; number: string; name: string }
export interface ArchiveSettings { root: string; subfolder: string; revision: string; managed: boolean; configured: boolean; author: string }
export interface ArchiveState { settings: ArchiveSettings; session_key: string; tools: Record<string, string> }
export interface ArchiveMeta { key: string; tool_id: string; tool_name: string; project: ArchiveProject; title: string; author: string; source: "edeco" | "premium-export"; created_at: string; attachment: string | null; notes_preview: string }
export interface ArchiveRecord extends ArchiveMeta { document: Record<string, unknown>; notes: string; review: string; path: string; comments: { text: string; author: string; created_at: string }[] }
export interface ArchivePayload { toolId: string; document: Record<string, unknown>; project: ArchiveProject | null; notes?: string }
export async function archiveRequest<T>(path: string, state?: ArchiveState | null, method = "GET", body?: object | FormData): Promise<T> {
  const headers: Record<string, string> = state ? { "X-Edeco-Projects": state.session_key } : {};
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(ARCHIVE_API + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Bitte Projekt, Bezeichnung und Eingaben prüfen.");
  return data as T;
}
const RESTORE = "edeco.archive.restore.v1";
export function prepareRestore(record: ArchiveRecord) { sessionStorage.setItem(RESTORE, JSON.stringify(record)); }
export function consumeRestore(toolId: string): ArchiveRecord | null {
  try {
    const raw = sessionStorage.getItem(RESTORE);
    if (!raw) return null;
    const value = JSON.parse(raw) as ArchiveRecord;
    if (value.tool_id !== toolId) return null;
    sessionStorage.removeItem(RESTORE);
    return value.source === "edeco" && value.document && value.project ? value : null;
  } catch { return null; }
}
export const archiveDate = (value: string) => new Date(value).toLocaleString("de-CH", { timeZone: "Europe/Zurich" });
