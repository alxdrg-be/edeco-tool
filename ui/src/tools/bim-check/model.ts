export type Point = [number, number];
export type Polygons = Point[][][];
export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

export interface ModelElement {
  id: string;
  ifc_class: string;
  name: string;
  number: string;
  storey: string;
  room_ids: string[];
  area_m2: number | null;
  volume_m3: number | null;
  polygons: Polygons;
}

export interface ElementDetail extends ModelElement {
  attributes: Record<string, Value>;
  psets: Record<string, Record<string, Value>>;
}

export interface BuildingModel {
  id: string;
  filename: string;
  source: string;
  elements: ModelElement[];
  warnings: string[];
  summary: {
    rooms: number;
    elements: number;
    storeys: { name: string; rooms: number; elements: number }[];
  };
}

export interface Rule {
  id: string;
  ifc_class: string;
  pset: string;
  attribute: string;
}

export const statuses = ["Fehlt", "Leer", "Abweichend", "OK", "Optional"] as const;
export type Status = typeof statuses[number];

export interface Finding {
  rule_id: string;
  element_id: string;
  ifc_class: string;
  name: string;
  number: string;
  storey: string;
  pset: string;
  attribute: string;
  status: Status;
  actual: Value;
  expected: string;
  message: string;
}

export interface Report {
  rules: Rule[];
  rows: Finding[];
  counts: Partial<Record<Status, number>>;
  warnings: string[];
  pass_rate: number | null;
}

export const count = (n: number) => n.toLocaleString("de-CH");
export function quantity(n: number, singular: string, plural: string) {
  return `${count(n)} ${n === 1 ? singular : plural}`;
}
export const measure = (n: number | null, unit: string) => n == null ? "—" : `${n.toLocaleString("de-CH", { maximumFractionDigits: 2 })} ${unit}`;
export const floorLabel = (floor: string) => floor || "Ohne Geschossangabe";
export const isRoom = (element: ModelElement) => element.ifc_class === "IfcSpace" || element.ifc_class === "NovaRaumbezug";
export function elementLabel(element: Pick<ModelElement, "number" | "name" | "id">) {
  const parts = [element.number, element.name].filter(Boolean);
  return [...new Set(parts)].join(" · ") || element.id;
}
export function displayValue(value: Value): string {
  if (value == null || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}
export function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row), group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
}
