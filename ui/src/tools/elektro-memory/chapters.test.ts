import assert from "node:assert/strict";
import { test } from "node:test";
import { MEMORY_CHAPTERS } from "./chapters.ts";
import { SOURCE_CATALOG } from "./sourceCatalog.ts";
import { BASIC_TOPICS } from "./basics.ts";

test("every reference entry appears in exactly one chapter, print furniture in none", () => {
  const reference = [...SOURCE_CATALOG.topics, ...BASIC_TOPICS].flatMap(topic => topic.entries).filter(entry => entry.presentation !== "source-note").map(entry => entry.id);
  const placed = MEMORY_CHAPTERS.flatMap(chapter => chapter.entries);
  assert.equal(new Set(placed).size, placed.length, "an entry is listed twice");
  assert.deepEqual([...placed].sort(), [...reference].sort());
});

test("the seven numbered chapters follow the printed index", () => {
  assert.deepEqual(MEMORY_CHAPTERS.filter(chapter => chapter.number).map(chapter => chapter.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(MEMORY_CHAPTERS.map(chapter => chapter.id)).size, MEMORY_CHAPTERS.length);
});

import { MEMORY_CONTENT } from "./memoryContent.ts";
test("readable content only exists for entries that are shown", () => {
  const placed = new Set(MEMORY_CHAPTERS.flatMap(chapter => chapter.entries));
  for (const id of Object.keys(MEMORY_CONTENT)) assert.ok(placed.has(id), id);
});
