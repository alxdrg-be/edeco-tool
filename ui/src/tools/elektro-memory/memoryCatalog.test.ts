import test from "node:test";
import assert from "node:assert/strict";
import { BASIC_TOPICS } from "./basics.ts";
import { SOURCE_CATALOG } from "./sourceCatalog.ts";
import { filterMemoryEntries, filterMemoryTopics, memoryPagesLabel, referenceMemoryTopics } from "./memorySearch.ts";
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
  assert.deepEqual(filterMemoryTopics(BASIC_TOPICS, "ampere", "all").map(topic => topic.id), ["einheiten-praefixe"]);
  assert.ok(filterMemoryTopics(BASIC_TOPICS, "gross klein", "all").some(topic => topic.id === "einheiten-praefixe"));
  assert.ok(filterMemoryTopics(BASIC_TOPICS, "scheinleistung phi", "all").some(topic => topic.id === "gleich-wechsel-drehstrom"));
  assert.equal(filterMemoryTopics(BASIC_TOPICS, "unbekannter Suchbegriff", "all").length, 0);
  assert.equal(filterMemoryTopics(BASIC_TOPICS, "", "basics").length, BASIC_TOPICS.length);
  assert.equal(filterMemoryTopics(BASIC_TOPICS, "", "reference").length, 0);
  assert.equal(memoryPagesLabel([16, 3, 16]), "PDF S. 3, 16");
  assert.equal(memoryPagesLabel([]), "Ergänzende Grundlagen");
  const sourceFormulas = SOURCE_CATALOG.topics.find(topic => topic.id === "em-basic-formulas")!;
  assert.deepEqual(filterMemoryEntries(sourceFormulas, "Zählerkonstante").map(entry => entry.id), ["em-p16-meter-power"]);
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

test("print furniture stays in provenance while all technical entries remain searchable", () => {
  const sourceEntries = SOURCE_CATALOG.topics.flatMap(topic => topic.entries);
  const sourceNotes = sourceEntries.filter(entry => entry.presentation === "source-note");
  const digital = referenceMemoryTopics(SOURCE_CATALOG.topics);
  assert.equal(sourceEntries.length, 70);
  assert.equal(digital.length, 15);
  assert.deepEqual(sourceNotes.map(entry => entry.id), ["em-p01-ruler", "em-p16-imprint"]);
  assert.equal(digital.flatMap(topic => topic.entries).length, 68);
  assert.equal(digital[0].entries.length, 4);
  assert.ok(digital.every(topic => topic.entries.length > 0));
  assert.deepEqual(digital.flatMap(topic => topic.entries).map(entry => entry.id), sourceEntries.filter(entry => entry.presentation !== "source-note").map(entry => entry.id));
  assert.equal(filterMemoryTopics(digital, "Aufgedrucktes Lineal", "all").length, 0);
  assert.ok(filterMemoryTopics(digital, "Widerstand", "all").some(topic => topic.id === "em-ohm-cover"));
  assert.deepEqual(filterMemoryTopics(digital, "Asbest", "all").map(topic => topic.id), ["em-asbestos"]);
  assert.deepEqual(filterMemoryTopics(digital, "Rohrbelegung", "all").map(topic => topic.id), ["em-conduits"]);
  assert.equal(digital.find(topic => topic.id === "em-spd-conduits")!.entries[0].id, "em-p11-spd-flow");
});
