/** A deliberate file handoff within this running Toolhub. No file data is persisted. */
export const HANDOFF_TARGETS = ["pdf-werkzeuge", "dateien-umbenennen"] as const;
export type HandoffTarget = typeof HANDOFF_TARGETS[number];
export interface ToolHandoff {
  id: string;
  target: HandoffTarget;
  source: string;
  files: readonly File[];
  projectId?: string;
  projectLabel?: string;
  createdAt: number;
}
export type HandoffInput = Omit<ToolHandoff, "id" | "createdAt">;
export const HANDOFF_EVENT = "edeco-tool-file-handoff";
const LIFETIME = 20 * 60 * 1000;

export class ToolHandoffStore {
  private pending = new Map<HandoffTarget, ToolHandoff>();
  private now: () => number;
  constructor(now = () => Date.now()) { this.now = now; }
  peek(target: HandoffTarget): ToolHandoff | null {
    const item = this.pending.get(target);
    if (item && this.now() - item.createdAt >= LIFETIME) { this.pending.delete(target); return null; }
    return item ?? null;
  }
  stage(input: HandoffInput): ToolHandoff {
    if (!HANDOFF_TARGETS.includes(input.target)) throw new Error("Dieses Werkzeug kann keine PDF-Übergabe empfangen.");
    if (!input.source.trim() || !input.files.length) throw new Error("Für die Übergabe fehlt eine PDF-Datei.");
    const limit = input.target === "dateien-umbenennen" ? 30 : 100;
    if (input.files.length > 100 || input.files.some(file => !file.size || file.size > limit * 1024 * 1024 || !/\.pdf$/i.test(file.name))) {
      throw new Error(`Bitte höchstens 100 PDFs mit maximal ${limit} MB je Datei übergeben.`);
    }
    if (input.files.reduce((sum, file) => sum + file.size, 0) > 150 * 1024 * 1024) throw new Error("Die Übergabe darf insgesamt höchstens 150 MB enthalten.");
    const pending = this.peek(input.target);
    if (pending) {
      // A cancelled navigation may be retried with the same exported snapshot.
      if (pending.source === input.source.trim() && pending.projectId === input.projectId && pending.files.length === input.files.length && pending.files.every((file, index) => file === input.files[index])) return pending;
      throw new Error("Für dieses Werkzeug liegt bereits eine Übergabe bereit. Bitte diese zuerst übernehmen oder verwerfen.");
    }
    const item = Object.freeze({ ...input, source: input.source.trim(), files: Object.freeze([...input.files]),
      id: crypto.randomUUID(), createdAt: this.now() });
    this.pending.set(input.target, item);
    return item;
  }
  take(target: HandoffTarget, id: string): ToolHandoff | null {
    const item = this.peek(target);
    if (!item || item.id !== id) return null;
    this.pending.delete(target);
    return item;
  }
}

const store = new ToolHandoffStore();
function changed() { if (typeof window !== "undefined") window.dispatchEvent(new Event(HANDOFF_EVENT)); }
export function stageToolHandoff(input: HandoffInput): ToolHandoff { const item = store.stage(input); changed(); return item; }
export function pendingToolHandoff(target: HandoffTarget): ToolHandoff | null { return store.peek(target); }
export function consumeToolHandoff(target: HandoffTarget, id: string): ToolHandoff | null { const item = store.take(target, id); if (item) changed(); return item; }
