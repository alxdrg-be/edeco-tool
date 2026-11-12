import test from "node:test";
import assert from "node:assert/strict";
import { BASIC_TOPICS } from "./basics.ts";
import { SOURCE_CATALOG } from "./sourceCatalog.ts";
import { memoryEntryMatches } from "./memorySearch.ts";
import { MEMORY_CHAPTERS } from "./chapters.ts";
import { isFormulaId } from "../berechnungen/formulaCatalog.ts";

test("the uploaded 16-page source has an explicit complete page inventory", () => {
  assert.equal(SOURCE_CATALOG.completeness.totalPages, 16);
  assert.deepEqual([...new Set(SOURCE_CATALOG.completeness.inventoriedPages)].sort((a, b) => a - b), Array.from({ length: 16 }, (_, index) => index + 1));
  const covered = new Set(SOURCE_CATALOG.topics.flatMap(topic => topic.pages));
  assert.deepEqual([...covered].sort((a, b) => a - b), Array.from({ length: 16 }, (_, index) => index + 1));
  for (const topic of SOURCE_CATALOG.topics) {
    assert.ok(topic.entries.length > 0, `${topic.id}: no silently empty topic`);
    for (const entry of topic.entries) {
      assert.ok(entry.source.page && topic.pages.includes(entry.source.page), `${entry.id}: source page is reachable`);
      assert.ok(entry.explanation || entry.formula || entry.paragraphs?.length || entry.table, `${entry.id}: no title-only placeholder`);
    }
  }
});

test("all calculator links resolve to the one shared formula engine", () => {
  const links = [...SOURCE_CATALOG.topics, ...BASIC_TOPICS].flatMap(topic => topic.entries).flatMap(entry => entry.calculatorFormulaId ? [entry.calculatorFormulaId] : []);
  assert.ok(links.length >= 15);
  for (const id of links) assert.ok(isFormulaId(id), `Unreachable calculator: ${id}`);
});

test("source topics and independent additions keep unique identities and provenance", () => {
  const topics = [...SOURCE_CATALOG.topics, ...BASIC_TOPICS];
  assert.equal(new Set(topics.map(topic => topic.id)).size, topics.length);
  const entries = topics.flatMap(topic => topic.entries);
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length);
  assert.ok(BASIC_TOPICS.every(topic => topic.pages.length === 0 && topic.entries.every(entry => !entry.source.page && entry.source.label)));
});

test("search covers units, table cells, accents and multiple terms", () => {
  const entries = [...SOURCE_CATALOG.topics, ...BASIC_TOPICS].flatMap(topic => topic.entries).filter(entry => entry.presentation !== "source-note");
  const ids = (query: string) => entries.filter(entry => memoryEntryMatches(entry, query)).map(entry => entry.id);
  assert.ok(ids("ampere").includes("elektrische-einheiten"));
  assert.ok(ids("gross klein").includes("si-praefixe"));
  assert.ok(ids("scheinleistung phi").includes("leistungsdreieck-grundlagen"));
  assert.deepEqual(ids("unbekannter Suchbegriff"), []);
  assert.ok(ids("Zählerkonstante").includes("em-p16-meter-power"));
  assert.ok(ids("zahlerkonstante").includes("em-p16-meter-power"));
});

test("known source errors remain explicit and corrected in the product data", () => {
  const entries = SOURCE_CATALOG.topics.flatMap(topic => topic.entries);
  const rcd = entries.find(entry => entry.id === "em-p07-rcd-types")!;
  assert.match(rcd.explanation!, /pulsierende Gleichfehlerströme/);
  assert.match(rcd.correction!, /keine allgemeine Erfassung glatter Gleichfehlerströme/);
  assert.equal(rcd.confidence, "needs-review");
  const meter = entries.find(entry => entry.id === "em-p16-meter-power")!;
  assert.match(meter.formula!, /P_kW = 3600/);
  assert.match(meter.correction!, /kW/);
  const fuse = entries.find(entry => entry.id === "em-p07-diazed-colors")!;
  assert.ok(fuse.table?.rows.some(row => row.some(cell => cell.includes("65 A [prüfen: üblich 63 A]"))));
});

test("print furniture stays in provenance while all technical entries are placed in chapters", () => {
  const sourceEntries = SOURCE_CATALOG.topics.flatMap(topic => topic.entries);
  const sourceNotes = sourceEntries.filter(entry => entry.presentation === "source-note");
  const placed = new Set(MEMORY_CHAPTERS.flatMap(chapter => chapter.entries));
  assert.equal(sourceEntries.length, 70);
  assert.deepEqual(sourceNotes.map(entry => entry.id), ["em-p01-ruler", "em-p16-imprint"]);
  assert.ok(sourceNotes.every(entry => !placed.has(entry.id)));
  assert.equal(sourceEntries.filter(entry => placed.has(entry.id)).length, 68);
  assert.ok(MEMORY_CHAPTERS.every(chapter => chapter.entries.length > 0));
});
