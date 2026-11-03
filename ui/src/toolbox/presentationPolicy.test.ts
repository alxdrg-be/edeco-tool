import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedToolId, toolAllowed, type PresentationPolicy } from "./presentationPolicy.ts";

const normal: PresentationPolicy = { revision: "0", demo_enabled: false, demo_tools: ["nova-legenden", "berechnungen", "dateien-umbenennen", "pdf-werkzeuge"], admins: ["aduerger", "nstrauss"], identity: "someone", is_admin: false, can_manage: false, windows_roles: true };
const tools = [
  { id: "nova-legenden", title: "NOVA", description: "", category: "Elektro", color: "petrol", symbol: "NL", status: "available" as const },
  { id: "berechnungen", title: "Rechner", description: "", category: "Berechnungen", color: "blue", symbol: "=", status: "available" as const },
  { id: "ls-schalter", parentId: "berechnungen", title: "LS", description: "", category: "Berechnungen", color: "blue", symbol: "LS", status: "available" as const },
  { id: "bim2steiger", title: "BIM", description: "", category: "BIM", color: "blue", symbol: "BIM", status: "available" as const },
  { id: "planlieferung", hiddenFromHub: true, title: "Lieferung", description: "", category: "Projekte", color: "gold", symbol: "PL", status: "available" as const },
  { id: "elektro-memory", title: "Elektro-Memory", description: "", category: "Wissen", color: "indigo", symbol: "EM", status: "available" as const },
  { id: "formelrechner", parentId: "berechnungen", title: "Formelrechner", description: "", category: "Berechnungen", color: "indigo", symbol: "Σ", status: "available" as const },
];

test("normal view hides delivery while admin can deliberately open its preserved module", () => {
  assert.equal(allowedToolId("planlieferung", tools, normal), false);
  assert.equal(allowedToolId("planlieferung", tools, { ...normal, is_admin: true }), true);
  assert.equal(allowedToolId("anlagetool", tools, { ...normal, is_admin: true }), false);
});
test("demo scope also applies to administrators and calculator deep links", () => {
  const demo = { ...normal, demo_enabled: true, is_admin: true };
  assert.equal(allowedToolId("nova-legenden", tools, demo), true);
  assert.equal(allowedToolId("ls-schalter", tools, demo), true);
  assert.equal(allowedToolId("bim2steiger", tools, demo), false);
  assert.equal(allowedToolId("planlieferung", tools, demo), false);
  assert.equal(allowedToolId("ls-schalter", tools, { ...demo, demo_tools: ["nova-legenden"] }), false);
  assert.equal(toolAllowed(tools[0], { ...demo, demo_tools: ["nova-legenden"] }), true);
});
test("standalone memory stays out of the four-tool demo while its formula route follows calculations", () => {
  const demo = { ...normal, demo_enabled: true };
  assert.equal(allowedToolId("elektro-memory", tools, normal), true);
  assert.equal(allowedToolId("elektro-memory", tools, demo), false);
  assert.equal(allowedToolId("formelrechner", tools, demo), true);
  assert.equal(allowedToolId("formelrechner", tools, { ...demo, demo_tools: ["nova-legenden"] }), false);
});
