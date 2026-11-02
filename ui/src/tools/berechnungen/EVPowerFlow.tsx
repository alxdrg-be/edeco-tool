import { Building2, Cable, House, PlugZap } from "lucide-react";
import type { calculateEV } from "./ev-model";
import "./ev.css";

type Result = ReturnType<typeof calculateEV>;
const value = (n: number | undefined, unit = "kW") => n === undefined ? "–" : `${n.toFixed(1)} ${unit}`;

export function EVPowerFlow({ result, reserve }: { result: Result | null; reserve: number }) {
  const total = result?.houseKW ?? 0;
  const reserved = Math.min(total, Math.max(0, reserve - (result?.generationKW ?? 0)));
  const charging = result ? Math.min(Math.max(0, total - reserved), Math.max(0, result.houseImportKW - reserved)) : 0;
  const unused = Math.max(0, total - reserved - charging);
  const width = (n: number) => `${total > 0 ? 100 * n / total : 0}%`;
  return <div className="ev-power-flow" aria-label="Aufteilung der Anschlussleistung">
    <div className="ev-supply-stages">
      <div><House size={18} /><span>Hausanschluss</span><strong>{value(result?.houseKW)}</strong></div>
      <div><Building2 size={18} /><span>Gebäudereserve</span><strong>{value(result ? reserve : undefined)}</strong></div>
      <div><Cable size={18} /><span>Grid-Obergrenze</span><strong>{value(result?.gridKW)}</strong></div>
    </div>
    <div className="ev-balance-heading"><span>Netzbezug am Hausanschluss · Modell</span><InfoBalance total={total} charging={charging} /></div>
    <div className="ev-balance-bar" role="img" aria-label={result ? `Gebäude-Netzanteil ${reserved.toFixed(1)} kW, Lade-Netzanteil innerhalb des Budgets ${charging.toFixed(1)} kW, unverplant ${unused.toFixed(1)} kW` : "Keine gültige Leistungsaufteilung"}>
      <span className="ev-reserved" style={{ width: width(reserved) }} /><span className="ev-charging" style={{ width: width(charging) }} /><span className="ev-unused" style={{ width: width(unused) }} />
    </div>
    {result && result.generationKW > 0 && <div className="ev-local-supply"><strong>Lokale Leistung · {value(result.generationKW)}</strong><span>PV {value(result.pvKW)} + Speicher {value(result.batteryKW)} · am {result.sourceConnection === "house" ? "Hausanschluss" : "Grid-UV"}</span><small>PV: 0.7 × kWp als mittlere Leistungsannahme; Speicher: Tagesenergie / Betriebsstunden.</small></div>}
    <div className="ev-balance-legend"><span><i className="ev-reserved" />Gebäude</span><span><i className="ev-charging" />Laden</span><span><i className="ev-unused" />Unverplant {value(result ? unused : undefined)}</span></div>
    {result && result.allocated > result.available + 1e-9 && <div className="ev-overload" role="status">Ladebedarf über Budget: {value(result.allocated - result.available)}</div>}
    {result && !result.phaseCapacityOK && result.allocated <= result.available + 1e-9 && <div className="ev-overload" role="status">Aussenleiterbudget überschritten: Grid {value(result.strongestGridPhaseCurrent, "A")} / Haus {value(result.strongestHousePhaseCurrent, "A")} (Betrag, einschliesslich Rückspeisung).</div>}
    <div className="ev-distribution-label"><PlugZap size={16} />Ladeverteiler → Ladepunkte<span>{result ? `${result.activeCount} aktiv · ${result.waitingCount} wartend · ${result.phases === 1 ? "1~ mit Phasenrotation" : "3~"}` : "Eingaben prüfen"}</span></div>
  </div>;
}

function InfoBalance({ total, charging }: { total: number; charging: number }) {
  return <strong>{total > 0 ? `${(100 * charging / total).toFixed(0)} % für Laden` : "–"}</strong>;
}

export function EVDetails({ result, count }: { result: Result | null; count: string }) {
  return <dl className="ev-details">
    <div><dt>Ladebedarf im Modell</dt><dd>{value(result?.requested)}</dd></div>
    <div><dt>{result && result.allocated > result.available + 1e-9 ? "Ladebedarf ohne Begrenzung" : "Zuteilung gesamt"}</dt><dd>{value(result?.allocated)}</dd></div>
    <div><dt>Strom je aktivem Punkt · {result?.phases === 1 ? "1~" : "3~"}</dt><dd data-testid="ev-current">{value(result?.perPointCurrent, "A")}</dd></div>
    <div><dt>Aktive / installierte Ladepunkte</dt><dd data-testid="ev-active">{result ? `${result.activeCount} / ${count} · ${result.waitingCount} warten` : "–"}</dd></div>
    <div><dt>Strom L1 / L2 / L3 · Laden</dt><dd data-testid="ev-phases">{result ? result.phaseCurrents.map(v => value(v, "A")).join(" / ") : "–"}</dd></div>
    <div><dt>Stärkster Aussenleiter · Laden</dt><dd data-testid="ev-strongest-phase">{value(result?.strongestPhaseCurrent, "A")}</dd></div>
    <div><dt>Stärkster Netzstrom · Grid / Haus</dt><dd>{result ? `${value(result.strongestGridPhaseCurrent, "A")} / ${value(result.strongestHousePhaseCurrent, "A")}` : "–"}</dd></div>
    {result && result.generationKW > 0 && <><div><dt>Haus · Bezug / Rückspeisung</dt><dd>{value(result.houseImportKW)} / {value(result.houseExportKW)}</dd></div><div><dt>Grid · Bezug / Rückspeisung</dt><dd>{value(result.gridImportKW)} / {value(result.gridExportKW)}</dd></div></>}
  </dl>;
}

export function EVEnergy({ result }: { result: Result | null }) {
  return <section className="ev-energy" aria-label="Ladeenergie und Reichweite"><h2>Energie & Reichweite · Daueraufnahme</h2><div className="ev-energy-values"><div><span>Ladeenergie gesamt</span><strong data-testid="ev-energy-total">{value(result?.energyPerDay, "kWh/Tag")}</strong></div><div><span>Je aktivem Ladepunkt</span><strong>{value(result?.energyPerActive, "kWh/Tag")}</strong></div><div><span>Reichweite je aktivem Punkt</span><strong data-testid="ev-range">{value(result?.kmPerActive, "km/Tag")}</strong></div></div>{result && <p>{value(result.allocated)} × {result.hours.toLocaleString("de-CH")} h = {value(result.energyPerDay, "kWh/Tag")}. Reichweite mit {result.consumption.toLocaleString("de-CH")} kWh/100 km, ohne zusätzliche Ladeverluste. Die aktive Beispielgruppe wird über die ganze Betriebszeit angesetzt.</p>}</section>;
}
