// Nova exports electrical objects with varying IFC classes (often IfcBuildingElementProxy
// or IfcFlow*). Everything that is not architecture therefore counts as installation.
export const viewerGroups = [
  { id: "rooms", label: "Räume", match: /^IFCSPACE$/ },
  { id: "walls", label: "Wände", match: /^IFCWALL/ },
  { id: "slabs", label: "Decken & Dächer", match: /^(IFCSLAB|IFCROOF|IFCCOVERING)/ },
  { id: "openings", label: "Türen & Fenster", match: /^(IFCDOOR|IFCWINDOW|IFCCURTAINWALL)/ },
  { id: "structure", label: "Stützen & Träger", match: /^(IFCCOLUMN|IFCBEAM|IFCMEMBER|IFCPLATE|IFCFOOTING|IFCPILE)/ },
  { id: "stairs", label: "Treppen & Geländer", match: /^(IFCSTAIR|IFCRAMP|IFCRAILING)/ },
  { id: "installation", label: "Installationen", match: /^$/ },
] as const;

export type GroupId = typeof viewerGroups[number]["id"];

export function groupOf(category: string): GroupId {
  return viewerGroups.find(group => group.match.test(category))?.id ?? "installation";
}

export const statusColors = {
  Fehlt: "#C8372D",
  Leer: "#E07B39",
  Abweichend: "#E5A93A",
  OK: "#4C9A62",
  Optional: "#8FA3AD",
} as const;

const severity = ["Fehlt", "Leer", "Abweichend", "OK", "Optional"] as const;
export type CheckStatus = typeof severity[number];

/** The most severe finding decides the colour of an object. */
export function worstStatus(statuses: Iterable<CheckStatus>): CheckStatus | null {
  let best: number | null = null;
  for (const status of statuses) {
    const rank = severity.indexOf(status);
    if (best === null || rank < best) best = rank;
  }
  return best === null ? null : severity[best];
}
