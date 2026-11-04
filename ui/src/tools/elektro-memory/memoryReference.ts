/** Technical reference data, not dimensional construction drawings or installation approvals. */
export const SWISS_SOCKETS = [
  { type: 13, current: 10, voltage: "250 V", conductors: "L + N + PE", contacts: 3, contactShape: "round", recess: "hexagon" },
  { type: 23, current: 16, voltage: "250 V", conductors: "L + N + PE", contacts: 3, contactShape: "rectangle", recess: "hexagon" },
  { type: 15, current: 10, voltage: "250–400 V", conductors: "3L + N + PE", contacts: 5, contactShape: "round", recess: "round" },
  { type: 25, current: 16, voltage: "250–400 V", conductors: "3L + N + PE", contacts: 5, contactShape: "rectangle", recess: "round" },
] as const;
export type SwissSocket = typeof SWISS_SOCKETS[number];

export const IP_FIRST = [
  { digit: "X", title: "Nicht angegeben", detail: "Die erste Kennziffer ist nicht angegeben. X bedeutet nicht 0 und bestätigt keine bestimmte Schutzstufe." },
  { digit: "0", title: "Kein Zugang-/Fremdkörperschutz", detail: "Kein Schutz gegen Zugang zu gefährlichen Teilen und feste Fremdkörper durch diese Kennziffer." },
  { digit: "1", title: "Handrücken / Fremdkörper ≥ 50 mm", detail: "Schutz gegen Zugang mit dem Handrücken und feste Fremdkörper ab 50 mm; genormte Prüfsonden und Prüfbedingungen sind massgebend." },
  { digit: "2", title: "Finger / Fremdkörper ≥ 12,5 mm", detail: "Schutz gegen Zugang mit dem Finger und feste Fremdkörper ab 12,5 mm; nicht als einfache Messlehre verwenden." },
  { digit: "3", title: "Werkzeug / Fremdkörper ≥ 2,5 mm", detail: "Schutz gegen Zugang mit einem Werkzeug und feste Fremdkörper ab 2,5 mm, unter den genormten Prüfbedingungen." },
  { digit: "4", title: "Draht / Fremdkörper ≥ 1 mm", detail: "Schutz gegen Zugang mit einem Draht und feste Fremdkörper ab 1 mm, unter den genormten Prüfbedingungen." },
  { digit: "5", title: "Staubgeschützt", detail: "Staub darf nicht in einer Menge eindringen, die den Betrieb oder die Sicherheit beeinträchtigt. Schutz gegen Zugang mit einem Draht." },
  { digit: "6", title: "Staubdicht", detail: "Kein Eindringen von Staub unter den genormten Prüfbedingungen. Schutz gegen Zugang mit einem Draht." },
] as const;
export const IP_SECOND = [
  { digit: "X", title: "Nicht angegeben", detail: "Die Wasserkennziffer ist nicht angegeben. Daraus lässt sich kein bestimmter Wasserschutz ableiten." },
  { digit: "0", title: "Kein Wasserschutz", detail: "Kein Schutz gegen Wasser durch diese Kennziffer." },
  { digit: "1", title: "Senkrechtes Tropfwasser", detail: "Schutz gegen senkrecht fallende Wassertropfen unter den genormten Prüfbedingungen." },
  { digit: "2", title: "Tropfwasser bei Neigung bis 15°", detail: "Schutz gegen Tropfwasser bei bis zu 15° Neigung des Gehäuses." },
  { digit: "3", title: "Sprühwasser", detail: "Schutz gegen Sprühwasser bis zu 60° gegen die Senkrechte, unter den genormten Prüfbedingungen." },
  { digit: "4", title: "Spritzwasser aus allen Richtungen", detail: "Schutz gegen Spritzwasser aus allen Richtungen unter den genormten Prüfbedingungen." },
  { digit: "5", title: "Strahlwasser", detail: "Schutz gegen Strahlwasser aus allen Richtungen unter den genormten Prüfbedingungen." },
  { digit: "6", title: "Starkes Strahlwasser", detail: "Schutz gegen starkes Strahlwasser aus allen Richtungen unter den genormten Prüfbedingungen." },
  { digit: "7", title: "Zeitweiliges Untertauchen", detail: "Schutz gegen die Wirkung zeitweiligen Untertauchens unter den genormten Prüfbedingungen. IPX7 bestätigt nicht automatisch IPX5 oder IPX6." },
  { digit: "8", title: "Untertauchen unter vereinbarten Bedingungen", detail: "Bedingungen für dauerndes Untertauchen werden mit dem Hersteller vereinbart. Keine allgemeine Eintauchtiefe annehmen. IPX8 bestätigt nicht automatisch IPX5 oder IPX6." },
] as const;
export type IpFirstDigit = typeof IP_FIRST[number]["digit"];
export type IpSecondDigit = typeof IP_SECOND[number]["digit"];

export const IP_ADDITIONAL = [
  ["A", "Handrücken"], ["B", "Finger"], ["C", "Werkzeug"], ["D", "Draht"],
] as const;
export const IP_SUPPLEMENTARY = [
  ["H", "Hochspannungsbetriebsmittel"], ["M", "Bewegte Teile während der Wasserprüfung in Betrieb"],
  ["S", "Bewegte Teile während der Wasserprüfung im Stillstand"], ["W", "Festgelegte Wetterbedingungen"],
] as const;

/** Parse only the digit sequence covered by the current reference (water 0–8). */
export function parseIpCode(value: string): { first: IpFirstDigit; second: IpSecondDigit } | null {
  const match = value.trim().toUpperCase().match(/^(?:IP\s*)?([0-6X])([0-8X])$/);
  return match ? { first: match[1] as IpFirstDigit, second: match[2] as IpSecondDigit } : null;
}

export function socketContactPoints(socket: SwissSocket): readonly (readonly [number, number])[] {
  // Same front view for all four types. Functional contact pattern only, no dimensions.
  return socket.contacts === 3 ? [[29, 43], [71, 43], [50, 55]] : [[29, 43], [71, 43], [50, 55], [29, 68], [71, 68]];
}

export function readMemoryFavorites(value: string | null, allowedIds: readonly string[]): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && allowedIds.includes(id)))] : [];
  } catch { return []; }
}
