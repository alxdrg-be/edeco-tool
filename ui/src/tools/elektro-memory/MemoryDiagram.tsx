import type { MemoryEntry } from "./types";

export default function MemoryDiagram({ kind }: { kind: NonNullable<MemoryEntry["diagram"]> }) {
  if (kind === "power-triangle") return <figure className="memory-diagram"><svg viewBox="0 0 380 160" role="img" aria-label="Leistungsdreieck: Wirkleistung P waagrecht, Blindleistung Q senkrecht, Scheinleistung S als Hypotenuse">
    <path className="memory-diagram-soft" d="M65 125H300V25Z" /><path d="M65 125H300V25Z" /><path className="memory-diagram-muted" d="M280 125V105H300M105 125A40 40 0 0 0 102 109" />
    <text x="175" y="150">P · W</text><text x="310" y="80">Q · var</text><text x="160" y="60">S · VA</text><text x="112" y="115">φ</text>
  </svg><figcaption>Sinusförmige Grössen · dargestellt für positive Blindleistung.</figcaption></figure>;
  if (kind === "dc-ac") return <figure className="memory-diagram"><svg viewBox="0 0 520 170" role="img" aria-label="Gleichstrom als konstante Linie und sinusförmiger Wechselstrom mit positiver und negativer Halbwelle">
    <path className="memory-diagram-muted" d="M25 90H235M35 145V28M285 90H495M295 145V28" /><path d="M40 55H230M300 90C316 25 332 25 348 90S380 155 396 90S428 25 444 90S476 155 492 90" />
    <text x="85" y="160">Gleichstrom</text><text x="345" y="160">Wechselstrom</text><text x="18" y="25">I</text><text x="278" y="25">I</text><text x="235" y="108">t</text><text x="492" y="108">t</text>
  </svg><figcaption>Schematische Kurven ohne feste Zeit- oder Stromskala.</figcaption></figure>;
  if (kind === "resistors") return <figure className="memory-diagram"><svg viewBox="0 0 520 160" role="img" aria-label="Zwei Widerstände in Reihe und dieselben zwei Widerstände parallel">
    <path d="M25 70H70M120 70H155M205 70H245M280 90H305V45H345M395 45H455V90H485M305 90V125H345M395 125H455V90" />
    <rect x="70" y="58" width="50" height="24" /><rect x="155" y="58" width="50" height="24" /><rect x="345" y="33" width="50" height="24" /><rect x="345" y="113" width="50" height="24" />
    <text x="86" y="50">R₁</text><text x="170" y="50">R₂</text><text x="360" y="26">R₁</text><text x="360" y="106">R₂</text><text x="105" y="150">Reihe</text><text x="346" y="158">Parallel</text>
  </svg><figcaption>Ohmsche Widerstände · idealisierte Schaltbilder.</figcaption></figure>;
  if (kind === "ip-code") return <figure className="memory-diagram"><svg viewBox="0 0 420 155" role="img" aria-label="IP-Code mit erster Kennziffer für Berührung und feste Fremdkörper sowie zweiter Kennziffer für Wasser">
    <text className="memory-diagram-big" x="120" y="56">IP</text><text className="memory-diagram-big" x="193" y="56">n₁</text><text className="memory-diagram-big" x="249" y="56">n₂</text>
    <path d="M205 70V96H115M260 70V125H305" /><text x="18" y="116">Berührung / Fremdkörper</text><text x="287" y="145">Wasser</text>
  </svg><figcaption>Die Ziffern sind getrennt zu lesen; X kennzeichnet eine nicht angegebene Kennziffer.</figcaption></figure>;
  return <figure className="memory-diagram"><svg viewBox="0 0 380 150" role="img" aria-label="Ohmsches Gesetz: Spannung U ist gleich Widerstand R mal Strom I">
    <path className="memory-diagram-soft" d="M190 15L295 130H85Z" /><path d="M190 15L295 130H85ZM140 70H240M190 70V130" />
    <text className="memory-diagram-big" x="177" y="62">U</text><text className="memory-diagram-big" x="131" y="111">R</text><text className="memory-diagram-big" x="223" y="111">I</text>
  </svg><figcaption>U = R · I · für ohmsche Bauteile mit konstantem Widerstand.</figcaption></figure>;
}
