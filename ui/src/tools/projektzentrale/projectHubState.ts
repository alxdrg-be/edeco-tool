import { useCallback, useEffect, useRef, useState } from "react";

export interface Contact { name: string; role: string; company: string; email: string; phone: string }
export interface DocumentRef { id: string; title: string; path: string; added_at: string }
export interface ProjectData {
  number: string; name: string; address: string; folder: string; notes: string;
  archived: boolean; contacts: Contact[]; documents: DocumentRef[];
}
export interface Project extends ProjectData { id: string; version: number; created_at: string; updated_at: string }
export interface DeliveryPlan { filename: string; original: string; floor: string; plan_type: string; index: string; scale: string; sha256: string; size: number }
export interface DeliveryRecord { id: string; project_id: string; project_number: string; project_name: string; recipient: string; delivery_date: string; title: string; notes: string; plans: DeliveryPlan[]; created_at: string; sent_at: string | null }
export interface HubState { projects: Project[]; active_id: string | null; session_key: string; deliveries: DeliveryRecord[] }
export const EMPTY_PROJECT: ProjectData = { number: "", name: "", address: "", folder: "", notes: "", archived: false, contacts: [], documents: [] };
const API = "/api/tools/projektzentrale";
const EVENT = "edeco-projects-changed";
export function notifyProjectsChanged() { window.dispatchEvent(new Event(EVENT)); }

async function read<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === "string" ? detail : "Bitte Pflichtfelder, vollständige Pfade und Eingabelängen prüfen.");
  }
  return data as T;
}
export async function projectAction<T>(path: string, session: string, body: object = {}, method = "POST"): Promise<T> {
  const result = await read<T>(await fetch(API + path, { method, headers: { "Content-Type": "application/json", "X-Edeco-Projects": session }, body: JSON.stringify(body) }));
  notifyProjectsChanged();
  return result;
}
export function useProjectHub() {
  const [hub, setHub] = useState<HubState | null>(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await read<HubState>(await fetch(API + "/state"));
      if (mounted.current && current === sequence.current) { setHub(next); setError(""); }
      return next;
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const message = /json|failed to fetch|networkerror|load failed/i.test(raw) ? "Projektliste nicht erreichbar." : raw || "Projekte konnten nicht geladen werden.";
      if (mounted.current && current === sequence.current) setError(message);
      throw e;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const reload = () => { void refresh().catch(() => undefined); };
    reload(); window.addEventListener(EVENT, reload); window.addEventListener("focus", reload);
    return () => { mounted.current = false; ++sequence.current; window.removeEventListener(EVENT, reload); window.removeEventListener("focus", reload); };
  }, [refresh]);
  return { hub, error, refresh, active: hub?.projects.find(project => project.id === hub.active_id) ?? null };
}
export function dataOf(project: Project): ProjectData {
  return { number: project.number, name: project.name, address: project.address, folder: project.folder,
    notes: project.notes, archived: project.archived, contacts: project.contacts, documents: project.documents };
}
