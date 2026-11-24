export interface RecentTool { id: string; usedAt: number }
const KEY = 'edeco.toolhub.recent-tools.v1';
export const RECENT_EVENT = 'edeco-recent-tools-changed';

export function parseRecentTools(raw: string | null): RecentTool[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return [];
    const seen = new Set<string>();
    return values.filter((value): value is RecentTool => {
      if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(value.id) ||
          typeof value.usedAt !== 'number' || !Number.isFinite(value.usedAt) || value.usedAt < 0 || seen.has(value.id)) return false;
      seen.add(value.id); return true;
    }).sort((a, b) => b.usedAt - a.usedAt).slice(0, 8).map(({ id, usedAt }) => ({ id, usedAt }));
  } catch { return []; }
}
export function readRecentTools(): RecentTool[] {
  try { return parseRecentTools(localStorage.getItem(KEY)); } catch { return []; }
}
export function recordToolVisit(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([{ id, usedAt: Date.now() }, ...readRecentTools().filter(item => item.id !== id)].slice(0, 8)));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch { /* Navigation also works without browser storage. */ }
}
