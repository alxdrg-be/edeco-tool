export type NetworkNodeKind = "source" | "transformer" | "distribution" | "protection" | "load";
export type NetworkOrientation = "horizontal" | "vertical";
export interface NetworkNode {
  id: string;
  kind: NetworkNodeKind;
  label: string;
  x: number;
  y: number;
  values: Record<string, string>;
}
export interface NetworkEdge {
  id: string;
  from: string;
  to: string;
  values: Record<string, string>;
}
export interface NetworkDocument {
  version: 1;
  name: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  orientation?: NetworkOrientation;
}
export type NetworkTone = "ok" | "warning" | "error" | "neutral";
export interface NetworkIssue {
  tone: NetworkTone;
  text: string;
  nodeId?: string;
  edgeId?: string;
  /** Stable calculation condition, independent of translated message text. */
  code?: string;
  field?: string;
  relatedNodeId?: string;
  data?: Record<string, string | number>;
}
export interface NetworkEdgeResult {
  id: string;
  currents: [number, number, number];
  current: number;
  neutralCurrent: number;
  powerKW: number;
  dropVolts: number;
  dropPercent: number;
  cumulativeDropPercent: number;
  iz: number | null;
  ikMaxKA: number | null;
  ikMinKA: number | null;
  tone: NetworkTone;
  checks: string[];
  formula: string;
}
export interface NetworkNodeResult {
  id: string;
  powerKW: number;
  current: number;
  tone: NetworkTone;
  checks: string[];
}
export interface NetworkResult {
  valid: boolean;
  tone: NetworkTone;
  status: string;
  issues: NetworkIssue[];
  nodes: NetworkNodeResult[];
  edges: NetworkEdgeResult[];
  totalPowerKW: number;
  maxCurrent: number;
  maxDropPercent: number;
  formula: string;
  assumptions: string[];
}
