/** A text like "A; B; C" is a list in the source layout. Short parts only, never prose. */
export function memoryListItems(text: string): string[] | null {
  const parts = text.trim().replace(/\.$/, "").split(/;\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 3 || parts.some(part => part.length > 180 || /[.!?]\s/.test(part))) return null;
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1));
}

/** "Fünf Sicherheitsregeln", "5+5 …", "10 Prüffelder" are counted steps. */
export function isNumberedTitle(title: string): boolean {
  return /^(?:\d+|fünf|zehn|drei|vier|sechs|sieben|acht|neun)\b/i.test(title.trim());
}
