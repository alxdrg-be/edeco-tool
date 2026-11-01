import { Building2, Cable, House, PlugZap } from "lucide-react";
import type { calculateEV } from "./ev";
import "./ev.css";

type Result = ReturnType<typeof calculateEV>;
const value = (n: number | undefined, unit = "kW") => n === undefined ? "–" : `${n.toFixed(1)} ${unit}`;

export function EVPowerFlow({ result, reserve }: { result: Result | null; reserve: number }) {
  const total = result?.houseKW ?? 0;
  const reserved = Math.min(total, reserve);
  const charging = result ? Math.min(result.allocated, result.available) : 0;
  const unused = Math.max(0, total - reserved - charging);
  const width = (n: number) => `${total > 0 ? 100 * n / total : 0}%`;
  return <div className="ev-power-flow" aria-label="Aufteilung der Anschlussleistung">
    <div className="ev-supply-stages">
      <div><House size={18} /><span>Hausanschluss</span><strong>{value(result?.houseKW)}</strong></div>
      <div><Building2 size={18} /><span>Gebäudereserve</span><strong>{value(result ? reserve : undefined)}</strong></div>
      <div><Cable size={18} /><span>Grid-Obergrenze</span><strong>{value(result?.gridKW)}</strong></div>
    </div>
    <div className="ev-balance-heading"><span>So verteilt sich der Hausanschluss</span><InfoBalance total={total} charging={charging} /></div>
    <div className="ev-balance-bar" role="img" aria-label={result ? `Gebäudereserve ${reserve.toFixed(1)} kW, Ladeleistung innerhalb des Budgets ${charging.toFixed(1)} kW, unverplant ${unused.toFixed(1)} kW` : "Keine gültige Leistungsaufteilung"}>
      <span className="ev-reserved" style={{ width: width(reserved) }} /><span className="ev-charging" style={{ width: width(charging) }} /><span className="ev-unused" style={{ width: width(unused) }} />
    </div>
    <div className="ev-balance-legend"><span><i className="ev-reserved" />Gebäude</span><span><i className="ev-charging" />Laden</span><span><i className="ev-unused" />Unverplant {value(result ? unused : undefined)}</span></div>
    {result && result.allocated > result.available + 1e-9 && <div className="ev-overload" role="status">Ladebedarf über Budget: {value(result.allocated - result.available)}</div>}
    <div className="ev-distribution-label"><PlugZap size={16} />Ladeverteiler → Ladepunkte<span>Gleichmässige 3~ Modellverteilung</span></div>
  </div>;
}

function InfoBalance({ total, charging }: { total: number; charging: number }) {
  return <strong>{total > 0 ? `${(100 * charging / total).toFixed(0)} % für Laden` : "–"}</strong>;
}

export function EVDetails({ result, count }: { result: Result | null; count: string }) {
  const amperePerKW = 1000 / (Math.sqrt(3) * 400);
  return <dl className="ev-details">
    <div><dt>Ladebedarf im Modell</dt><dd>{value(result?.requested)}</dd></div>
    <div><dt>{result && result.allocated > result.available + 1e-9 ? "Ladebedarf ohne Begrenzung" : "Zuteilung gesamt"}</dt><dd>{value(result?.allocated)}</dd></div>
    <div><dt>Strom je Punkt · 3~</dt><dd data-testid="ev-current">{value(result ? result.perPoint * amperePerKW : undefined, "A")}</dd></div>
    <div><dt>Verteilung auf Ladepunkte</dt><dd>{result ? `${count} × ${value(result.perPoint)}` : "–"}</dd></div>
  </dl>;
}
