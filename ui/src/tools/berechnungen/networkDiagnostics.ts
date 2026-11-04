import type { Diagnostic, DiagnosticTarget } from "./DiagnosticDetails.tsx";
import { numeric } from "./engineering.ts";
import type { NetworkDocument, NetworkIssue, NetworkNode, NetworkResult } from "./networkTypes.ts";

export interface NetworkDiagnostic extends Diagnostic { issue: NetworkIssue }

/** Values in the message are deliberately excluded, so an open explanation updates in place. */
export function networkDiagnosticId(issue: NetworkIssue): string {
  return ["network", issue.code || "structure", issue.edgeId || "", issue.nodeId || "", issue.relatedNodeId || "", issue.field || ""].map(encodeURIComponent).join(":");
}

function value(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  try { return numeric(raw, "Projektwert", 0, Number.MAX_VALUE, true); } catch { return undefined; }
}
const actual = (n: number, unit = "") => `${n !== 0 && (Math.abs(n) < .001 || Math.abs(n) >= 1e9) ? n.toExponential(3) : n.toLocaleString("de-CH", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;

/** Directed decimal rounding never weakens a minimum or increases an upper bound. */
export function networkBound(n: number, direction: "up" | "down", digits = 4): string {
  if (!Number.isFinite(n)) return "nicht bestimmbar";
  if (n === 0) return "0";
  if (n < 0) return `−${networkBound(-n, direction === "up" ? "down" : "up", digits)}`;
  const count = Math.min(17, Math.max(1, digits));
  // The shortest string can cross a decimal power for subnormal doubles
  // (1e-323 is actually 9.8813…e-324); keep the round-trip exponent instead.
  const exponent = Number(n.toExponential(16).split("e")[1]);
  const [mantissa, roundedExponent] = n.toExponential(count - 1).split("e");
  const power = exponent - count + 1;
  let integer = BigInt(mantissa.replace(".", "")) * 10n ** BigInt(Number(roundedExponent) - exponent);
  const parsed = () => Number(`${integer}e${power}`);
  if (direction === "up" && parsed() < n) integer++;
  if (direction === "down" && parsed() > n) integer--;
  if (!Number.isFinite(parsed()) && count < 17) return networkBound(n, direction, count + 1);
  const text = String(integer), point = text.length + power;
  if (exponent < -4 || exponent > 7) {
    const tail = text.slice(1).replace(/0+$/, "");
    return `${text[0]}${tail ? `.${tail}` : ""}e${point - 1}`;
  }
  const decimal = point <= 0 ? `0.${"0".repeat(-point)}${text}` : point >= text.length ? text + "0".repeat(point - text.length) : `${text.slice(0, point)}.${text.slice(point)}`;
  return decimal.includes(".") ? decimal.replace(/0+$/, "").replace(/\.$/, "") : decimal;
}

export function networkInterval(lower: number, upper: number): { lower: string; upper: string } | null {
  if (!(lower >= 0) || !(upper > 0) || lower > upper || !Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  for (let digits = 4; digits <= 17; digits++) {
    const lo = networkBound(lower, "up", digits), hi = networkBound(upper, "down", digits);
    if (Number(lo) <= Number(hi) && Number(hi) > 0) return { lower: lo, upper: hi };
  }
  return null;
}

interface ProtectionGroup { protector: NetworkNode; lower: number; upper: number; complete: boolean }

/** Explain model conditions without parsing translated messages or changing inputs. */
export function buildNetworkDiagnostics(document: NetworkDocument, result: NetworkResult): NetworkDiagnostic[] {
  const nodeList = Array.isArray(document?.nodes) ? document.nodes : [];
  const edgeList = Array.isArray(document?.edges) ? document.edges : [];
  const nodes = new Map(nodeList.filter(Boolean).map(node => [node.id, node]));
  const edges = new Map(edgeList.filter(Boolean).map(edge => [edge.id, edge]));
  const edgeResults = new Map(result.edges.map(edge => [edge.id, edge]));
  const nodeResults = new Map(result.nodes.map(node => [node.id, node]));
  const source = nodeList.find(node => node?.kind === "source");
  const nodeName = (id: string) => typeof nodes.get(id)?.label === "string" && nodes.get(id)!.label ? nodes.get(id)!.label : id;
  const groups = new Map<string, ProtectionGroup>(), protectedBy = new Map<string, string>();
  const visited = new Set<string>();
  function walk(id: string, upstream?: NetworkNode) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodes.get(id); if (!node) return;
    const protector = node.kind === "protection" && !["RCD", "SWITCH"].includes(node.values?.device) ? node : upstream;
    if (protector && !groups.has(protector.id)) groups.set(protector.id, { protector, lower: nodeResults.get(protector.id)?.current || 0, upper: Infinity, complete: true });
    for (const edge of edgeList.filter(edge => edge?.from === id)) {
      if (protector) {
        protectedBy.set(edge.id, protector.id);
        const group = groups.get(protector.id)!, calculated = edgeResults.get(edge.id), factor = value(protector.values?.i2factor);
        if (calculated) group.lower = Math.max(group.lower, calculated.current);
        if (!calculated || calculated.iz === null || factor === undefined || !(factor > 0)) group.complete = false;
        else group.upper = Math.min(group.upper, calculated.iz, 1.45 * calculated.iz / factor);
      }
      walk(edge.to, protector);
    }
  }
  if (source) walk(source.id);
  const nodeTarget = (id: string | undefined, field = "", label?: string): DiagnosticTarget[] => id && nodes.has(id) ? [{ rowId: `node:${id}`, field, label: label || nodeName(id) }] : [];
  const edgeTarget = (id: string | undefined, field = "", label?: string): DiagnosticTarget[] => id && edges.has(id) ? [{ rowId: `edge:${id}`, field, label: label || "Leitung" }] : [];

  return result.issues.map(issue => {
    const edge = issue.edgeId ? edges.get(issue.edgeId) : undefined;
    const node = issue.nodeId ? nodes.get(issue.nodeId) : undefined;
    const data = issue.data || {};
    const number = (key: string) => typeof data[key] === "number" && Number.isFinite(data[key]) ? data[key] as number : undefined;
    const current = number("actual"), limit = number("limit");
    const title = edge ? `${nodeName(edge.from)} → ${nodeName(edge.to)}` : node ? nodeName(node.id) : "Netz prüfen";
    const diagnostic: NetworkDiagnostic = { id: networkDiagnosticId(issue), title, tone: issue.tone, message: issue.text, issue,
      targets: edge ? edgeTarget(edge.id, issue.field || "") : nodeTarget(node?.id, issue.field || "") };

    function protection() {
      const protectorId = edge ? protectedBy.get(edge.id) : node?.kind === "protection" ? node.id : issue.relatedNodeId;
      const group = protectorId ? groups.get(protectorId) : undefined;
      const protector = group?.protector;
      const inA = value(protector?.values?.rated), factor = value(protector?.values?.i2factor);
      const calculated = edge ? edgeResults.get(edge.id) : undefined;
      const parallel = value(edge?.values?.parallel);
      if (!group || !protector || inA === undefined || factor === undefined || !(factor > 0)) return;
      // Treat only floating-point noise as equality, and never more than the
      // model's 1e-9 comparison tolerance. Real narrow conflicts remain conflicts.
      const boundaryNoise = Number.isFinite(group.upper) && group.lower > group.upper
        && group.lower - group.upper <= Math.min(1e-9, 8 * Number.EPSILON * Math.max(group.lower, group.upper));
      const range = networkInterval(boundaryNoise ? group.upper : group.lower, group.upper);
      const conflict = Number.isFinite(group.upper) && group.lower > group.upper && !boundaryNoise;
      const rangeText = range ? boundaryNoise ? `Numerisch gleiche Modellgrenze: ${range.lower} A ≤ In ≤ ${range.upper} A.` : group.lower > 0 ? `${range.lower} A ≤ In ≤ ${range.upper} A` : `0 A < In ≤ ${range.upper} A; keine aktive Last, Gerätebereich beachten.` : group.upper > 0 && Number.isFinite(group.upper) ? `Kein gemeinsamer In-Bereich: mindestens ${networkBound(group.lower, "up")} A für die Last, höchstens ${networkBound(group.upper, "down")} A für die dokumentierten Leitungen.` : `Ein gemeinsamer In-Bereich ist noch nicht bestimmbar. ${group.lower > 0 ? `Für die Last benötigt In mindestens ${networkBound(group.lower, "up")} A; die zulässige Obergrenze bleibt ohne Iz-Nachweis offen.` : "In muss positiv bleiben; die zulässige Obergrenze benötigt den Iz-Nachweis."}`;
      diagnostic.actual = `In = ${actual(inA, "A")}; I₂/In = ${actual(factor)}; stärkste Last am Schutzorgan ${actual(group.lower, "A")}${calculated?.iz !== null && calculated?.iz !== undefined ? `; Iz dieser Leitung = ${actual(calculated.iz, "A")}` : ""}.`;
      diagnostic.required = `${rangeText}${group.complete ? " Alle von diesem Schutzorgan gespeisten Leitungen bis zum nächsten Überstromschutz sind berücksichtigt." : " Weitere Leitungsnachweise sind offen; der Bereich ist nur für die dokumentierten Abschnitte vorläufig."}`;
      if (calculated && parallel && parallel > 0) {
        const minimum = Math.max(calculated.current, inA, factor * inA / 1.45);
        diagnostic.required += ` Bei unverändertem In benötigt dieser Abschnitt mindestens Iz = ${networkBound(minimum, "up")} A insgesamt${parallel > 1 ? `, also ${networkBound(minimum / parallel, "up")} A je parallelem Kreis (${parallel} Kreise)` : ""}.`;
      }
      diagnostic.action = `${group.lower > inA + 1e-9 ? "Ein höheres Iz allein behebt Ib > In nicht. " : ""}${conflict ? "Nur den Nennstrom zu senken reicht hier nicht: Last oder Leitungsdimensionierung und Schutzorgan gemeinsam anpassen." : "Last, dokumentierte Leitungsbelastbarkeit und geeignetes Schutzorgan gemeinsam abstimmen."} Prüfstromfaktor nur mit dem zum Gerät gehörenden Nachweis ändern; keine automatische Geräte- oder Herstellerfreigabe.`;
      diagnostic.targets = issue.code === "ib_in" || !edge ? [...nodeTarget(protector.id, "rated", "Schutzorgan · In"), ...edgeTarget(edge?.id, "iz", "Leitung · Iz"), ...nodeTarget(protector.id, "i2factor", "Prüfstromfaktor")] : [...edgeTarget(edge.id, "iz", "Leitung · Iz"), ...nodeTarget(protector.id, "rated", "Schutzorgan · In"), ...nodeTarget(protector.id, "i2factor", "Prüfstromfaktor")];
    }

    switch (issue.code) {
      case "input": {
        const raw = (edge?.values || node?.values)?.[issue.field || ""];
        diagnostic.actual = raw === "" || raw === undefined ? "Eingabe fehlt." : `Eingegeben: ${raw}`;
        diagnostic.required = typeof data.required === "string" ? data.required : "Eine gültige Eingabe im zulässigen Bereich vorgeben.";
        diagnostic.action = "Die markierte Eingabe berichtigen. Es werden keine Ersatzwerte eingesetzt.";
        break;
      }
      case "disconnected":
        diagnostic.required = "Ein durchgehender radialer Pfad von genau einer Einspeisung zu diesem Bauteil.";
        diagnostic.action = "Das markierte Bauteil verbinden oder den nicht benötigten Zweig entfernen.";
        break;
      case "source_current":
        diagnostic.actual = current === undefined || limit === undefined ? undefined : `${actual(current, "A")} benötigt; ${actual(limit, "A")} dokumentiert.`;
        diagnostic.required = current === undefined ? undefined : `Dokumentierte Anschlussgrenze mindestens ${networkBound(current, "up")} A oder die angesetzte Last reduzieren.`;
        diagnostic.action = "Verbraucherleistung, Phasenverteilung und Gleichzeitigkeitsansatz mit der tatsächlich verfügbaren Einspeisung abgleichen. Den Anschlusswert nur nach dokumentierter Freigabe erhöhen.";
        break;
      case "transformer_current":
        diagnostic.actual = current === undefined || limit === undefined ? undefined : `${actual(current, "A")} Last gegenüber ${actual(limit, "A")} Trafo-Nennstrom.`;
        diagnostic.required = number("requiredKva") === undefined ? undefined : `Für diesen Strom im verwendeten 3~-Modell mindestens ${networkBound(number("requiredKva")!, "up")} kVA; reale Trafoauslegung separat prüfen.`;
        diagnostic.action = "Last reduzieren oder einen nachgewiesen ausreichend dimensionierten Transformator modellieren.";
        break;
      case "device_current":
        if (node?.kind === "protection" && groups.has(node.id)) protection();
        else {
          diagnostic.actual = current === undefined || limit === undefined ? undefined : `${actual(current, "A")} Last gegenüber ${actual(limit, "A")} Gerätenennstrom.`;
          diagnostic.required = current === undefined ? undefined : `Gerät für mindestens ${networkBound(current, "up")} A dokumentieren oder Last reduzieren.`;
          diagnostic.action = "Den Gerätewert vom Typenschild beziehungsweise Datenblatt übernehmen; eine grössere Zahl allein ersetzt keinen Gerätetausch.";
        }
        break;
      case "icn":
        diagnostic.actual = current === undefined ? undefined : `Ausschaltvermögen ${actual(current, "kA")}.`;
        diagnostic.required = number("required") === undefined ? undefined : `Icn mindestens ${networkBound(number("required")!, "up")} kA am tatsächlichen Einbauort.`;
        diagnostic.action = "Passendes Gerät dokumentieren. Eine Back-up-Zuordnung benötigt eine konkrete Koordinationstabelle.";
        break;
      case "icn_open":
        diagnostic.required = "Belastbare vorgelagerte Quellenimpedanz beziehungsweise dokumentierter maximaler Kurzschlussstrom.";
        diagnostic.action = "Das Idealmodell liefert hier keine endliche Anforderung an Icn. Quellenwerte ergänzen; keinen Ersatz-Kurzschlussstrom annehmen.";
        diagnostic.targets = [...nodeTarget(issue.relatedNodeId || source?.id, "sourceMode", "Quellenmodell"), ...nodeTarget(node?.id, "icn", "Ausschaltvermögen")];
        break;
      case "loop_open":
        diagnostic.required = "Dokumentierter L–PE-Quellenanteil und eine endliche positive gesamte Fehlerschleifenimpedanz.";
        diagnostic.action = "Quelldaten aus Messung beziehungsweise belastbaren Netzangaben ergänzen. Ohne diese Grundlage bleiben Ik,min und die magnetische Vorprüfung offen.";
        diagnostic.targets = [...nodeTarget(issue.relatedNodeId || source?.id, "loopKnown", "L–PE-Quelldaten"), ...nodeTarget(issue.relatedNodeId || source?.id, "loopImpedance", "L–PE-Quellenimpedanz")];
        break;
      case "protection_missing": {
        const from = typeof data.from === "string" ? nodes.get(data.from) : undefined;
        diagnostic.required = "Ein tatsächlich vorgeschaltetes Überstromschutzorgan mit belegten Gerätedaten.";
        diagnostic.action = from?.values?.device === "hak" ? "Ein HAK ist in diesem Modell nur ein Verteilungselement. Die darin beziehungsweise davor vorhandene Sicherung als eigenes Schutzorgan modellieren." : "Die vorgelagerte Sicherung beziehungsweise den LS am tatsächlichen Einbauort ergänzen. Ein FI allein übernimmt keinen Überstromschutz.";
        diagnostic.targets = [...nodeTarget(from?.id, "", "Vorgelagertes Bauteil"), ...edgeTarget(edge?.id, "", "Betroffene Leitung")];
        break;
      }
      case "iz_open":
        diagnostic.required = "Korrigierte Strombelastbarkeit für diese reale Leitung, mit Verlegeart, Temperatur, Häufung und weiteren zutreffenden Faktoren.";
        diagnostic.action = "Belegten Projektwert wählen und Iz je parallelem Kreis eintragen. Die Kurzschluss- und Spannungsfallwerte ersetzen diesen Nachweis nicht.";
        diagnostic.targets = [...edgeTarget(edge?.id, "izMode", "Iz-Grundlage"), ...edgeTarget(edge?.id, "iz", "Iz je Kreis")];
        break;
      case "ib_iz":
      case "in_iz":
      case "i2_iz":
      case "ib_in":
        protection();
        if (!diagnostic.required && current !== undefined && edge) {
          const parallel = number("parallel") || 1;
          diagnostic.actual = `${actual(current, "A")} Betriebsstrom; ${limit === undefined ? "Iz nicht bestimmbar" : `${actual(limit, "A")} Iz insgesamt`}.`;
          diagnostic.required = `Iz mindestens ${networkBound(current, "up")} A insgesamt, also ${networkBound(current / parallel, "up")} A je Kreis.`;
          diagnostic.action = "Leitung und Korrekturfaktoren für die tatsächliche Last nachweisen. Zusätzlich fehlt ein vorgelagertes Überstromschutzorgan.";
        }
        break;
      case "neutral_iz": {
        const parallel = number("parallel") || 1;
        diagnostic.actual = current === undefined || limit === undefined ? undefined : `Neutralleiterstrom ${actual(current, "A")}; N-Iz insgesamt ${actual(limit, "A")}.`;
        diagnostic.required = current === undefined ? undefined : `N-Iz mindestens ${networkBound(current, "up")} A insgesamt; je Kreis mindestens ${networkBound(current / parallel, "up")} A.`;
        diagnostic.action = issue.field === "iz" ? "Bei gleichem N- und Aussenleiterquerschnitt verwendet das Modell denselben Iz-Wert. Diese gemeinsame Eingabe beziehungsweise die tatsächliche Leitung anpassen." : "Neutralleiterquerschnitt und dessen eigene korrigierte Strombelastbarkeit prüfen; die Aussenleiterbelastbarkeit gilt nicht automatisch für den kleineren Neutralleiter.";
        diagnostic.targets = [...edgeTarget(edge?.id, issue.field || "neutralIz", "N-Iz"), ...edgeTarget(edge?.id, "neutralArea", "Neutralleiterquerschnitt")];
        break;
      }
      case "magnetic":
        diagnostic.message = `${issue.text} Die magnetische Auslösung ist damit nicht nachgewiesen. Eine konkrete Abschaltzeit benötigt die passende Gerätekennlinie.`;
        diagnostic.actual = current === undefined || number("required") === undefined ? undefined : `Ik,min-Modell ${actual(current, "A")}; oberer Magnetauslöser ${actual(number("required")!, "A")}${number("loop") === undefined ? "" : `; gesamte Fehlerschleife ${actual(number("loop")!, "Ω")}`}.`;
        diagnostic.required = number("maxLoop") === undefined ? undefined : `Im verwendeten Modell gesamte L–PE-Schleife höchstens ${networkBound(number("maxLoop")!, "down")} Ω (0.95 × 230 V / oberer Magnetauslöser).`;
        diagnostic.action = "Gesamten Leitungs-/PE-Pfad, belegte Quellenimpedanz und passendes Schutzorgan gemeinsam prüfen. Diese Modellgrenze bestätigt keine verbindliche Abschaltzeit.";
        diagnostic.targets = [...edgeTarget(edge?.id, "area", "Aussenleiterquerschnitt"), ...edgeTarget(edge?.id, "peArea", "PE-Querschnitt"), ...nodeTarget(issue.relatedNodeId, "curve", "Charakteristik"), ...nodeTarget(typeof data.source === "string" ? data.source : source?.id, "loopImpedance", "Quellenimpedanz")];
        break;
      case "drop_budget":
      case "drop_near":
        diagnostic.actual = current === undefined || limit === undefined ? undefined : `Gesamter Pfad ${actual(current, "%")}; Projektbudget ${actual(limit, "%")}.`;
        diagnostic.required = limit === undefined ? undefined : `Summe über den gesamten Pfad höchstens ${networkBound(limit, "down")} %.`;
        diagnostic.action = "Länge, Querschnitt und Last der beteiligten Abschnitte prüfen. Ein einzelner lokaler Leitungswert darf das gemeinsame Budget nicht nochmals vollständig beanspruchen.";
        diagnostic.targets = [...edgeTarget(edge?.id, "area", "Querschnitt"), ...edgeTarget(edge?.id, "length", "Leitungslänge"), ...nodeTarget(issue.relatedNodeId || source?.id, "limit", "Dokumentiertes Pfadbudget")];
        break;
      case "drop_model_limit":
        diagnostic.actual = current === undefined ? undefined : `Aufsummierter Spannungsfall ${actual(current, "%")}.`;
        diagnostic.required = "Spannungsfall unter 100 % und innerhalb des tatsächlichen Projektbudgets; sonst ist das lineare Lastmodell hier unbrauchbar.";
        diagnostic.action = "Last, Leitungsweg und Querschnitt prüfen. Aus diesem Zustand keine Versorgungsaussage ableiten.";
        break;
      case "rcd_proof":
      case "manufacturer_proof":
      case "curve_proof":
      case "coordination_proof":
      case "transformer_unbalanced":
        diagnostic.required = "Passender Geräte-/Herstellernachweis beziehungsweise eine gesonderte Fachprüfung für die genannte Bedingung.";
        diagnostic.action = "Diese offene Grundlage lässt sich nicht durch einen frei gewählten Zahlenwert bestätigen. Herstellerdaten und tatsächliche Anlagenbedingungen belegen.";
        break;
      case "idle_branch":
      case "no_active_load":
        diagnostic.actual = "Keine aktive Verbraucherlast; Betriebsstrom 0 A.";
        diagnostic.required = "Tatsächlichen Lastzustand und Gleichzeitigkeitsanteile abbilden; kein Mindeststrom wird erfunden.";
        diagnostic.action = "Prüfen, ob der unbelastete Zweig beabsichtigt ist. Ein Leerergebnis ist keine vollständige Anlagenfreigabe.";
        break;
      case "neutral_shift":
        diagnostic.required = "Spannungsgrenzen an sämtlichen betroffenen Aussenleitern gesondert prüfen.";
        diagnostic.action = "Einphasige Lastverteilung und Neutralleiterpfad kontrollieren. Die Warnung beschreibt eine Modellwirkung und keine pauschale Leitungsfreigabe.";
        break;
      case "legacy_voltage":
        diagnostic.required = "Die für das Projekt dokumentierte Spannungstoleranz verwenden.";
        diagnostic.action = "Den gekennzeichneten Altwert prüfen; er wird nicht stillschweigend überschrieben.";
        break;
      default:
        diagnostic.required = result.valid ? "Die genannte Modellbedingung mit dokumentierten Projektgrundlagen klären." : "Gültige Netzstruktur und berechenbare Eingaben; vor der Korrektur gibt es kein numerisches Ergebnis.";
        diagnostic.action = result.valid ? "Betroffenes Bauteil und die dazugehörigen Unterlagen prüfen." : "Das markierte Bauteil beziehungsweise die Netzverbindungen prüfen. Ungültige Werte werden nicht durch Standardwerte ersetzt.";
    }
    return diagnostic;
  });
}
