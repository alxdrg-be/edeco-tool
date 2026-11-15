export type CsvValue = string | number | null;
export type CsvQuoting = "always" | "minimal";

interface CsvOptions {
  quote?: CsvQuoting;
  bom?: boolean;
  trailingNewline?: boolean;
}

/** Lossless CSV syntax only. Use csvCell for text displayed in Excel. */
export function quoteCsvCell(value: CsvValue, quote: CsvQuoting = "always"): string {
  const text = value === null ? "" : String(value);
  return quote === "always" || /[;"\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Excel text cells must not become formulas, including after whitespace or a BOM. */
export function csvCell(value: CsvValue, quote: CsvQuoting = "always"): string {
  let text = value === null ? "" : String(value);
  if (typeof value === "string" && (/^[\t\r\n]/u.test(value) || /^[\s\uFEFF]*[=+\-@]/u.test(value))) {
    text = `'${text}`;
  }
  return quoteCsvCell(text, quote);
}

/** Semicolon/CRLF CSV; individual exporters retain their existing quoting and line endings. */
export function csvRows(rows: readonly (readonly CsvValue[])[], options: CsvOptions = {}): string {
  const { quote = "always", bom = true, trailingNewline = false } = options;
  return (bom ? "\uFEFF" : "") + rows.map(row => row.map(value => csvCell(value, quote)).join(";")).join("\r\n") +
    (trailingNewline ? "\r\n" : "");
}
