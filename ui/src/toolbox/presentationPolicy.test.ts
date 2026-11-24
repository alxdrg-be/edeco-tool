import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOLS } from "./catalog.ts";
import { allowedToolId, DEFAULT_DEMO_TOOLS, designBetaEnabled, toolAllowed, toolsForPresentation, type PresentationPolicy } from "./presentationPolicy.ts";

const normal: PresentationPolicy = { revision: "0", demo_enabled: false, demo_tools: [...DEFAULT_DEMO_TOOLS], admins: ["aduerger", "nstrauss"], identity: "someone", is_admin: false, can_manage: false, windows_roles: true, design_beta_enabled: false, design_beta_error: "" };

test("design beta requires both a real admin role and explicit opt-in", () => {
  assert.equal(designBetaEnabled(null), false);
  assert.equal(designBetaEnabled({ ...normal, can_manage: true, design_beta_enabled: true }), false);
  assert.equal(designBetaEnabled({ ...normal, is_admin: true }), false);
  assert.equal(designBetaEnabled({ ...normal, is_admin: true, design_beta_enabled: true }), true);
});
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
test("memory is part of the five-tool demo and an explicit reduced selection is respected", () => {
  const demo = { ...normal, demo_enabled: true };
  assert.equal(allowedToolId("elektro-memory", tools, normal), true);
  assert.equal(allowedToolId("elektro-memory", tools, demo), true);
  assert.equal(allowedToolId("elektro-memory", tools, { ...demo, demo_tools: ["nova-legenden"] }), false);
  assert.equal(allowedToolId("formelrechner", tools, demo), true);
  assert.equal(allowedToolId("formelrechner", tools, { ...demo, demo_tools: ["nova-legenden"] }), false);
});

test("the four workshop entries share one opt-in across discovery and direct navigation", () => {
  const beta = { ...normal, is_admin: true, design_beta_enabled: true };
  const workshopIds = ["dwg-werkstatt", "ifc-viewer", "planvergleich"];
  for (const policy of [normal, { ...beta, is_admin: false }, { ...beta, design_beta_enabled: false }, { ...beta, demo_enabled: true }]) {
    const visible = toolsForPresentation(policy);
    for (const id of workshopIds) {
      assert.equal(visible.some(tool => tool.id === id), false);
      assert.equal(allowedToolId(id, TOOLS, policy), false);
    }
    assert.equal(visible.some(tool => tool.title === "Planabgabe"), false);
  }
  assert.deepEqual(toolsForPresentation(null), []);
  const visible = toolsForPresentation(beta);
  for (const id of workshopIds) {
    assert.equal(visible.filter(tool => tool.id === id).length, 1);
    assert.equal(allowedToolId(id, TOOLS, beta), true);
  }
  const delivery = visible.find(tool => tool.id === "planlieferung");
  assert.equal(delivery?.title, "Planabgabe");
  assert.equal(delivery?.hiddenFromHub, false);
});
