import { TOOLS } from './catalog.ts';

export interface ToolAppearance { header: string; accent: string; lightAccent: string; tint: string }
const palette: Record<string, ToolAppearance> = {
  home: { header: '#017c92', accent: '#017c92', lightAccent: '#7cd3dd', tint: '#e8f5f7' },
  petrol: { header: '#0e7480', accent: '#0e7480', lightAccent: '#7cd3dd', tint: '#e3f3f5' },
  steel: { header: '#4a5b68', accent: '#4a5b68', lightAccent: '#b5ccdc', tint: '#edf1f4' },
  orange: { header: '#b4520f', accent: '#a84b0b', lightAccent: '#efb27c', tint: '#fcf0e7' },
  network: { header: '#0f6a9e', accent: '#0f6a9e', lightAccent: '#8ccaf1', tint: '#e7f2fa' },
  rose: { header: '#b0285a', accent: '#b0285a', lightAccent: '#f0acc5', tint: '#fbeaf1' },
  olive: { header: '#626f15', accent: '#626f15', lightAccent: '#ccd68d', tint: '#f0f3e2' },
  green: { header: '#2e7d45', accent: '#2b733f', lightAccent: '#91d4a5', tint: '#e9f5ed' },
  gold: { header: '#8a6508', accent: '#805d05', lightAccent: '#e2c574', tint: '#f8f2df' },
  indigo: { header: '#4c4fb5', accent: '#4c4fb5', lightAccent: '#bcbdf7', tint: '#ededfb' },
  blue: { header: '#3446a8', accent: '#3446a8', lightAccent: '#abb9ff', tint: '#edf0fc' },
  violet: { header: '#6b3fa8', accent: '#6b3fa8', lightAccent: '#d2b2fa', tint: '#f2ebfb' },
  coral: { header: '#a83d29', accent: '#a83d29', lightAccent: '#f2af9f', tint: '#fceeea' },
};

/** UI chrome only. CAD layers, device colours and check statuses keep their own colours. */
export function toolAppearance(id: string | null): ToolAppearance {
  if (!id) return palette.home;
  if (id === 'verteiler-dispo') return palette.olive;
  if (id === 'netzplaner') return palette.network;
  if (id === 'formelrechner' || id === 'elektro-memory') return palette.indigo;
  const tool = TOOLS.find(item => item.id === id);
  if (tool?.category === 'Berechnungen' && id !== 'wissens-hub') return palette.orange;
  return palette[tool?.color ?? 'home'] ?? palette.home;
}
