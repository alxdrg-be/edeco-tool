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
  return <OhmWheel />;
}

const OHM_RING: { top: string; bottom?: string }[] = [
  { top: "U²", bottom: "P" }, { top: "P", bottom: "I²" }, { top: "U", bottom: "R" }, { top: "P", bottom: "U" },
  { top: "√(P / R)" }, { top: "U · I" }, { top: "R · I²" }, { top: "U²", bottom: "R" },
  { top: "√(P · R)" }, { top: "P", bottom: "I" }, { top: "R · I" }, { top: "U", bottom: "I" },
];

function OhmWheel() {
  const cx = 200, cy = 200, inner = 78, outer = 188, label = 132;
  const slice = Math.PI / 6;
  const point = (radius: number, angle: number) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  const sector = (start: number) => {
    const a0 = -Math.PI / 2 - slice / 2 + start * slice, a1 = a0 + slice;
    const [x0, y0] = point(outer, a0), [x1, y1] = point(outer, a1), [x2, y2] = point(inner, a1), [x3, y3] = point(inner, a0);
    return `M ${x0} ${y0} A ${outer} ${outer} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 0 0 ${x3} ${y3} Z`;
  };
  return <figure className="memory-diagram is-wheel"><svg viewBox="0 0 400 400" role="img" aria-label="Formelscheibe: innen U, R, I und P, aussen zwölf Umstellungen für ohmsche Zusammenhänge">
    <circle className="memory-diagram-soft" cx={cx} cy={cy} r={outer} />
    {OHM_RING.map((_, index) => <path key={index} d={sector(index)} />)}
    <circle cx={cx} cy={cy} r={inner} />
    <path d={`M ${point(inner, Math.PI / 4).join(" ")} L ${point(inner, Math.PI / 4 + Math.PI).join(" ")} M ${point(inner, -Math.PI / 4).join(" ")} L ${point(inner, -Math.PI / 4 + Math.PI).join(" ")}`} />
    <text className="memory-wheel-center" x="200" y="158" textAnchor="middle">R</text>
    <text className="memory-wheel-center" x="248" y="208" textAnchor="middle">I</text>
    <text className="memory-wheel-center" x="200" y="258" textAnchor="middle">P</text>
    <text className="memory-wheel-center" x="152" y="208" textAnchor="middle">U</text>
    {OHM_RING.map((item, index) => {
      const angle = -Math.PI / 2 + index * slice;
      const [x, y] = point(label, angle);
      if (!item.bottom) return <text key={index} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{item.top}</text>;
      const half = Math.max(14, item.top.length * 3.4, item.bottom.length * 3.4);
      return <g key={index}><text x={x} y={y - 8} textAnchor="middle">{item.top}</text><path className="memory-wheel-bar" d={`M ${x - half} ${y} H ${x + half}`} /><text x={x} y={y + 14} textAnchor="middle">{item.bottom}</text></g>;
    })}
  </svg><figcaption>Formelscheibe für ohmsche Zusammenhänge. Innen die gesuchte Grösse, aussen die Umstellung.</figcaption></figure>;
}
