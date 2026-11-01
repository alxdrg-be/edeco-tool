import { number, integer, type CalculatorDefinition, type Field, type Inputs } from "./types.ts";

const BASE = "https://www.elektro-rechner.ch/premium/";
const AC_KW_PER_A = Math.sqrt(3) * 400 / 1000;
const f = (key: string, label: string, value: string, unit: string, group: string, help: string, extra: Partial<Field> = {}): Field => ({ key, label, default: value, unit, group, help, ...extra });
const n = (i: Inputs, key: string, label: string, max = 1e8, zero = false) => number(i, key, label, 0, max, zero);
const count = (i: Inputs, key: string, label: string, zero = false) => integer(i, key, label, 0, 10000, zero);
const fmt = (v: number, digits = 1) => v.toFixed(digits);
function choice(i: Inputs, key: string, options: string[]) { if (!options.includes(i[key])) throw new Error("Bitte eine gültige Option wählen."); return i[key]; }
const evidence: Field[] = [
  { key: "basis", label: "Grundlage der Faktoren", default: "assumed", kind: "select", group: "Grundlage", help: "Die Rechnung prüft Ihre Werte mathematisch. Dokumentierte Werte werden dadurch nicht automatisch fachlich freigegeben.", options: [{ value: "assumed", label: "Planungsannahme" }, { value: "documented", label: "Am Projekt dokumentierte Werte" }] },
  { key: "reference", label: "Quellenvermerk", default: "Planungsannahme – am Projekt prüfen", kind: "text", group: "Grundlage", help: "Tabellenstand, Hersteller/Kombination oder projektbezogene Festlegung angeben. Keine automatische Übernahme geschützter Normtabellen." },
];
function documented(i: Inputs) {
  const d = choice(i, "basis", ["assumed", "documented"]) === "documented";
  if (!(i.reference ?? "").trim()) throw new Error("Bitte einen Quellenvermerk eingeben.");
  return d;
}
function assumptions(i: Inputs) { return `Eingabengrundlage: ${i.reference.trim()}. Der Vermerk wird mit dem Rechenstand gespeichert.`; }

/** Proportional allocation, capped separately by each branch's grid protection. */
export function sharePower(budget: number, demands: number[], caps: number[]): number[] {
  const wanted = demands.map((v, index) => Math.min(v, caps[index]));
  const total = wanted.reduce((sum, value) => sum + value, 0);
  return wanted.map(value => total > 0 ? value * Math.min(1, budget / total) : 0);
}

const pkw: CalculatorDefinition = {
  id: "premium-pkw", title: "Ladegrid PKW", description: "Zwei AC-Grids mit gemeinsamem Hausanschluss und eigener Vorsicherung planen.", source: BASE + "ladegrid-rechner.php", scope: "Eigene symmetrische 400-V-AC-Leistungsplanung; keine automatische SIA-2060-Faktorwahl oder Schutzdimensionierung.",
  fields: [
    f("house", "Hausanschluss", "160", "A", "Einspeisung", "Dreiphasiger Anschluss bei 400 V und cos φ = 1."),
    f("reserve", "Gebäudereserve", "30", "kW", "Einspeisung", "Für andere Gebäudeverbraucher reservierte Leistung.", { min: 0 }),
    { key: "mode", label: "Lastmanagement", default: "dynamic", kind: "select", group: "Steuerung", help: "Dynamisch: proportionale Budgetzuteilung mit separater Grid-Begrenzung. Ohne LM bleibt der volle Ladebedarf sichtbar.", options: [{ value: "dynamic", label: "Dynamisches Budgetmodell" }, { value: "static", label: "Statischer manueller Faktor" }, { value: "none", label: "Ohne Lastmanagement" }] },
    f("factor", "Manueller Planungsfaktor", "1", "", "Steuerung", "Nur statisch wirksam. Keine automatische SIA-2060-Tabelle.", { min: 0, max: 1, step: .01 }),
    ...[1, 2].flatMap(g => [f(`grid${g}`, `Grid ${g} · Vorsicherung`, "63", "A", `Grid ${g}`, "Grid darf den Hausanschluss nicht überschreiten."), f(`count${g}`, `Grid ${g} · Ladepunkte`, g === 1 ? "6" : "4", "Stk.", `Grid ${g}`, "Null deaktiviert dieses Grid.", { min: 0 }), f(`power${g}`, `Grid ${g} · Leistung je Punkt`, "11", "kW", `Grid ${g}`, "Konfigurierte dreiphasige AC-Nennleistung je Ladepunkt.")]),
  ],
  calculate(i) {
    const house = n(i, "house", "Hausanschluss", 2000), reserve = n(i, "reserve", "Gebäudereserve", 2000, true), mode = choice(i, "mode", ["dynamic", "static", "none"]), factor = n(i, "factor", "Planungsfaktor", 1, true);
    const grids = [1, 2].map(g => ({ a: n(i, `grid${g}`, `Vorsicherung Grid ${g}`, 2000), count: count(i, `count${g}`, `Ladepunkte Grid ${g}`, true), power: n(i, `power${g}`, `Ladeleistung Grid ${g}`, 100) }));
    if (grids.some(g => g.a > house)) throw new Error("Eine Grid-Vorsicherung überschreitet den Hausanschluss.");
    const totalCount = grids.reduce((s, g) => s + g.count, 0); if (!totalCount) throw new Error("Mindestens einen Ladepunkt erfassen.");
    const houseKW = house * AC_KW_PER_A, budget = Math.max(0, houseKW - reserve), installed = grids.map(g => g.count * g.power), requested = installed.map(p => p * (mode === "static" ? factor : 1));
    const assigned = mode === "none" ? requested : sharePower(budget, requested, grids.map(g => g.a * AC_KW_PER_A));
    const total = assigned.reduce((s, p) => s + p, 0), overload = total > budget + 1e-8 || assigned.some((p, j) => p > grids[j].a * AC_KW_PER_A + 1e-8), empty = reserve > houseKW;
    return {
      metrics: [{ label: "Ladebudget Haus", value: budget, unit: "kW" }, { label: "Installiert", value: installed.reduce((s, p) => s + p, 0), unit: "kW" }, { label: "Ladeleistung im Modell", value: total, unit: "kW" }, { label: "Ladepunkte", value: totalCount, digits: 0 }],
      status: { tone: overload || empty ? "error" : "neutral", text: empty ? "Gebäudereserve überschreitet den Hausanschluss." : overload ? "Unbegrenzter Ladebedarf überschreitet Haus- oder Grid-Budget." : "Die Zuteilung bleibt im rechnerischen Haus- und Grid-Budget; Ausführung ungeprüft." },
      rows: grids.map((g, j) => ({ label: `Grid ${j + 1} · ${g.count} Punkte`, value: `${fmt(assigned[j])} kW gesamt · ${fmt(g.count ? assigned[j] / g.count : 0)} kW je Punkt` })),
      charging: { houseAmps: house, houseKW, reserveKW: reserve, totalAssignedKW: total, mode: mode as "none" | "dynamic" | "static", grids: grids.map((g, j) => ({ label: `Grid ${j + 1}`, amps: g.a, assigned: assigned[j], count: g.count, power: g.power })) },
      diagram: { kind: "chain", nodes: [{ label: "Hausanschluss", value: `${house} A`, detail: `${fmt(houseKW)} kW · 400 V 3~` }, { label: "Ladebudget", value: `${fmt(budget)} kW`, detail: `nach ${fmt(reserve)} kW Reserve`, tone: empty ? "error" : "neutral" }, { label: "Zwei parallele Grids", value: `${fmt(total)} kW`, detail: `Grid 1: ${fmt(assigned[0])} · Grid 2: ${fmt(assigned[1])} kW`, tone: overload ? "error" : "neutral" }] },
      formula: "P₃~ = √3 · 400 V · I / 1000; Budget = max(0, P_Haus − Reserve). Je Grid zuerst min(Bedarf, Grid-Grenze), danach proportionale Verteilung des gemeinsamen Budgets. Ohne LM keine Begrenzung.",
      limitations: ["Symmetrische 3~-AC-Vorplanung bei cos φ = 1. Dynamische Gleichverteilung ist ein Budgetmodell, keine reale Regelungssimulation.", "SIA-2060-Faktoren, Phasenunsymmetrie, Mindestladestrom, Schutzgeräte, Kabel und Netzbetreiberfreigabe werden nicht nachgewiesen."],
    };
  },
};

const lkw: CalculatorDefinition = {
  id: "premium-lkw", title: "Ladegrid E-LKW", description: "AC-Einspeisung, Power Units und DC-Ladepunkte als Leistungskette prüfen.", source: BASE + "ladegrid-lkw.php", scope: "Eigene stationäre AC/DC-Budgetrechnung; keine MCS-/CCS2-Anschluss- oder Netzfreigabe.",
  fields: [f("feed", "AC-Einspeisung", "630", "A", "Einspeisung", "Symmetrisch 400 V, cos φ = 1."), f("reserve", "Reserve andere Verbraucher", "50", "kW", "Einspeisung", "Wird vor der AC/DC-Zuteilung abgezogen.", { min: 0 }), f("units", "Power Units", "3", "Stk.", "AC/DC", "Anzahl parallel betriebener Umrichter."), f("unitPower", "DC-Nennleistung je Unit", "100", "kW", "AC/DC", "Summe begrenzt die DC-Erzeugung."), f("efficiency", "Wirkungsgrad AC → DC", "0.97", "", "AC/DC", "Herstellerwert am vorgesehenen Betriebspunkt, kein normativer Vorgabewert.", { max: 1, step: .01 }), f("posts", "DC-Ladepunkte", "6", "Stk.", "Ladepunkte", "Zuteilung im Modell gleichmässig."), f("postPower", "DC-Nennleistung je Punkt", "75", "kW", "Ladepunkte", "Installierter Anschlussbedarf, kein Batterie-Ladeprofil."), f("factor", "Manueller Bedarfsfaktor", "1", "", "Ladepunkte", "Dokumentierte Annahme mit Lastmanagement; keine automatische Fahrzeug- oder Normtabelle.", { min: 0, max: 1, step: .01 })],
  calculate(i) {
    const feed = n(i, "feed", "AC-Einspeisung", 10000), reserve = n(i, "reserve", "Reserve", 100000, true), units = count(i, "units", "Power Units"), unitPower = n(i, "unitPower", "Unit-Leistung", 2000), efficiency = n(i, "efficiency", "Wirkungsgrad", 1), posts = count(i, "posts", "Ladepunkte"), postPower = n(i, "postPower", "Punktleistung", 3000), factor = n(i, "factor", "Bedarfsfaktor", 1, true);
    const availableAC = Math.max(0, feed * AC_KW_PER_A - reserve), unitsDC = units * unitPower, demandDC = posts * postPower * factor, dc = Math.min(unitsDC, demandDC, availableAC * efficiency), ac = dc / efficiency, loss = ac - dc, limited = dc < demandDC - 1e-8;
    return {
      metrics: [{ label: "AC-Budget nach Reserve", value: availableAC, unit: "kW" }, { label: "Zuteilung DC gesamt", value: dc, unit: "kW" }, { label: "Je DC-Punkt", value: dc / posts, unit: "kW" }, { label: "Umrichterverlust", value: loss, unit: "kW" }],
      status: { tone: reserve > feed * AC_KW_PER_A ? "error" : limited ? "warning" : "neutral", text: reserve > feed * AC_KW_PER_A ? "Reserve überschreitet die AC-Einspeisung." : limited ? "DC-Bedarf wird durch Einspeisung oder Power Units begrenzt." : "DC-Bedarf ist im vereinfachten Leistungsmodell abgedeckt." },
      rows: [{ label: "DC-Nennleistung aller Units", value: unitsDC, unit: "kW" }, { label: "DC-Bedarf mit Faktor", value: demandDC, unit: "kW" }, { label: "AC-Aufnahme der Units", value: ac, unit: "kW" }],
      diagram: { kind: "chain", nodes: [{ label: "AC-Einspeisung", value: `${feed} A`, detail: `${fmt(availableAC)} kW nach Reserve` }, { label: `${units} Power Units`, value: `η ${fmt(efficiency * 100)} %`, detail: `${fmt(ac)} kW AC → ${fmt(dc)} kW DC` }, { label: `${posts} DC-Punkte`, value: `${fmt(dc / posts)} kW / Punkt`, detail: "gleichmässige Modellzuteilung", tone: limited ? "warning" : "neutral" }] },
      formula: "P_DC = min(Anzahl Units · Unit-DC, Anzahl Punkte · Punkt-DC · Faktor, P_AC,verfügbar · η); P_AC = P_DC / η; Verlust = P_AC − P_DC.",
      limitations: ["Konstanter manuell gewählter Wirkungsgrad. Reale Teillast, Gleichrichter-Oberwellen und cos φ sind nicht modelliert.", "Kein Fahrplan, keine Ladezustände oder Ladezeitgarantie; keine Schutz-, Kabel-, MCS-/CCS2- oder Netzverträglichkeitsprüfung."],
    };
  },
};

export function roomGrid(length: number, width: number, areaMax: number, radius: number) {
  let best = { columns: 0, rows: 0, count: Infinity, wallX: 0, wallY: 0 };
  for (let columns = 1; columns <= 1000; columns++) {
    const wallX = length / (2 * columns); if (wallX >= radius) continue;
    const rows = Math.max(1, Math.ceil(width / (2 * Math.sqrt(radius * radius - wallX * wallX)) - 1e-12), Math.ceil(length * width / (columns * areaMax) - 1e-12));
    const total = columns * rows;
    if (rows <= 1000 && total < best.count) best = { columns, rows, count: total, wallX, wallY: width / (2 * rows) };
  }
  if (!Number.isFinite(best.count) || best.count > 10000) throw new Error("Für diese Annahmen wäre das Raster zu gross. Raum/Abdeckung prüfen.");
  return best;
}

const brandmelder: CalculatorDefinition = {
  id: "premium-brandmelder", title: "Brandmelder", description: "Rechteckraum und gleichmässiges Melderraster aus dokumentierten Abdeckungsannahmen.", source: BASE + "brandmelder-rechner.php", scope: "Geometrische Vorplanung. SES-/SN-EN-54-Tabellen werden nicht automatisch bestimmt.",
  fields: [f("length", "Raumlänge", "10", "m", "Raum", "Rechteckiger Raum ohne Unterzüge oder Hindernisse."), f("width", "Raumbreite", "8", "m", "Raum", "Gleichmässiges Raster mit zentrierten Meldern je Rasterzelle."), f("maxArea", "Angenommene Fläche je Melder", "60", "m²", "Abdeckungsannahmen", "Manuell aus dem am Objekt anwendbaren Konzept/Tabellenwert übernehmen. Voreinstellung ist ein Rechenbeispiel, keine Normvorgabe."), f("radius", "Angenommener Abdeckungsradius", "5", "m", "Abdeckungsannahmen", "Maximaler horizontaler Abstand vom Melder zum ungünstigsten Punkt der Rasterzelle. Kein automatisch ermittelter SES-Wert."), ...evidence],
  calculate(i) {
    const length = n(i, "length", "Raumlänge", 10000), width = n(i, "width", "Raumbreite", 10000), maxArea = n(i, "maxArea", "Fläche je Melder", 10000), radius = n(i, "radius", "Abdeckungsradius", 100), isDocumented = documented(i), grid = roomGrid(length, width, maxArea, radius), corner = Math.hypot(grid.wallX, grid.wallY);
    return {
      metrics: [{ label: "Melder im Raster", value: grid.count, digits: 0 }, { label: "Raster", value: `${grid.columns} × ${grid.rows}` }, { label: "Raumfläche", value: length * width, unit: "m²" }, { label: "Entferntester Zellenpunkt", value: corner, unit: "m", digits: 2 }],
      status: { tone: "warning", text: isDocumented ? "Raster erfüllt die eingegebenen geometrischen Annahmen. Fachliche Anwendbarkeit bleibt zu prüfen." : "Geometrisches Beispiel mit Planungsannahmen; keine normgerechte Melderanordnung bestätigt." },
      rows: [{ label: "Fläche je Rasterzelle", value: length * width / grid.count, unit: "m²" }, { label: "Wandabstand in Längsrichtung", value: grid.wallX, unit: "m" }, { label: "Wandabstand in Querrichtung", value: grid.wallY, unit: "m" }], diagram: { kind: "room", length, width, columns: grid.columns, rows: grid.rows, radius },
      formula: "Je Zelle: A = L · B / (Spalten · Reihen) ≤ A_max und r_Ecke = √((L/2Spalten)² + (B/2Reihen)²) ≤ r. Gesucht wird ein Raster mit möglichst wenigen Meldern.",
      limitations: [assumptions(i), "Deckenhöhe/-neigung, Meldertyp, Unterzüge, Einbauten, Luftströmung, Überwachungsumfang, Alarmhörner und Meldergruppen werden nicht nachgewiesen. Die Radiusdarstellung ist keine zertifizierte Melderkennlinie."],
    };
  },
};

const selektivitaet: CalculatorDefinition = {
  id: "premium-selektivitaet", title: "Selektivität", description: "Zwei Schutzorganpaare gegen manuell dokumentierte Herstellergrenzen vergleichen.", source: BASE + "selektivitaet-rechner.php", scope: "Tabellenbasierte Paar-Vorprüfung. Keine Ableitung vollständiger Selektivität aus Nennstromverhältnissen.",
  fields: [
    ...[1, 2, 3].flatMap((stage) => [f(`rating${stage}`, `Stufe ${stage} · Nennstrom`, ["250", "63", "16"][stage - 1], "A", `Stufe ${stage}`, "Dient der Kennzeichnung des exakt nach Herstellerunterlagen zu bestimmenden Schutzorgans."), f(`ik${stage}`, `Stufe ${stage} · maximaler Kurzschlussstrom`, ["10", "6", "1.5"][stage - 1], "kA", `Stufe ${stage}`, "Unabhängig ermittelter prospektiver Kurzschlussstrom am betrachteten Ort.")]),
    f("limit12", "Herstellergrenze Paar 1 → 2", "6", "kA", "Herstellerdaten", "Für exakt diese Geräte, Spannung und Polzahl nachgewiesene Selektivitätsgrenze. Voreinstellung ist ein Rechenbeispiel."), f("limit23", "Herstellergrenze Paar 2 → 3", "3", "kA", "Herstellerdaten", "Keine pauschale Grenzwertermittlung aus B/C/D-Kennlinie oder Nennstromverhältnis."), ...evidence,
  ],
  calculate(i) {
    const ratings = [1, 2, 3].map(s => n(i, `rating${s}`, `Nennstrom Stufe ${s}`, 100000)), ik = [1, 2, 3].map(s => n(i, `ik${s}`, `Kurzschlussstrom Stufe ${s}`, 1000)), limits = [n(i, "limit12", "Herstellergrenze 1→2", 1000), n(i, "limit23", "Herstellergrenze 2→3", 1000)], known = documented(i);
    const pairs = [ik[1] <= limits[0], ik[2] <= limits[1]], passes = pairs.filter(Boolean).length;
    return {
      metrics: [{ label: "Paare innerhalb Eingabegrenze", value: `${passes} / 2` }, { label: "Reserve Paar 1 → 2", value: limits[0] - ik[1], unit: "kA", digits: 2, tone: pairs[0] ? "neutral" : "error" }, { label: "Reserve Paar 2 → 3", value: limits[1] - ik[2], unit: "kA", digits: 2, tone: pairs[1] ? "neutral" : "error" }],
      status: { tone: passes < 2 ? "error" : "warning", text: passes < 2 ? "Mindestens ein Kurzschlussstrom überschreitet die eingegebene Paargrenze." : known ? "Beide Ströme liegen innerhalb der dokumentierten Eingabegrenzen. Gerätezuordnung und Randbedingungen fachlich prüfen." : "Beide Zahlenvergleiche passen; ein Herstellerbeleg für diese Gerätekombination fehlt." },
      rows: [0, 1].map(j => ({ label: `Paar ${j + 1} → ${j + 2}`, value: `I_k ${fmt(ik[j + 1], 2)} kA ≤ Grenze ${fmt(limits[j], 2)} kA: ${pairs[j] ? "ja" : "nein"}` })),
      diagram: { kind: "chain", nodes: ratings.map((v, j) => ({ label: `Schutzorgan Stufe ${j + 1}`, value: `${v} A`, detail: `I_k am Ort ${fmt(ik[j], 2)} kA`, tone: j && !pairs[j - 1] ? "error" : "neutral" })) },
      formula: "Je Schutzorganpaar wird I_k,max am nachgeordneten Ort mit der belegten Hersteller-Selektivitätsgrenze I_s verglichen: I_k,max ≤ I_s. Ein Nennstromverhältnis liefert keinen Selektivitätsnachweis.",
      limitations: [assumptions(i), "Keine Zeit-Strom-Kennlinien, Ausschaltvermögen-/Kaskaden- oder Kurzschlussfestigkeitsprüfung. Kein Nachweis vollständiger Selektivität oder einer allgemein gültigen Gerätekombination."],
    };
  },
};

const kosten: CalculatorDefinition = {
  id: "premium-ladekosten", title: "Ladeinfrastruktur-Kosten", description: "Investition, Betrieb, Ersatz und Erlöse über 15 Jahre transparent vergleichen.", source: BASE + "ladeinfrastruktur-kostenrechner.php", scope: "Eigene nominale CHF-Lebenszyklusrechnung aus manuellen Preisen; keine Preis-, Steuer- oder Renditegarantie.",
  fields: [f("points", "Ladepunkte", "12", "Stk.", "Investition", "Alle Punktkosten werden mit dieser Anzahl multipliziert."), f("hardware", "Hardware je Punkt", "1500", "CHF", "Investition", "Einmalige Anschaffung ohne automatische Preisvorgabe.", { min: 0 }), f("installation", "Installation je Punkt", "1800", "CHF", "Investition", "Montage, Leitungen und lokale Installation.", { min: 0 }), f("shared", "Gemeinsame Erschliessung", "20000", "CHF", "Investition", "Einmalige projektbezogene Kosten.", { min: 0 }), f("annualEnergy", "Energie je Punkt und Jahr", "1800", "kWh/a", "Betrieb", "Manuelle Jahresnutzung, keine Lastgangsimulation.", { min: 0 }), f("buyPrice", "Energie-Einkauf", "0.25", "CHF/kWh", "Betrieb", "Projektbezogener Tarif.", { min: 0, step: .01 }), f("sellPrice", "Verrechnung an Nutzer", "0.35", "CHF/kWh", "Betrieb", "Null bedeutet keine Erlöse.", { min: 0, step: .01 }), f("service", "Wartung je Punkt und Jahr", "90", "CHF/a", "Betrieb", "Wiederkehrende Punktkosten.", { min: 0 }), f("fixed", "Weitere jährliche Kosten", "180", "CHF/a", "Betrieb", "Zum Beispiel Backend. Projektwert manuell erfassen.", { min: 0 }), f("replacementYear", "Ersatz im Betriebsjahr", "10", "Jahr", "Ersatz", "0 deaktiviert den Ersatz; 1 bis 15 liegen im Betrachtungszeitraum.", { min: 0, max: 15 }), f("replacement", "Ersatz je Punkt", "900", "CHF", "Ersatz", "Einmaliger Ersatzbetrag im angegebenen Jahr.", { min: 0 }), f("startYear", "Erstes Betriebsjahr", "2026", "", "Zeitraum", "15 Jahre ab diesem Kalenderjahr.", { min: 1900, max: 2200 })],
  calculate(i) {
    const points = count(i, "points", "Ladepunkte"), hardware = n(i, "hardware", "Hardware", 1e7, true), installation = n(i, "installation", "Installation", 1e7, true), shared = n(i, "shared", "Erschliessung", 1e9, true), energy = n(i, "annualEnergy", "Jahresenergie", 1e7, true), buy = n(i, "buyPrice", "Einkaufstarif", 100, true), sell = n(i, "sellPrice", "Verrechnungstarif", 100, true), service = n(i, "service", "Wartung", 1e6, true), fixed = n(i, "fixed", "Jährliche Kosten", 1e8, true), replacementYear = integer(i, "replacementYear", "Ersatzjahr", 0, 15, true), replacement = n(i, "replacement", "Ersatzbetrag", 1e7, true), startYear = integer(i, "startYear", "Startjahr", 1899, 2200);
    const capex = points * (hardware + installation) + shared, annual = points * (energy * buy + service) + fixed, revenue = points * energy * sell, replacementTotal = replacementYear ? points * replacement : 0;
    const total = capex + annual * 15 + replacementTotal, revenues = revenue * 15;
    let balance = 0, payback: number | null = null;
    const series = Array.from({ length: 15 }, (_, index) => { const year = index + 1, investment = (index === 0 ? capex : 0) + (year === replacementYear ? points * replacement : 0); balance += investment + annual - revenue; if (balance <= 0 && payback === null) payback = year; return { label: String(startYear + index), value: investment, secondary: annual }; });
    return {
      metrics: [{ label: "Gesamtkosten 15 Jahre", value: total, unit: "CHF", digits: 0 }, { label: "Erlöse 15 Jahre", value: revenues, unit: "CHF", digits: 0 }, { label: "Saldo Kosten − Erlöse", value: total - revenues, unit: "CHF", digits: 0 }, { label: "Kosten je Punkt/Jahr", value: total / points / 15, unit: "CHF/a", digits: 0 }],
      status: { tone: "neutral", text: payback === null ? "Mit diesen Annahmen wird die kumulierte Kostendeckung innerhalb von 15 Jahren nicht erreicht." : `Erste kumulierte Kostendeckung im Betriebsjahr ${payback}; spätere Ersatzkosten separat beachten.` },
      rows: [{ label: "Anfangsinvestition", value: capex, unit: "CHF" }, { label: "Betrieb pro Jahr", value: annual, unit: "CHF/a" }, { label: "Ersatz im Zeitraum", value: replacementTotal, unit: "CHF" }, { label: "Verrechnungserlöse pro Jahr", value: revenue, unit: "CHF/a" }], series, seriesLabel: "Nominaler Kostenverlauf · ohne Abzug der Erlöse", seriesUnit: "CHF", seriesLabels: ["Investition / Ersatz", "Betrieb"],
      formula: "Investition = n · (Hardware + Installation) + Erschliessung; Betrieb/a = n · (Energie · Einkauf + Wartung) + Fixkosten; Kosten15 = Investition + 15 · Betrieb + Ersatz; Erlöse15 = 15 · n · Energie · Verrechnungstarif.",
      limitations: ["Alle Preise sind manuelle Planungswerte in CHF. Inflation, Diskontierung, MWST, Steuern, Förderungen, Finanzierung und Restwerte sind nicht eingerechnet.", "Ein einfaches Betreiber-/Verrechnungsszenario. Kein automatischer Vergleich der vier externen Vertragsmodelle; Erlöse hängen von der tatsächlichen Nutzung ab."],
    };
  },
};

const sia: CalculatorDefinition = {
  id: "premium-sia2056", title: "SIA 2056 Energie", description: "Drei Nutzungszonen aus dokumentierten Leistungs- und Nutzungsansätzen bilanzieren.", source: BASE + "sia2056-rechner.php", scope: "Zonenbilanz mit manuell dokumentierten SIA-/Projektansätzen; kein automatischer SIA-2056-Nachweis.",
  fields: [...[1, 2, 3].flatMap(z => [f(`area${z}`, `Zone ${z} · Fläche`, z === 1 ? "300" : "100", "m²", `Zone ${z}`, "Null deaktiviert die Zone.", { min: 0 }), f(`density${z}`, `Zone ${z} · Leistungsdichte`, z === 1 ? "20" : "12", "W/m²", `Zone ${z}`, "Manueller Ansatz aus belegter Nutzungszone/Tabelle. Voreinstellung ist ein Rechenbeispiel.", { min: 0 }), f(`correction${z}`, `Zone ${z} · Korrekturfaktor`, "1", "", `Zone ${z}`, "Dokumentierter Faktor; wird auf Leistung und Jahresenergie angewandt.", { min: 0, max: 5, step: .01 }), f(`sim${z}`, `Zone ${z} · Leistungsgleichzeitigkeit`, "0.8", "", `Zone ${z}`, "Nur für die gleichzeitige Leistungsbilanz, nicht nochmals für effektive Vollbenutzungsstunden.", { min: 0, max: 1, step: .01 }), f(`hours${z}`, `Zone ${z} · Vollbenutzungsstunden`, "1800", "h/a", `Zone ${z}`, "Effektive Jahresstunden inkl. jährlicher Nutzung; maximal 8760.", { min: 0, max: 8760 })]), f("pv", "PV-Jahresertrag", "6000", "kWh/a", "Jahresbilanz PV", "Manueller Ertragswert.", { min: 0 }), f("self", "Angenommener Eigenverbrauchsanteil", "50", "%", "Jahresbilanz PV", "Anteil des PV-Ertrags, der die Jahres-Netzenergie mindert; kein stündlicher Nachweis.", { min: 0, max: 100 }), ...evidence],
  calculate(i) {
    const known = documented(i), zones = [1, 2, 3].map(z => { const area = n(i, `area${z}`, `Fläche Zone ${z}`, 1e7, true), density = n(i, `density${z}`, `Leistungsdichte Zone ${z}`, 1e5, true), correction = n(i, `correction${z}`, `Korrektur Zone ${z}`, 5, true), sim = n(i, `sim${z}`, `Gleichzeitigkeit Zone ${z}`, 1, true), hours = n(i, `hours${z}`, `Vollbenutzungsstunden Zone ${z}`, 8760, true); return { area, installed: area * density / 1000, corrected: area * density * correction / 1000, demand: area * density * correction * sim / 1000, energy: area * density * correction * hours / 1000 }; });
    const area = zones.reduce((s, z) => s + z.area, 0); if (!area) throw new Error("Mindestens eine Zone mit positiver Fläche erfassen.");
    const installed = zones.reduce((s, z) => s + z.installed, 0), demand = zones.reduce((s, z) => s + z.demand, 0), energy = zones.reduce((s, z) => s + z.energy, 0), pv = n(i, "pv", "PV-Jahresertrag", 1e9, true), self = n(i, "self", "Eigenverbrauchsanteil", 100, true), consumedPV = Math.min(energy, pv * self / 100), net = Math.max(0, energy - consumedPV);
    return {
      metrics: [{ label: "Installierte Leistung", value: installed, unit: "kW" }, { label: "Gleichzeitiger Leistungsansatz", value: demand, unit: "kW" }, { label: "Jahresenergie vor PV", value: energy, unit: "kWh/a", digits: 0 }, { label: "Netzenergie im Jahresmodell", value: net, unit: "kWh/a", digits: 0 }],
      status: { tone: "warning", text: known ? "Bilanz mit dokumentierten Eingabeansätzen; SIA-Zuordnung und Anwendbarkeit bleiben fachlich zu prüfen." : "Bilanz aus Planungsannahmen. SIA-2056-Tabellenwerte sind nicht automatisch verifiziert." },
      rows: [...zones.map((z, j) => ({ label: `Zone ${j + 1} · ${z.area} m²`, value: `${fmt(z.demand, 2)} kW gleichzeitig · ${fmt(z.energy, 0)} kWh/a` })), { label: "Energiekennzahl vor PV", value: energy / area, unit: "kWh/(m²·a)" }, { label: "Angesetzter PV-Eigenverbrauch", value: consumedPV, unit: "kWh/a" }],
      series: zones.map((z, j) => ({ label: `Zone ${j + 1}`, value: z.energy })), seriesLabel: "Jahresenergie nach Zone · vor PV", seriesUnit: "kWh/a",
      formula: "P_inst = A · p / 1000; P_gleichzeitig = P_inst · Korrektur · Gleichzeitigkeit; E = P_inst · Korrektur · Vollbenutzungsstunden; Netzenergie = max(0, ΣE − min(ΣE, PV · Eigenverbrauchsanteil)).",
      limitations: [assumptions(i), "Keine automatische Zuordnung von Gebäudekategorie, Verbrauchergruppe oder SIA-Tabellenfaktoren. Drei aggregierte Zonen, keine vollständige Energiebilanz des Gebäudes.", "Jahresenergie und Leistungsbedarf sind getrennte Grössen. Keine Lastgänge, Speicher oder zeitliche PV-Gleichzeitigkeit."],
    };
  },
};

const poe: CalculatorDefinition = {
  id: "premium-poe", title: "PoE-Streckenplaner", description: "Drei Kabelsegmente mit dokumentierten Umrechnungsfaktoren und Planungsreserve.", source: BASE + "poe-streckenplaner.php", scope: "Manuelles äquivalentes Längenmodell; keine automatische ISO/IEC-TR-29125- oder Temperaturtabellenprüfung.",
  fields: [...[1, 2, 3].flatMap(s => [f(`length${s}`, `Segment ${s} · physische Länge`, ["5", "70", "5"][s - 1], "m", `Segment ${s}`, "Null deaktiviert das Segment.", { min: 0 }), f(`factor${s}`, `Segment ${s} · äquivalenter Längenfaktor`, s === 2 ? "1" : "1.5", "", `Segment ${s}`, "Kombinierter manueller Faktor für Kabelart, Patchanteil und projektspezifische Korrekturen. Keine automatisch berechnete Erwärmung.", { max: 5, step: .01 })]), f("maximum", "Dokumentierte äquivalente Längengrenze", "100", "m", "Planungsgrenze", "Projekt-/Herstellerwert für die konkrete Kombination. Kein universeller normativer Grenzwert."), ...evidence],
  calculate(i) {
    const known = documented(i), segments = [1, 2, 3].map(s => ({ index: s, length: n(i, `length${s}`, `Länge Segment ${s}`, 100000, true), factor: n(i, `factor${s}`, `Faktor Segment ${s}`, 5) })), physical = segments.reduce((s, p) => s + p.length, 0), equivalent = segments.reduce((s, p) => s + p.length * p.factor, 0), maximum = n(i, "maximum", "Längengrenze", 100000), reserve = maximum - equivalent;
    if (!physical) throw new Error("Mindestens ein Segment mit positiver Länge erfassen.");
    return {
      metrics: [{ label: "Physische Länge", value: physical, unit: "m" }, { label: "Äquivalente Länge", value: equivalent, unit: "m" }, { label: "Planungsreserve", value: reserve, unit: "m", tone: reserve < 0 ? "error" : "neutral" }, { label: "Auslastung der Eingabegrenze", value: equivalent / maximum * 100, unit: "%" }],
      status: { tone: reserve < 0 ? "error" : "warning", text: reserve < 0 ? "Die äquivalente Strecke überschreitet die angegebene Planungsgrenze." : known ? "Strecke liegt innerhalb der dokumentierten Eingabegrenze; Fachnachweis offen." : "Strecke liegt innerhalb der angenommenen Planungsgrenze; normative Zuordnung ist offen." },
      rows: segments.map((p, j) => ({ label: `Segment ${j + 1}`, value: `${fmt(p.length)} m × ${fmt(p.factor, 2)} = ${fmt(p.length * p.factor)} m äquivalent` })),
      diagram: { kind: "chain", nodes: [{ label: "Switch / PSE", value: "Streckenbeginn" }, ...segments.filter(s => s.length > 0).map(p => ({ label: `Kabelsegment ${p.index}`, value: `${fmt(p.length)} m`, detail: `äquivalent ${fmt(p.length * p.factor)} m` })), { label: "Endgerät / PD", value: `${fmt(reserve)} m Reserve`, tone: reserve < 0 ? "error" : "neutral" }] },
      formula: "L_äquivalent = Σ(L_physisch,Segment · Faktor_Segment); Reserve = eingegebene Längengrenze − L_äquivalent.",
      limitations: [assumptions(i), "Bündelerwärmung, Übertragungsklasse, PoE-Strom, Schirmung, Stecksysteme, Dämpfung und Kanalgrenzen müssen am Projekt separat bestimmt werden. Keine automatische Normkonformitätsaussage.", "Das Modell prüft die eingegebene Längensumme. Ein äquivalenter Längenfaktor ist kein automatisch nachgewiesener thermischer Derating-Faktor."],
    };
  },
};

const brandlast: CalculatorDefinition = {
  id: "premium-brandlast", title: "Brandlast Fluchtweg · Vergleich", description: "Zwei Kabelgruppen vor und nach einer Sanierung in MJ und MJ/m vergleichen.", source: BASE + "brandlast-fluchtweg.php", scope: "Eigene Mengenbilanz mit mittlerer Brandlast je Fluchtwegmeter. VKF-Anwendbarkeit und zulässige Grenzwerte werden nicht automatisch bestimmt.",
  fields: [f("route", "Betrachtete Fluchtweglänge", "20", "m", "Fluchtweg", "Brandlast total wird auf diese Strecke bezogen."), f("limit", "Dokumentierter Planungsgrenzwert", "200", "MJ/m", "Fluchtweg", "Manuell für den konkreten Fluchtweg begründen. Die Voreinstellung ist ein Rechenbeispiel und kein allgemeiner Zulässigkeitsnachweis."), ...[1, 2].flatMap(g => [f(`countBefore${g}`, `Gruppe ${g} · Anzahl vorher`, g === 1 ? "20" : "10", "Stk.", `Kabelgruppe ${g}`, "Gleichartige parallel geführte Kabel.", { min: 0 }), f(`length${g}`, `Gruppe ${g} · Länge je Kabel im Fluchtweg`, "20", "m", `Kabelgruppe ${g}`, "Nur den betrachteten offen bzw. wirksam anzusetzenden Anteil erfassen.", { min: 0 }), f(`specificBefore${g}`, `Gruppe ${g} · Brandlast vorher`, g === 1 ? "1.5" : "2", "MJ/m Kabel", `Kabelgruppe ${g}`, "Produktwert aus Hersteller-/Kabelkatalog. Kein automatisches Kabelmaterialmodell.", { min: 0 }), f(`countAfter${g}`, `Gruppe ${g} · Anzahl nachher`, g === 1 ? "10" : "5", "Stk.", `Kabelgruppe ${g}`, "Verbleibende oder ersetzte Kabelanzahl.", { min: 0 }), f(`specificAfter${g}`, `Gruppe ${g} · Brandlast nachher`, "1", "MJ/m Kabel", `Kabelgruppe ${g}`, "Produktwert des geplanten Kabeltyps; gleiche betrachtete Länge.", { min: 0 })]), ...evidence],
  calculate(i) {
    const known = documented(i), route = n(i, "route", "Fluchtweglänge", 100000), limit = n(i, "limit", "Planungsgrenzwert", 1e6), groups = [1, 2].map(g => { const before = count(i, `countBefore${g}`, `Anzahl vorher Gruppe ${g}`, true), after = count(i, `countAfter${g}`, `Anzahl nachher Gruppe ${g}`, true), length = n(i, `length${g}`, `Kabellänge Gruppe ${g}`, 1e6, true), beforeSpecific = n(i, `specificBefore${g}`, `Brandlast vorher Gruppe ${g}`, 100000, true), afterSpecific = n(i, `specificAfter${g}`, `Brandlast nachher Gruppe ${g}`, 100000, true); if ((before > 0 || after > 0) && length <= 0) throw new Error(`Kabelgruppe ${g}: bei erfassten Kabeln eine positive betrachtete Länge eingeben.`); if (before > 0 && beforeSpecific <= 0) throw new Error(`Kabelgruppe ${g}: positive spezifische Brandlast für den Ist-Zustand angeben.`); if (after > 0 && afterSpecific <= 0) throw new Error(`Kabelgruppe ${g}: positive spezifische Brandlast für den geplanten Zustand angeben.`); return { before: before * length * beforeSpecific, after: after * length * afterSpecific }; }), before = groups.reduce((s, g) => s + g.before, 0), after = groups.reduce((s, g) => s + g.after, 0), beforePerM = before / route, afterPerM = after / route, reduction = before ? (before - after) / before * 100 : null;
    return {
      metrics: [{ label: "Vorher", value: beforePerM, unit: "MJ/m" }, { label: "Nachher", value: afterPerM, unit: "MJ/m", tone: afterPerM > limit ? "error" : "neutral" }, { label: "Reduktion", value: reduction ?? "–", unit: reduction === null ? undefined : "%" }, { label: "Brandlast nachher total", value: after, unit: "MJ" }],
      status: { tone: afterPerM > limit ? "error" : "warning", text: afterPerM > limit ? "Geplanter Zustand überschreitet den eingegebenen Planungsgrenzwert." : known ? "Mittlerer Planungswert liegt unter dem dokumentierten Eingabegrenzwert; lokale Brandlast und VKF-Anwendbarkeit prüfen." : "Mittlerer Planungswert liegt unter dem Annahmewert; kein Brandschutznachweis." },
      rows: [...groups.map((g, j) => ({ label: `Kabelgruppe ${j + 1}`, value: `${fmt(g.before)} → ${fmt(g.after)} MJ` })), { label: "Eingegebener Planungsgrenzwert", value: limit, unit: "MJ/m" }], series: [{ label: "Vorher", value: beforePerM }, { label: "Nachher", value: afterPerM }], seriesLabel: "Kabelbrandlast bezogen auf die betrachtete Fluchtweglänge", seriesUnit: "MJ/m",
      formula: "Q_total = Σ(Anzahl · betrachtete Kabellänge · Herstellerwert in MJ/m Kabel); Q_Strecke = Q_total / Fluchtweglänge; Reduktion = (Q_vorher − Q_nachher) / Q_vorher · 100 %.",
      limitations: [assumptions(i), "Ausgegeben wird der Mittelwert über die betrachtete Fluchtweglänge. Lokale Konzentrationen und Höchstwerte werden nicht nachgewiesen. Nur erfasste Kabel; weitere Installationen, Abschottung, Schutzverkleidung und VKF-Anwendbarkeit separat prüfen.", "Ein rechnerischer Vergleich mit einem manuellen Grenzwert ersetzt keine brandschutztechnische Freigabe."],
    };
  },
};

export const PLANNING: CalculatorDefinition[] = [pkw, lkw, brandmelder, selektivitaet, kosten, sia, poe, brandlast];

pkw.fields.find(field => field.key === "factor")!.visibleWhen = [{ key: "mode", values: ["static"] }];
