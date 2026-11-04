import { strict as assert } from "node:assert";
import { test } from "node:test";
import { aiDataRoute } from "./dataRoute.ts";

test("data route follows the actual endpoint rather than provider name", () => {
  for (const endpoint of ["http://localhost:11434/api/chat", "http://127.0.0.1:11434/api/chat", "http://[::1]:11434/api/chat"]) assert.equal(aiDataRoute(endpoint).kind, "local");
  assert.equal(aiDataRoute("http://192.168.3.20:11434/api/chat").kind, "private");
  assert.equal(aiDataRoute("http://172.31.10.2/api/chat").kind, "private");
  assert.equal(aiDataRoute("http://172.32.10.2/api/chat").kind, "remote");
  assert.equal(aiDataRoute("https://api.openai.com/v1/chat/completions").kind, "remote");
  assert.equal(aiDataRoute("https://ki.firma.ch/api/chat").kind, "remote");
  assert.equal(aiDataRoute("https://127.0.0.1.example.com/api/chat").kind, "remote");
  assert.match(aiDataRoute("https://ki.firma.ch/api/chat").detail, /DNS/);
});
test("summary never displays endpoint credentials or query keys and rejects other schemes", () => {
  const route = aiDataRoute("https://name:secret@ki.example/api/chat?api-key=secret#fragment");
  assert.equal(route.destination, "https://ki.example/api/chat");
  for (const value of ["", "not-an-address", "javascript:alert(1)", "file:///tmp/secret"]) assert.equal(aiDataRoute(value).kind, "invalid");
});
