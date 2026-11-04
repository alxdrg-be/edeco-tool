export interface ReleaseNotes {
  heading: string;
  points: string[];
}

/** Read only the newest release section. Returned strings must be rendered as text. */
export function parseReleaseNotes(raw: string): ReleaseNotes {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const result: ReleaseNotes = { heading: "", points: [] };
  let level = 0;
  let pending = "";
  let listItem = false;

  const plain = (value: string) => value
    .replace(/!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_match, stars: string, underscores: string) => stars ?? underscores)
    .trim();
  const flush = () => {
    const point = plain(pending);
    if (point) result.points.push(point);
    pending = "";
    listItem = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) break;
    const heading = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(trimmed);
    if (heading) {
      flush();
      // A document title is not a release section. Its next heading is the release.
      if (!level && /^(?:changelog|release notes|versionsverlauf|änderungsprotokoll)$/i.test(heading[2])) continue;
      if (!level) {
        level = heading[1].length;
        result.heading = plain(heading[2]);
      } else if (heading[1].length <= level) break;
      continue;
    }
    if (!trimmed || /^```|^~~~/.test(trimmed)) {
      flush();
      continue;
    }
    const item = /^(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]\]\s*)?(.+)$/.exec(trimmed);
    if (item) {
      flush();
      pending = item[1];
      listItem = true;
    } else if (listItem && /^\s/.test(line)) {
      pending += ` ${trimmed}`;
    } else {
      if (listItem) flush();
      pending += `${pending ? " " : ""}${trimmed}`;
    }
  }
  flush();
  return result;
}
