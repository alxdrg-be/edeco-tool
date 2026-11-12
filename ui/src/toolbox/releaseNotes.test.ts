import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReleaseNotes } from "./releaseNotes.ts";

test("release notes show the newest section without previous releases", () => {
  assert.deepEqual(parseReleaseNotes("## 2026.11\n- Neue Rechner\n- Wissens-Hub\n\n## 2026.10\n- Alter Stand"), {
    heading: "2026.11", points: ["Neue Rechner", "Wissens-Hub"],
  });
});

test("document title and nested headings preserve changes in the first release", () => {
  assert.deepEqual(parseReleaseNotes("# Changelog\n\n## Version 2\n### Neu\n- Kabelrechner\n### Korrekturen\n- Ausgabe korrigiert\n## Version 1\n- Alt"), {
    heading: "Version 2", points: ["Kabelrechner", "Ausgabe korrigiert"],
  });
});

test("horizontal rules end release changes before setup instructions", () => {
  assert.deepEqual(parseReleaseNotes("# Neu\n* Berechnung verbessert\n\n---\n\n# Installation\n- Setup ausführen"), {
    heading: "Neu", points: ["Berechnung verbessert"],
  });
});

test("numbered lists, CRLF and multiline items are readable text", () => {
  assert.deepEqual(parseReleaseNotes("\uFEFF## Version 3\r\n1. **Neue** Auswahl\r\n   mit Details\r\n2) `PDF` Export\r\n+ [x] [Wissen](https://example.com) verknüpft\r\n"), {
    heading: "Version 3", points: ["Neue Auswahl mit Details", "PDF Export", "Wissen verknüpft"],
  });
});

test("plain paragraphs provide a fallback when a release has no bullet list", () => {
  assert.deepEqual(parseReleaseNotes("Neue Berechnungen\nmit passenden Icons.\n\nDie Ausgabe wurde verbessert."), {
    heading: "", points: ["Neue Berechnungen mit passenden Icons.", "Die Ausgabe wurde verbessert."],
  });
});

test("empty and heading-only notes have no invented changes", () => {
  assert.deepEqual(parseReleaseNotes(" \r\n "), { heading: "", points: [] });
  assert.deepEqual(parseReleaseNotes("## Version 4"), { heading: "Version 4", points: [] });
});

test("untrusted HTML stays literal text and links never become active HTML", () => {
  assert.deepEqual(parseReleaseNotes('- <img src=x onerror="alert(1)">\n- [Ansehen](javascript:alert(1))'), {
    heading: "", points: ['<img src=x onerror="alert(1)">', "Ansehen"],
  });
});
