import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ToolHandoffStore } from "./toolHandoff.ts";

const pdf = () => new File(["%PDF-1.7 example"], "Legende.pdf", { type: "application/pdf" });
test("file handoff keeps the real File and source project, consumes only once by exact ID", () => {
  const store = new ToolHandoffStore(), file = pdf();
  const staged = store.stage({ target: "pdf-werkzeuge", source: "NOVA-Legenden", files: [file], projectId: "source-project", projectLabel: "1383 · Beispiel" });
  assert.equal(store.peek("dateien-umbenennen"), null);
  assert.equal(store.peek("pdf-werkzeuge")?.files[0], file);
  assert.equal(store.peek("pdf-werkzeuge")?.projectId, "source-project");
  assert.equal(store.stage({ target: "pdf-werkzeuge", source: "NOVA-Legenden", files: [file], projectId: "source-project", projectLabel: "1383 · Beispiel" }).id, staged.id);
  assert.equal(store.take("pdf-werkzeuge", "wrong-id"), null);
  assert.equal(store.take("pdf-werkzeuge", staged.id), staged);
  assert.equal(store.take("pdf-werkzeuge", staged.id), null);
});
test("handoff rejects invalid targets and never replaces an unacknowledged transfer", () => {
  const store = new ToolHandoffStore();
  assert.throws(() => store.stage({ target: "planlieferung" as "pdf-werkzeuge", source: "Nova", files: [pdf()] }));
  assert.throws(() => store.stage({ target: "pdf-werkzeuge", source: "Nova", files: [] }));
  assert.throws(() => store.stage({ target: "pdf-werkzeuge", source: "Nova", files: [new File(["DXF"], "Legende.dxf")] }));
  const pending = store.stage({ target: "pdf-werkzeuge", source: "Nova", files: [pdf()] });
  assert.throws(() => store.stage({ target: "pdf-werkzeuge", source: "Other project", files: [pdf()] }));
  assert.equal(store.peek("pdf-werkzeuge"), pending);
});
test("unused file handoffs expire rather than importing stale documents later", () => {
  let time = 100;
  const store = new ToolHandoffStore(() => time);
  const pending = store.stage({ target: "pdf-werkzeuge", source: "Nova", files: [pdf()] });
  time += 20 * 60 * 1000;
  assert.equal(store.peek("pdf-werkzeuge"), null);
  assert.equal(store.take("pdf-werkzeuge", pending.id), null);
});
