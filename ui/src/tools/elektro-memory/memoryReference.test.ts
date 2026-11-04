import test from "node:test";
import assert from "node:assert/strict";
import { IP_FIRST, IP_SECOND, SWISS_SOCKETS, parseIpCode, readMemoryFavorites, socketContactPoints } from "./memoryReference.ts";

test("Swiss socket fronts distinguish their actual contact count and 10/16-A profile", () => {
  const byType = new Map(SWISS_SOCKETS.map(socket => [socket.type, socket]));
  for (const type of [13, 23] as const) assert.equal(socketContactPoints(byType.get(type)!).length, 3);
  for (const type of [15, 25] as const) assert.equal(socketContactPoints(byType.get(type)!).length, 5);
  assert.equal(byType.get(13)!.contactShape, "round");
  assert.equal(byType.get(15)!.contactShape, "round");
  assert.equal(byType.get(23)!.contactShape, "rectangle");
  assert.equal(byType.get(25)!.contactShape, "rectangle");
  assert.ok(SWISS_SOCKETS.every(socket => socket.current === 10 ? socket.contactShape === "round" : socket.contactShape === "rectangle"));
});

test("IP decoder preserves X and rejects unsupported or incomplete digit sequences", () => {
  assert.deepEqual(parseIpCode(" IP 44 "), { first: "4", second: "4" });
  assert.deepEqual(parseIpCode("ipx7"), { first: "X", second: "7" });
  assert.deepEqual(parseIpCode("2x"), { first: "2", second: "X" });
  assert.deepEqual(parseIpCode("IP00"), { first: "0", second: "0" });
  for (const invalid of ["IP9K", "IP69", "IP4", "IP444", "IP44 garbage", "", "IP74"]) assert.equal(parseIpCode(invalid), null, invalid);
  assert.equal(IP_FIRST.find(entry => entry.digit === "X")!.title, "Nicht angegeben");
  assert.notEqual(IP_FIRST.find(entry => entry.digit === "X")!.detail, IP_FIRST.find(entry => entry.digit === "0")!.detail);
  for (const digit of ["7", "8"]) assert.match(IP_SECOND.find(entry => entry.digit === digit)!.detail, /nicht automatisch IPX5 oder IPX6/);
});

test("favorite storage cannot introduce unknown topics or duplicates", () => {
  assert.deepEqual(readMemoryFavorites('["ip","ip","missing",42,"sockets"]', ["ip", "sockets"]), ["ip", "sockets"]);
  for (const value of [null, "broken", "{}", '"ip"']) assert.deepEqual(readMemoryFavorites(value, ["ip"]), []);
});
