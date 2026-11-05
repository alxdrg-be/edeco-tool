import type { NetworkDocument, NetworkIssue, NetworkResult } from "./networkTypes.ts";

export type NetworkCheckpointStatus = "passed" | "failed" | "open";
export interface NetworkCheckpoint {
  id: string; title: string; status: NetworkCheckpointStatus;
  summary: string; detail: string; required: string; issues: NetworkIssue[];
}

const format = (value: number, unit: string) => `${value.toLocaleString("de-CH", { maximumFractionDigits: 3 })} ${unit}`;
const hasCode = (issue: NetworkIssue, codes: string[]) => codes.includes(issue.code ?? "");
const input = (issue: NetworkIssue, fields: string[]) => issue.code === "input" && fields.includes(issue.field ?? "");

/** Presentation of existing checks only. An absent rule never becomes a passed check. */
export function buildNetworkCheckpoints(document: NetworkDocument, result: NetworkResult): NetworkCheckpoint[] {
  const nodes = Array.isArray(document?.nodes) ? document.nodes.filter(Boolean) : [];
  const edges = Array.isArray(document?.edges) ? document.edges.filter(Boolean) : [];
  const protections = nodes.filter(node => node.kind === "protection");
  const source = nodes.find(node => node.kind === "source");
  const sockets = nodes.filter(node => node.kind === "load" && node.values?.device === "socket");
  const evaluable = result.valid && result.edges.length > 0;
  const checkpoint = (id: string, title: string, summary: string, detail: string, required: string,
    matches: (issue: NetworkIssue) => boolean, canPass = false): NetworkCheckpoint => {
    const issues = result.issues.filter(matches);
    const status: NetworkCheckpointStatus = issues.some(issue => issue.tone === "error") ? "failed"
      : !evaluable || !canPass || issues.some(issue => issue.tone === "warning" || issue.tone === "neutral") ? "open" : "passed";
    return { id, title, status, summary: evaluable ? summary : "Noch nicht berechenbar · Eingaben und Verbindungen zuerst vervollständigen.", detail, required, issues };
  };
  return [
    checkpoint("conductors", "Leiterzuordnung", "Radiale Verbindungen und verfügbare Phasen sind im Modell zugeordnet.",
      "Das Modell prüft die Netzverbindungen sowie 1~/3~-Anschlüsse und L1/L2/L3. Die physische Leiterkennzeichnung und Ausführung werden daraus nicht bestätigt.",
      "Für das Modell: gültiges radiales Netz und zum Anschluss passende Phasen. Die tatsächliche Leiterzuordnung ist am Projekt zu prüfen.",
      issue => !["input", "arithmetic"].includes(issue.code ?? "") && issue.tone === "error" && !issue.data
        || input(issue, ["phases", "phase", "voltage"]), true),
    checkpoint("inductance", "Leitungsinduktivität", "Reaktanz-Richtwerte berücksichtigt · eigenständiger Nachweis offen.",
      "Die Rechnung verwendet hinterlegte X′-Richtwerte nach Querschnitt. Eine gesonderte Prüfung der tatsächlichen Induktivität aus Kabelbauart, Anordnung und Verlegung ist nicht implementiert.",
      "Passende Kabel-/Anordnungsdaten und ein darauf bezogener Nachweis; die Richtwerte sind keine Bestätigung der realen Leitungsgeometrie.",
      issue => input(issue, ["area", "material", "parallel"])),
    checkpoint("pen", "PEN-Reduktion", "PEN-Regeln und TN-C-/TN-C-S-Übergänge sind nicht modelliert.",
      "N und PE können getrennt eingegeben werden. Eine kleinere N-Ader mit eigenem Iz ist kein Nachweis einer zulässigen PEN-Reduktion.",
      "Netzsystem, PEN-Führung und Aufteilung sowie zulässige Mindestquerschnitte anhand der zutreffenden NIN- und Projektgrundlage prüfen.", () => false),
    checkpoint("voltage-drop", "Zulässiger Spannungsfall", `${format(result.maxDropPercent, "%")} im gesamten Pfad · Budget ${source?.values?.limit || "nicht angegeben"} %.`,
      "Die Teilspannungsfälle werden ab der Einspeisung aufsummiert. Ein wählbarer Bezugsbeginn am Zähler oder HAK ist nicht implementiert; deren Symbole verschieben den Rechenbeginn nicht.",
      "Das eingegebene Projektbudget gilt für den ganzen modellierten Pfad. Den erforderlichen Bezug Zähler/HAK für das reale Projekt zusätzlich bestätigen.",
      issue => hasCode(issue, ["drop_budget", "drop_near", "drop_model_limit", "neutral_shift"])
        || input(issue, ["length", "area", "neutralArea", "material", "temperature", "limit"]), true),
    checkpoint("coordination", "Staffelung der Schutzorgane", "Gerätekoordination und Selektivität benötigen Herstellerbelege.",
      "Mehrstufige Überstromschutzgeräte werden erkannt. Der Netzplaner bewertet keine vollständigen Zeit-/Stromkennlinien, Back-up-Tabellen oder Energie-Selektivität. Ein günstiges Nennstromverhältnis reicht dafür nicht.",
      "Konkretes Gerätepaar, Kennlinien beziehungsweise Koordinationstabelle und den tatsächlichen Kurzschlussstrom am Einbauort dokumentieren.",
      issue => hasCode(issue, ["coordination_proof", "manufacturer_proof", "curve_proof"])),
    checkpoint("overcurrent", "Überstromschutz der Kabel und Leitungen", "Ib/In/Iz und I₂ werden mit den eingegebenen Werten verglichen.",
      "Das Modell prüft Betriebsstrom, Schutznennstrom, dokumentiertes Iz und I₂ ≤ 1.45 × Iz, einschliesslich paralleler Kreise und gesondertem N-Iz. Es wählt im Netzplaner keine vollständige Verlege-/Temperatur-/Häufungstabelle.",
      "Iz und Prüfstromfaktor müssen zur tatsächlichen Leitung und zum Schutzgerät belegt sein; fehlende Werte bleiben offen.",
      issue => hasCode(issue, ["ib_iz", "in_iz", "i2_iz", "ib_in", "neutral_iz", "iz_open", "protection_missing"])
        || input(issue, ["iz", "izMode", "neutralIz", "i2factor"]), true),
    checkpoint("supply", "Ausreichende Versorgung der Verbraucher", evaluable ? `${format(result.maxCurrent, "A")} stärkster Aussenleiter · ${format(result.totalPowerKW, "kW")} Verbraucherleistung.` : "",
      "Anschluss-, Geräte- und Trafo-Nennströme werden verglichen. Lasten werden an der Nennspannung berechnet; es gibt keine iterative Lastfluss-, Motoranlauf- oder Oberschwingungsprüfung.",
      "Reale Aufnahmeleistung, Leistungsfaktor, Phasen und Gleichzeitigkeitsanteile sowie verfügbare Anschlussleistung belegen. Besondere Betriebszustände separat prüfen.",
      issue => hasCode(issue, ["source_current", "device_current", "transformer_current", "transformer_unbalanced", "idle_branch"])
        || input(issue, ["power", "cosPhi", "diversity", "maxCurrent", "rated", "kva", "uk"]), true),
    checkpoint("disconnection", "Abschaltbedingung bei Kurzschluss", "LS-/RCBO-Magnetvergleich vorhanden · verbindliche Abschaltzeit offen.",
      "Bei dokumentierter L–PE-Quelle wird das warme Ik,min-Modell mit der oberen magnetischen Grenze verglichen. Ein bestandener Zahlenvergleich bestätigt keine verbindliche Abschaltzeit; NH, MCCB und Motorschutz benötigen konkrete Kennlinien.",
      "Belegte Fehlerschleife, Netzsystem und zum Gerät gehörende Abschaltkennlinie beziehungsweise Zeitnachweis. Fehlende Quelldaten nicht durch einen Wunschwert ersetzen.",
      issue => hasCode(issue, ["loop_open", "magnetic", "manufacturer_proof", "curve_proof", "transformer_unbalanced"])
        || input(issue, ["loopKnown", "loopImpedance", "curve"])),
    checkpoint("breaking", "Schaltvermögen der Schutzorgane", "Geräte-Icn wird gegen Ik,max am Einbauort verglichen.",
      "Für LS, RCBO und MCCB wird der eingegebene Icn-Wert mit dem kalten Ik,max-Modell verglichen. NH-Gerätewerte und herstellerspezifische Back-up-Erweiterungen werden dabei nicht automatisch geprüft.",
      "Endliche dokumentierte Quellenimpedanz und zum konkreten Gerät gehörendes Ausschaltvermögen. Weitere Geräte und Back-up-Fälle benötigen einen eigenen Herstellerbeleg.",
      issue => hasCode(issue, ["icn", "icn_open"]) || input(issue, ["icn", "r", "x", "ik", "sourceMode", "voltageTolerance"]),
      protections.length > 0 && protections.every(node => ["LS", "RCBO", "MCCB"].includes(node.values?.device))),
    checkpoint("cable-short-circuit", "Kurzschlussfestigkeit der Leitungen", "k²·S² ≥ I²·t nur mit belegtem k und belegter Zeit, sonst offen.",
      "Ohne dokumentierten k-Faktor und ohne Einwirkzeit bleibt der Nachweis offen. Es wird kein Normwert eingesetzt. Der Vergleich gilt nur für den Aussenleiterstrom Ik,max geteilt durch die parallelen Leiter. N, PE und PEN bleiben offen.",
      "k und t aus dem Projekt belegen. Anfangs- und Endtemperatur sowie N und PE separat prüfen.",
      issue => hasCode(issue, ["cable_thermal", "cable_thermal_incomplete", "cable_thermal_open"]),
      evaluable && edges.length > 0 && edges.every(edge => (edge.values?.thermalK ?? "").trim() !== "" && (edge.values?.thermalSeconds ?? "").trim() !== "")),
    checkpoint("rcd-sockets", "Zusätzlicher Schutz / FI für Steckdosen", `${sockets.length} Steckdosen-Verbraucher erfasst · automatische Pflichtprüfung offen.`,
      "FI/RCBO, IΔn und ein optionaler Typ sind erfassbar. Das Modell gibt den Typ nicht frei und entscheidet nicht, welche Steckdose Zusatzschutz benötigt. Ein Ladepunkt ohne belegten Typ B oder Typ A/F mit 6 mA bleibt offen.",
      "Anwendungsfall, zutreffende NIN-Anforderung, passender RCD samt IΔn, Typ, Abschaltzeit und Erdungsbedingungen belegen.",
      issue => hasCode(issue, ["rcd_proof", "rcd_dc_open"]) || input(issue, ["tripCurrent", "timeDelayed", "rcdType"])),
  ];
}

export function summarizeNetworkCheckpoints(checkpoints: NetworkCheckpoint[]) {
  const passed = checkpoints.filter(item => item.status === "passed").length;
  const failed = checkpoints.filter(item => item.status === "failed").length;
  const open = checkpoints.filter(item => item.status === "open").length;
  return { passed, failed, open, status: failed ? "failed" as const : open ? "open" as const : "passed" as const };
}
