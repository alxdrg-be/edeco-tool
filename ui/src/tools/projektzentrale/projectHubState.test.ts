import assert from "node:assert/strict";
import { test } from "node:test";
import { dataOf, EMPTY_PROJECT, type Project } from "./projectHubState.ts";

test("project data keeps the editable fields only", () => {
  const project: Project = { ...EMPTY_PROJECT, number: "412698", name: "Parkstrasse", folder: "P:\\412698", contacts: [{ name: "A", role: "Bauherr", company: "", email: "", phone: "" }],
    id: "id-1", version: 7, created_at: "2026-01-01", updated_at: "2026-02-01" };
  const data = dataOf(project);
  assert.deepEqual(Object.keys(data).sort(), Object.keys(EMPTY_PROJECT).sort());
  assert.equal(data.number, "412698");
  assert.equal(data.contacts.length, 1);
});

test("an empty project starts without contacts, documents or archive flag", () => {
  assert.equal(EMPTY_PROJECT.archived, false);
  assert.deepEqual(EMPTY_PROJECT.contacts, []);
  assert.deepEqual(EMPTY_PROJECT.documents, []);
});
