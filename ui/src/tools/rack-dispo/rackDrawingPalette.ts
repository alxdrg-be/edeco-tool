/** Drawing colours are document data, independent of the application theme. */
export function rackDrawingFill(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

/** Pick the stronger black/white contrast for user-defined dark or light fills. */
export function rackDrawingInk(fill: string): "#222222" | "#ffffff" {
  const channels = [1, 3, 5].map(index => Number.parseInt(fill.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return red * .2126 + green * .7152 + blue * .0722 >= .213 ? "#222222" : "#ffffff";
}
