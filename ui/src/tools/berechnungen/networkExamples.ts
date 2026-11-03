import { createNetworkEdge, createNetworkNode } from "./networkModel.ts";
import { arrangeNetwork } from "./networkEditor.ts";
import type { NetworkDocument, NetworkNodeKind } from "./networkTypes.ts";

/** Editable teaching example. Cable Iz values are explicit example assumptions. */
export function createFloorDistributionExample(): NetworkDocument {
  const node = (kind: NetworkNodeKind, id: string, label: string, values: Record<string, string> = {}) => {
    const item = createNetworkNode(kind, id);
    return { ...item, label, values: { ...item.values, ...values } };
  };
  const line = (id: string, from: string, to: string, length: string, area: string, iz: string) => {
    const edge = createNetworkEdge(id, from, to);
    return { ...edge, values: { ...edge.values, length, area, iz } };
  };
  const nodes = [
    node("source", "source", "Einspeisung NS", { maxCurrent: "125" }),
    node("distribution", "hv", "Hauptverteilung", { rated: "125" }),
    node("protection", "feed-1", "LS C32 · UV 1. OG", { rated: "32", curve: "C", icn: "15" }),
    node("distribution", "uv-1", "UV 1. OG", { rated: "63" }),
    node("protection", "ls-1", "LS B16 · 1. OG"),
    node("load", "load-1", "Verbraucher 1. OG", { power: "6.9", cosPhi: "0.95" }),
    node("protection", "feed-2", "LS C32 · UV 2. OG", { rated: "32", curve: "C", icn: "15" }),
    node("distribution", "uv-2", "UV 2. OG", { rated: "63" }),
    node("protection", "ls-2", "LS B16 · 2. OG"),
    node("load", "load-2", "Verbraucher 2. OG", { power: "4.6", cosPhi: "1" }),
  ];
  const edges = [
    line("house-hv", "source", "hv", "5", "25", "80"),
    line("hv-feed-1", "hv", "feed-1", "1", "10", "50"),
    line("feed-uv-1", "feed-1", "uv-1", "15", "10", "50"),
    line("uv-ls-1", "uv-1", "ls-1", "1", "6", "40"),
    line("ls-load-1", "ls-1", "load-1", "15", "2.5", "20"),
    line("hv-feed-2", "hv", "feed-2", "1", "10", "50"),
    line("feed-uv-2", "feed-2", "uv-2", "25", "10", "50"),
    line("uv-ls-2", "uv-2", "ls-2", "1", "6", "40"),
    line("ls-load-2", "ls-2", "load-2", "20", "2.5", "20"),
  ];
  return arrangeNetwork({ version: 1, orientation: "horizontal", name: "Beispiel · UV 1. OG und UV 2. OG", nodes, edges }, "horizontal");
}
