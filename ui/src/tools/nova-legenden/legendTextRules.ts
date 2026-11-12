/** Presentation rules are saved alongside a legend; item source descriptions stay intact. */
export interface LegendAbbreviation {
  id: string;
  long: string;
  short: string;
  scope: string;
  active: boolean;
}

export interface LegendTextRules {
  mode: "wrap" | "warn" | "abbreviate";
  rules: LegendAbbreviation[];
}

export interface LegendTextWarning {
  id: string;
  kind: "text-width";
  block: string;
  item: string;
  text: string;
  display_text: string;
  suggestion: string;
  width_mm: number;
  available_mm: number;
}

export const DEFAULT_LEGEND_TEXT_RULES: LegendTextRules = { mode: "wrap", rules: [] };

const TECHNICAL = /(?:\d|[_/\\]|\b(?:[µμ]?[AVWΩ]|kW|kVA|VA|Hz|kHz|MHz|mm|cm|km|m|mm²|cm²|m²|mm2|cm2|m2|IP|IK|PE|PEN|N|L1|L2|L3)\b)/iu;

export function legendAbbreviationProblem(rule: Pick<LegendAbbreviation, "long" | "short">): string {
  const long = rule.long.trim(), short = rule.short.trim();
  if (!long || !short) return "Langform und Kurzform ausfüllen.";
  if (!/\p{L}/u.test(long) || TECHNICAL.test(long) || TECHNICAL.test(short)) return "Typcodes, Einheiten und Nummern bleiben geschützt; nur Wörter abkürzen.";
  if (short.length >= long.length) return "Die Kurzform muss kürzer als die Langform sein.";
  return "";
}

/** Quoted semicolon/comma CSV, with a fixed, explicit header and bounded rows. */
export function parseLegendAbbreviationsCsv(text: string): Omit<LegendAbbreviation, "id">[] {
  if (text.length > 150_000) throw new Error("Die CSV-Datei ist zu gross (höchstens 150 kB Text)." );
  const source = text.replace(/^\uFEFF/u, "");
  const first = source.split(/\r?\n/u, 1)[0] ?? "";
  const delimiter = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if (ch === "\n" && !quoted) { row.push(cell.replace(/\r$/u, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (quoted) throw new Error("Ein Anführungszeichen in der CSV-Datei ist nicht geschlossen.");
  if (cell || row.length) { row.push(cell.replace(/\r$/u, "")); rows.push(row); }
  const nonempty = rows.filter(cells => cells.some(value => value.trim()));
  const header = nonempty.shift()?.map(value => value.trim().toLocaleLowerCase("de-CH"));
  if (header?.join("|") !== "langform|kurzform|geltungsbereich|aktiv") throw new Error("CSV-Kopf: Langform;Kurzform;Geltungsbereich;Aktiv");
  if (nonempty.length > 100) throw new Error("Höchstens 100 Abkürzungsregeln importieren.");
  return nonempty.map((cells, index) => {
    if (cells.length !== 4) throw new Error(`CSV-Zeile ${index + 2}: vier Spalten erforderlich.`);
    const [long, short, scope, enabled] = cells.map(value => value.trim());
    const active = enabled.toLocaleLowerCase("de-CH");
    if (!["ja", "nein", "true", "false", "1", "0", "x", ""].includes(active)) throw new Error(`CSV-Zeile ${index + 2}: Aktiv muss ja/nein sein.`);
    const result = { long: long.slice(0, 120), short: short.slice(0, 80), scope: scope || "all", active: ["ja", "true", "1", "x"].includes(active) };
    const problem = legendAbbreviationProblem(result);
    if (problem) throw new Error(`CSV-Zeile ${index + 2}: ${problem}`);
    return result;
  });
}

export function legendAbbreviationsCsv(rules: LegendAbbreviation[]): string {
  const escape = (text: string) => `"${text.replaceAll('"', '""')}"`;
  return "\uFEFFLangform;Kurzform;Geltungsbereich;Aktiv\r\n" + rules.map(rule => [rule.long, rule.short, rule.scope, rule.active ? "ja" : "nein"].map(escape).join(";")).join("\r\n");
}
