import assert from "node:assert/strict";
import { test } from "node:test";
import { readJson, responseError, statusFallback } from "./http.ts";

const json = (body: unknown, status = 400) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("a detail string is shown as is", async () => {
  assert.equal(await responseError(json({ detail: "Projekt fehlt." }), "x"), "Projekt fehlt.");
});

test("validation errors show their first messages", async () => {
  const detail = [1, 2, 3, 4].map(n => ({ loc: ["body", "f"], msg: `Feld ${n} fehlt` }));
  assert.equal(await responseError(json({ detail }, 422), "x"), "Feld 1 fehlt Feld 2 fehlt Feld 3 fehlt");
});

test("plain text or empty errors fall back to the given text", async () => {
  assert.equal(await responseError(new Response("Internal Server Error", { status: 500 }), "Speichern fehlgeschlagen."), "Speichern fehlgeschlagen.");
  assert.equal(await responseError(json({ detail: "" }), "Leer"), "Leer");
  assert.equal(await responseError(json(null), "Null"), "Null");
});

test("readJson returns the body or throws the error text", async () => {
  assert.deepEqual(await readJson<{ ok: boolean }>(json({ ok: true }, 200), "x"), { ok: true });
  await assert.rejects(readJson(new Response("<html>", { status: 502 }), "Server nicht erreichbar."), { message: "Server nicht erreichbar." });
});

test("status fallback names code and text", () => {
  assert.equal(statusFallback(new Response("", { status: 404, statusText: "Not Found" })), "404 Not Found");
});
