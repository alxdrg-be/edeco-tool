import { useState, type ReactNode } from "react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import {
  CHARGE_OPTIONS,
  IE3_4POLE_ETA,
  NIN_VOLTAGE_DROP_LIMIT_PERCENT,
  SERVICE_FUSE_A,
  chargeInstallation,
  equipotential,
  lighting,
  motor,
  ohmsAc,
  ohmsDc,
  powerLoss,
  reactiveCompensation,
  sectionsFor,
  shortCircuit,
  transformer,
  voltageDrop,
  type ConnectionPoint,
  type Material,
  type PhaseSystem,
  type SiaClass,
  type StartKind,
} from "./calc";
import type { InstallMethod, Insulation } from "./iz";
import { ChargeSingleLine, LimitBar, SelectivitySketch } from "./graphics";
import "./berechnungen.css";

type Tab = "spannungsfall" | "verlust" | "kurzschluss" | "trafo" | "blind" | "ohm" | "pa" | "motor" | "emob" | "licht";

const TABS: readonly { id: Tab; label: string }[] = [
  { id: "spannungsfall", label: "Spannungsfall" },
  { id: "verlust", label: "Verlustleistung" },
  { id: "kurzschluss", label: "Kurzschluss" },
  { id: "trafo", label: "Transformator" },
  { id: "blind", label: "Blindleistung" },
  { id: "ohm", label: "Ohm" },
  { id: "pa", label: "Potenzialausgleich" },
  { id: "motor", label: "Motoranlauf" },
  { id: "emob", label: "E-Mobilität" },
  { id: "licht", label: "Beleuchtung" },
];

const PHASE_CSA = [4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const TRAFO_KVA = [100, 160, 250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500];

function de(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function required(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(value) ? value : null;
}

function optional(raw: string): number {
  if (raw.trim() === "") return 0;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : Number.NaN;
}

function Num({ label, value, onChange, unit }: { label: string; value: string; onChange: (value: string) => void; unit?: string }) {
  return <label className="field">{label}
    <input className="input" inputMode="decimal" autoComplete="off" value={value} aria-label={unit ? `${label} in ${unit}` : label}
      onChange={(event) => onChange(event.target.value)} />
  </label>;
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly { value: string; label: string }[] }) {
  return <label className="field">{label}
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

function Panel({ id, title, norm, info, children }: { id: string; title: string; norm: string; info: ReactNode; children: ReactNode }) {
  return <section className="calc-panel" aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    <p className="calc-norm">{norm}</p>
    {children}
    <details className="calc-info"><summary>Grundlagen</summary>{info}</details>
  </section>;
}

function Kpis({ items }: { items: { label: string; value: string; tone?: "ok" | "warn" | "over" }[] }) {
  return <div className="calc-results">{items.map((item) => <div className="calc-kpi" key={item.label}>
    <span>{item.label}</span><strong className={item.tone ? `is-${item.tone}` : undefined}>{item.value}</strong>
  </div>)}</div>;
}

function Missing({ text }: { text: string }) {
  return <p className="calc-status is-warn" role="status">{text}</p>;
}

function LimitChoice({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="calc-choice" role="group" aria-label="Zulässiger Spannungsfall">
    <button type="button" className={value === NIN_VOLTAGE_DROP_LIMIT_PERCENT ? "btn is-on" : "btn"} aria-pressed={value === NIN_VOLTAGE_DROP_LIMIT_PERCENT}
      onClick={() => onChange(NIN_VOLTAGE_DROP_LIMIT_PERCENT)}>4 % · NIN 5.2.5.1</button>
    <button type="button" className={value === 3 ? "btn is-on" : "btn"} aria-pressed={value === 3}
      onClick={() => onChange(3)}>3 % · Projektwert</button>
  </div>;
}

function sectionOptions(material: Material) {
  return sectionsFor(material).map((section) => ({ value: String(section), label: `${section} mm²` }));
}

function VoltageDropPanel() {
  const [phases, setPhases] = useState<PhaseSystem>(3);
  const [material, setMaterial] = useState<Material>("cu");
  const [section, setSection] = useState("6");
  const [current, setCurrent] = useState("25");
  const [length, setLength] = useState("50");
  const [cosPhi, setCosPhi] = useState("0,9");
  const [limit, setLimit] = useState(NIN_VOLTAGE_DROP_LIMIT_PERCENT);
  const currentA = required(current);
  const lengthM = required(length);
  const cos = required(cosPhi);
  const result = currentA !== null && lengthM !== null && cos !== null
    ? voltageDrop({ phases, material, sectionMm2: Number(section), currentA, lengthM, cosPhi: cos, limitPercent: limit })
    : null;
  const factor = phases === 1 ? "2" : "√3";
  return <Panel id="calc-spannungsfall" title="Spannungsfall" norm="NIN 5.2.5.1 · SN EN 60228" info={<p>
    R′ stammt aus dem höchstzulässigen Widerstand nach SN EN 60228 bei 20 °C und wird mit α auf 55 °C umgerechnet.
    X′ ist ein Richtwert für mehradrige Kabel, kein Normwert. Einphasig steht der Faktor 2 für Hin- und Rückleiter.
    Der Balken setzt ΔU % ins Verhältnis zum gewählten Grenzwert und stoppt bei 100 %.
  </p>}>
    <div className="calc-grid">
      <Sel label="System" value={String(phases)} onChange={(value) => setPhases(value === "1" ? 1 : 3)} options={[
        { value: "3", label: "Drehstrom 400 V" }, { value: "1", label: "Wechselstrom 230 V" }]} />
      <Sel label="Leiter" value={material} onChange={(value) => {
        const next = value === "al" ? "al" : "cu";
        setMaterial(next);
        if (!sectionsFor(next).includes(Number(section))) setSection(String(sectionsFor(next)[0]));
      }} options={[{ value: "cu", label: "Kupfer" }, { value: "al", label: "Aluminium" }]} />
      <Sel label="Querschnitt" value={section} onChange={setSection} options={sectionOptions(material)} />
      <Num label="Strom" unit="A" value={current} onChange={setCurrent} />
      <Num label="Länge" unit="m" value={length} onChange={setLength} />
      <Num label="cos φ" value={cosPhi} onChange={setCosPhi} />
    </div>
    <LimitChoice value={limit} onChange={setLimit} />
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "Spannungsfall", value: `${de(result.value.deltaUV)} V`, tone: result.value.tone },
        { label: "Anteil", value: `${de(result.value.deltaUPercent)} %`, tone: result.value.tone },
        { label: "Spannung am Ende", value: `${de(result.value.endVoltageV, 1)} V` },
        { label: "Höchstlänge", value: `${de(result.value.maxLengthM, 1)} m` },
      ]} />
      <LimitBar percent={result.value.barPercent} tone={result.value.tone}
        label={`Spannungsfall ${de(result.value.deltaUPercent)} Prozent von ${limit} Prozent Grenzwert`} />
      <p className="calc-formula">ΔU = {factor} · {de(currentA ?? 0, 1)} A · ({de(result.value.rOhm, 4)} Ω · {de(cos ?? 0, 3)} + {de(result.value.xOhm, 4)} Ω · {de(result.value.sinPhi, 3)}) = {de(result.value.deltaUV, 3)} V = {de(result.value.deltaUPercent, 3)} %</p>
      <p className="calc-note">R′ = {de(result.value.rPerKm, 3)} Ω/km bei 55 °C. X′ = {de(result.value.xPerKm, 3)} Ω/km, Richtwert.</p>
    </>}
  </Panel>;
}

function LossPanel() {
  const [phases, setPhases] = useState<PhaseSystem>(3);
  const [material, setMaterial] = useState<Material>("cu");
  const [section, setSection] = useState("16");
  const [parallel, setParallel] = useState("1");
  const [current, setCurrent] = useState("32");
  const [length, setLength] = useState("80");
  const [cosPhi, setCosPhi] = useState("0,9");
  const [limit, setLimit] = useState(NIN_VOLTAGE_DROP_LIMIT_PERCENT);
  const [price, setPrice] = useState("0,25");
  const [hours, setHours] = useState("8");
  const [days, setDays] = useState("250");
  const [years, setYears] = useState("1");
  const values = [required(current), required(length), required(cosPhi), required(price), required(hours), required(days), required(years)];
  const result = values.every((value) => value !== null)
    ? powerLoss({
      phases, material, sectionMm2: Number(section), parallel: Number(parallel),
      currentA: values[0] ?? 0, lengthM: values[1] ?? 0, cosPhi: values[2] ?? 0, limitPercent: limit,
      pricePerKwh: values[3] ?? 0, hoursPerDay: values[4] ?? 0, days: values[5] ?? 0, years: values[6] ?? 0,
    })
    : null;
  return <Panel id="calc-verlust" title="Verlustleistung" norm="SN EN 60228 · NIN 5.2.5.1 für 4 %" info={<>
    <p>Pv = 3 · I² · R′ · L, einphasig mit 2 statt 3. R′ ist derselbe warme Leiterwiderstand wie beim Spannungsfall.</p>
    <p>Der Spannungsfall enthält cos φ und den Richtwert X′. Ein ohmscher Abfall ohne cos φ wäre ein anderer Wert und wird hier nicht als NIN-Nachweis gezeigt. 3 % ist ein Projektwert, keine NIN-Grenze.</p>
  </>}>
    <div className="calc-grid">
      <Sel label="System" value={String(phases)} onChange={(value) => setPhases(value === "1" ? 1 : 3)} options={[
        { value: "3", label: "Drehstrom 400 V" }, { value: "1", label: "Wechselstrom 230 V" }]} />
      <Sel label="Leiter" value={material} onChange={(value) => {
        const next = value === "al" ? "al" : "cu";
        setMaterial(next);
        if (!sectionsFor(next).includes(Number(section))) setSection(String(sectionsFor(next)[0]));
      }} options={[{ value: "cu", label: "Kupfer" }, { value: "al", label: "Aluminium" }]} />
      <Sel label="Querschnitt" value={section} onChange={setSection} options={sectionOptions(material)} />
      <Sel label="Leiter je Phase" value={parallel} onChange={setParallel} options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))} />
      <Num label="Strom" unit="A" value={current} onChange={setCurrent} />
      <Num label="Länge" unit="m" value={length} onChange={setLength} />
      <Num label="cos φ" value={cosPhi} onChange={setCosPhi} />
      <Num label="Preis" unit="CHF/kWh" value={price} onChange={setPrice} />
      <Num label="Stunden pro Tag" value={hours} onChange={setHours} />
      <Num label="Tage" value={days} onChange={setDays} />
      <Num label="Jahre" value={years} onChange={setYears} />
    </div>
    <LimitChoice value={limit} onChange={setLimit} />
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "Verlustleistung", value: `${de(result.value.lossW)} W` },
        { label: "Energie", value: `${de(result.value.energyKwh, 1)} kWh` },
        { label: "Kosten", value: `${de(result.value.costChf)} CHF` },
        { label: "Spannungsfall mit cos φ", value: `${de(result.value.deltaUPercent)} %`, tone: result.value.tone },
      ]} />
      <LimitBar percent={result.value.barPercent} tone={result.value.tone}
        label={`Spannungsfall ${de(result.value.deltaUPercent)} Prozent vom Grenzwert ${limit} Prozent`} />
      <p className="calc-formula">Pv = {phases === 1 ? "2" : "3"} · I² · R′ · L = {de(result.value.lossW, 2)} W. ΔU mit cos φ = {de(result.value.deltaUV, 3)} V.</p>
    </>}
  </Panel>;
}

function ShortCircuitPanel() {
  const [un, setUn] = useState<"400" | "230">("400");
  const [power, setPower] = useState("250");
  const [uk, setUk] = useState("4");
  const [material, setMaterial] = useState<Material>("cu");
  const [section, setSection] = useState("16");
  const [length, setLength] = useState("20");
  const [parallel, setParallel] = useState("1");
  const lengthM = required(length);
  const result = lengthM !== null ? shortCircuit({
    unV: un === "230" ? 230 : 400, apparentPowerVa: Number(power) * 1000, ukPercent: Number(uk),
    material, sectionMm2: Number(section), lengthM, parallel: Number(parallel),
  }) : null;
  return <Panel id="calc-kurzschluss" title="Kurzschlussstrom" norm="Schranken nach cmax 1,05 und cmin 0,95 · SN EN 60228" info={<p>
    Ik max rechnet den Transformator als reine Reaktanz und lässt die Netzimpedanz weg. Das ist eine obere Schranke für das Schaltvermögen, keine IEC-60909-Studie.
    Ik min addiert die warme Schleife aus Aussenleiter und Schutzleiter bei U0 = 230 V. Der Schutzleiter wird mit dem Aussenleiterquerschnitt angenommen.
  </p>}>
    <div className="calc-grid">
      <Sel label="Spannung" value={un} onChange={(value) => setUn(value === "230" ? "230" : "400")} options={[
        { value: "400", label: "400 V Drehstrom" }, { value: "230", label: "230 V Wechselstrom" }]} />
      <Sel label="Transformator" value={power} onChange={setPower} options={TRAFO_KVA.map((kva) => ({ value: String(kva), label: `${kva} kVA` }))} />
      <Sel label="uk" value={uk} onChange={setUk} options={[{ value: "4", label: "4 %" }, { value: "6", label: "6 %" }]} />
      <Sel label="Leiter" value={material} onChange={(value) => {
        const next = value === "al" ? "al" : "cu";
        setMaterial(next);
        if (!sectionsFor(next).includes(Number(section))) setSection(String(sectionsFor(next)[0]));
      }} options={[{ value: "cu", label: "Kupfer" }, { value: "al", label: "Aluminium" }]} />
      <Sel label="Querschnitt" value={section} onChange={setSection} options={sectionOptions(material)} />
      <Num label="Länge" unit="m" value={length} onChange={setLength} />
      <Sel label="Parallele Leiter" value={parallel} onChange={setParallel} options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))} />
    </div>
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "Ik max", value: `${de(result.value.ikMaxA / 1000, 3)} kA` },
        { label: "Ik min", value: `${de(result.value.ikMinA / 1000, 3)} kA` },
        { label: "Zk Trafo", value: `${de(result.value.zkOhm * 1000, 2)} mΩ` },
      ]} />
      <p className="calc-note">{result.value.ikMaxLabel}</p>
      <p className="calc-note">{result.value.ikMinLabel}</p>
      <p className="calc-formula">{un === "400"
        ? `Ik max = 1,05 · 400 V / (√3 · Z) = ${de(result.value.ikMaxA, 0)} A.`
        : `Ik max = 1,05 · 230 V / Z = ${de(result.value.ikMaxA, 0)} A.`} Ik min = 0,95 · 230 V / Z_Schleife = {de(result.value.ikMinA, 0)} A.</p>
    </>}
  </Panel>;
}

function TransformerPanel() {
  const [power, setPower] = useState("250");
  const [u1, setU1] = useState("20000");
  const [u2, setU2] = useState("400");
  const [uk, setUk] = useState("4");
  const [i0, setI0] = useState("1,5");
  const [load, setLoad] = useState("80");
  const values = [required(u1), required(u2), required(uk), required(i0), required(load)];
  const result = values.every((value) => value !== null) ? transformer({
    apparentPowerVa: Number(power) * 1000, primaryV: values[0] ?? 0, secondaryV: values[1] ?? 0,
    ukPercent: values[2] ?? 0, noLoadPercent: values[3] ?? 0, loadPercent: values[4] ?? 0,
  }) : null;
  return <Panel id="calc-trafo" title="Transformator" norm="Bemessung I = S / (√3 · U) · Ik mit c = 1" info={<p>
    Der Kurzschlussstrom gilt für ein starres vorgelagertes Netz. Eine Netzimpedanz des Verteilnetzbetreibers senkt Ik und ist hier nicht enthalten.
  </p>}>
    <div className="calc-grid">
      <Sel label="Nennleistung" value={power} onChange={setPower} options={TRAFO_KVA.map((kva) => ({ value: String(kva), label: `${kva} kVA` }))} />
      <Num label="Primärspannung" unit="V" value={u1} onChange={setU1} />
      <Num label="Sekundärspannung" unit="V" value={u2} onChange={setU2} />
      <Num label="uk" unit="%" value={uk} onChange={setUk} />
      <Num label="Leerlaufstrom" unit="%" value={i0} onChange={setI0} />
      <Num label="Auslastung" unit="%" value={load} onChange={setLoad} />
    </div>
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "I sekundär", value: `${de(result.value.secondaryA, 1)} A` },
        { label: "Ik", value: `${de(result.value.shortCircuitA / 1000, 3)} kA` },
        { label: "Zk", value: `${de(result.value.impedanceOhm * 1000, 2)} mΩ` },
        { label: "Übersetzung", value: `${de(result.value.ratio, 1)} : 1` },
      ]} />
      <p className="calc-note">{result.value.ikLabel} I primär {de(result.value.primaryA, 2)} A, Leerlauf {de(result.value.noLoadA, 2)} A, Laststrom {de(result.value.loadA, 1)} A.</p>
      <p className="calc-formula">I = S / (√3 · U) = {de(result.value.secondaryA, 2)} A. Ik = In · 100 / uk = {de(result.value.shortCircuitA, 1)} A. Zk = uk/100 · U²/S = {de(result.value.impedanceOhm * 1000, 2)} mΩ.</p>
    </>}
  </Panel>;
}

function ReactivePanel() {
  const [power, setPower] = useState("100");
  const [before, setBefore] = useState("0,7");
  const [target, setTarget] = useState("0,95");
  const [un, setUn] = useState<"400" | "230">("400");
  const [phases, setPhases] = useState<PhaseSystem>(3);
  const values = [required(power), required(before), required(target)];
  const result = values.every((value) => value !== null) ? reactiveCompensation({
    activePowerW: (values[0] ?? 0) * 1000, cosBefore: values[1] ?? 0, cosTarget: values[2] ?? 0,
    unV: un === "230" ? 230 : 400, phases,
  }) : null;
  return <Panel id="calc-blind" title="Blindleistung" norm="Qc = P · (tan φ1 − tan φ2)" info={<p>
    Liegt der Ziel-cos φ nicht über dem vorhandenen, ist keine Kondensatorleistung nötig. Der übliche Netzbetreiberwert ist eine Vertragsgrösse, keine NIN-Zahl.
  </p>}>
    <div className="calc-grid">
      <Num label="Wirkleistung" unit="kW" value={power} onChange={setPower} />
      <Num label="cos φ vorhanden" value={before} onChange={setBefore} />
      <Num label="cos φ Ziel" value={target} onChange={setTarget} />
      <Sel label="Spannung" value={un} onChange={(value) => setUn(value === "230" ? "230" : "400")} options={[
        { value: "400", label: "400 V" }, { value: "230", label: "230 V" }]} />
      <Sel label="System" value={String(phases)} onChange={(value) => setPhases(value === "1" ? 1 : 3)} options={[
        { value: "3", label: "Drehstrom" }, { value: "1", label: "Wechselstrom" }]} />
    </div>
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "Qc", value: `${de(result.value.kvar, 1)} kvar` },
        { label: "Strom vorher", value: `${de(result.value.beforeA, 1)} A` },
        { label: "Strom nachher", value: `${de(result.value.afterA, 1)} A` },
        { label: "S vorher", value: `${de(result.value.beforeVa / 1000, 1)} kVA` },
      ]} />
      <p className="calc-formula">{result.value.kvar === 0
        ? "Ziel-cos φ ist nicht höher. Qc = 0."
        : `Qc = P · (tan φ1 − tan φ2) = ${de(result.value.kvar, 2)} kvar.`}</p>
    </>}
  </Panel>;
}

function OhmPanel() {
  const [voltage, setVoltage] = useState("230");
  const [current, setCurrent] = useState("");
  const [resistance, setResistance] = useState("10");
  const [acVoltage, setAcVoltage] = useState("400");
  const [acCurrent, setAcCurrent] = useState("16");
  const [cosPhi, setCosPhi] = useState("0,9");
  const [phases, setPhases] = useState<PhaseSystem>(3);
  const dc = ohmsDc({
    voltageV: required(voltage) ?? undefined,
    currentA: required(current) ?? undefined,
    resistanceOhm: required(resistance) ?? undefined,
  });
  const acValues = [required(acVoltage), required(acCurrent), required(cosPhi)];
  const ac = acValues.every((value) => value !== null)
    ? ohmsAc({ phases, voltageV: acValues[0] ?? 0, currentA: acValues[1] ?? 0, cosPhi: acValues[2] ?? 0 })
    : null;
  return <Panel id="calc-ohm" title="Ohmsches Gesetz" norm="Gleichstrom U = R · I · Wechselstrom S, P und Q" info={<p>
    Gleichstrom braucht zwei der drei Grössen. Wechselstrom: dreiphasig S = √3 · U · I, einphasig S = U · I, P = S · cos φ, Q = √(S² − P²).
  </p>}>
    <h3>Gleichstrom</h3>
    <div className="calc-grid">
      <Num label="Spannung" unit="V" value={voltage} onChange={setVoltage} />
      <Num label="Strom" unit="A" value={current} onChange={setCurrent} />
      <Num label="Widerstand" unit="Ω" value={resistance} onChange={setResistance} />
    </div>
    {!dc.ok && <Missing text={dc.message} />}
    {dc.ok && <p className="calc-formula">U = R · I = {de(dc.value.voltageV, 3)} V, I = {de(dc.value.currentA, 3)} A, R = {de(dc.value.resistanceOhm, 3)} Ω, P = {de(dc.value.powerW, 2)} W.</p>}
    <h3>Wechselstrom</h3>
    <div className="calc-grid">
      <Sel label="System" value={String(phases)} onChange={(value) => setPhases(value === "1" ? 1 : 3)} options={[
        { value: "3", label: "Drehstrom" }, { value: "1", label: "Wechselstrom" }]} />
      <Num label="Spannung" unit="V" value={acVoltage} onChange={setAcVoltage} />
      <Num label="Strom" unit="A" value={acCurrent} onChange={setAcCurrent} />
      <Num label="cos φ" value={cosPhi} onChange={setCosPhi} />
    </div>
    {ac === null && <Missing text="Eingabe unvollständig." />}
    {ac && !ac.ok && <Missing text={ac.message} />}
    {ac?.ok && <p className="calc-formula">S = {phases === 3 ? "√3 · U · I" : "U · I"} = {de(ac.value.apparentVa, 1)} VA, P = {de(ac.value.activeW, 1)} W, Q = {de(ac.value.reactiveVar, 1)} var, φ = {de(ac.value.angleDeg, 1)}°.</p>}
  </Panel>;
}

function BondingPanel() {
  const [phase, setPhase] = useState("16");
  const [pen, setPen] = useState("16");
  const [lps, setLps] = useState(false);
  const result = equipotential({ phaseMm2: Number(phase), penMm2: Number(pen), lightningProtection: lps });
  const options = PHASE_CSA.map((section) => ({ value: String(section), label: `${section} mm²` }));
  return <Panel id="calc-pa" title="Potenzialausgleich" norm="NIN 5.4.4 · NIN 5.4.3" info={<p>
    Hauptpotenzialausgleich aus dem Aussenleiter: 4–10 mm² ergibt 6 mm², 16–35 mm² ergibt 10 mm², ab 50 mm² 16 mm² Kupfer.
    Mit Blitzschutzanlage mindestens 10 mm², in der Regel höchstens 16 mm². Der örtliche Potenzialausgleich ist der aufgerundete halbe Schutzleiter, mindestens 4 mm², und übernimmt das Blitzschutz-Minimum nicht.
  </p>}>
    <div className="calc-grid">
      <Sel label="Aussenleiter" value={phase} onChange={setPhase} options={options} />
      <Sel label="PEN / PE vorhanden" value={pen} onChange={setPen} options={options} />
      <label className="calc-check"><input type="checkbox" checked={lps} onChange={(event) => setLps(event.target.checked)} /> Blitzschutzanlage</label>
    </div>
    {result.ok && <>
      <Kpis items={[
        { label: "HPA", value: `${result.value.hpaMm2} mm²`, tone: result.value.penTooSmall ? "warn" : "ok" },
        { label: "PE mindestens", value: `${result.value.peMm2} mm²` },
        { label: "ÖPA", value: `${result.value.opaMm2} mm²` },
      ]} />
      <p className={result.value.penTooSmall ? "calc-status is-warn" : "calc-status is-ok"}>
        {result.value.penTooSmall
          ? `Der vorhandene PEN liegt unter dem Mindest-Schutzleiter von ${result.value.peMm2} mm².`
          : "PEN deckt den Mindest-Schutzleiter. ÖPA ist vom Blitzschutz-Minimum unabhängig."}
      </p>
    </>}
  </Panel>;
}

function MotorPanel() {
  const powers = Object.keys(IE3_4POLE_ETA);
  const [preset, setPreset] = useState("4");
  const [power, setPower] = useState("4");
  const [cosPhi, setCosPhi] = useState("0,86");
  const [eta, setEta] = useState("0,886");
  const [start, setStart] = useState<StartKind>("direct");
  const [insulation, setInsulation] = useState<Insulation>("PVC");
  const [method, setMethod] = useState<InstallMethod>("B2");
  const powerKw = required(power);
  const cos = required(cosPhi);
  const efficiency = required(eta);
  const result = powerKw !== null && cos !== null && efficiency !== null
    ? motor({ powerW: powerKw * 1000, cosPhi: cos, eta: efficiency, start, insulation, method })
    : null;
  return <Panel id="calc-motor" title="Motoranlauf" norm="NIN 5.2.3 · Iz ≥ In" info={<p>
    Der Nennstrom gilt für 400 V. Die Anlauffaktoren sind feste Planwerte, kein Typenschild: Direktanlauf 6, Stern-Dreieck 2, Sanftanlauf 3, Frequenzumrichter 1,2.
    η aus der Normleistungs-Liste ist ein IE3-Wert für 4-polige Motoren nach IEC 60034-30-1 und soll durch den Typenschildwert ersetzt werden.
  </p>}>
    <p className="calc-factors">Direktanlauf 6 · Stern-Dreieck 2 · Sanftanlauf 3 · Frequenzumrichter 1,2</p>
    <div className="calc-grid">
      <Sel label="Normleistung" value={preset} onChange={(value) => {
        setPreset(value);
        if (value !== "custom") {
          setPower(value);
          setEta(String(IE3_4POLE_ETA[Number(value)]));
        }
      }} options={[...powers.map((value) => ({ value, label: `${value} kW` })), { value: "custom", label: "eigene Leistung" }]} />
      <Num label="Leistung" unit="kW" value={power} onChange={(value) => { setPower(value); setPreset("custom"); }} />
      <Num label="cos φ" value={cosPhi} onChange={setCosPhi} />
      <Num label="Wirkungsgrad η" value={eta} onChange={setEta} />
      <Sel label="Anlauf" value={start} onChange={(value) => setStart(value as StartKind)} options={[
        { value: "direct", label: "Direktanlauf · 6" }, { value: "star", label: "Stern-Dreieck · 2" },
        { value: "soft", label: "Sanftanlauf · 3" }, { value: "vfd", label: "Frequenzumrichter · 1,2" }]} />
      <Sel label="Isolation" value={insulation} onChange={(value) => setInsulation(value === "XLPE" ? "XLPE" : "PVC")} options={[
        { value: "PVC", label: "PVC" }, { value: "XLPE", label: "XLPE" }]} />
      <Sel label="Verlegeart" value={method} onChange={(value) => setMethod(value as InstallMethod)} options={["B1", "B2", "C", "D", "E"].map((value) => ({ value, label: value }))} />
    </div>
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "In", value: `${de(result.value.currentA, 1)} A` },
        { label: "Anlaufstrom", value: `${de(result.value.startA, 1)} A` },
        { label: "Faktor", value: de(result.value.factor, 1) },
        { label: "Querschnitt", value: result.value.section ? `${result.value.section.sectionMm2} mm²` : "über 300 mm²" },
      ]} />
      <p className="calc-formula">In = P / (√3 · 400 V · cos φ · η) = {de(result.value.currentA, 2)} A. Anlauf = {de(result.value.factor, 1)} · In.</p>
      <p className={result.value.section && result.value.section.izA >= result.value.currentA ? "calc-status is-ok" : "calc-status is-warn"}>
        {result.value.section
          ? `Iz = ${de(result.value.section.izA, 1)} A ≥ In. Kupfer, drei belastete Adern, ${insulation}, Verlegeart ${method}.`
          : "Kein Querschnitt bis 300 mm² erreicht Iz ≥ In."}
      </p>
    </>}
  </Panel>;
}

function ChargePanel() {
  const [haus, setHaus] = useState("125");
  const [grid, setGrid] = useState("63");
  const [count, setCount] = useState("4");
  const [option, setOption] = useState("11");
  const [management, setManagement] = useState<"none" | "static">("none");
  const [siaClass, setSiaClass] = useState<SiaClass>("bewohner");
  const [share, setShare] = useState(70);
  const [connection, setConnection] = useState<ConnectionPoint>("haus");
  const [reserve, setReserve] = useState("0");
  const [pv, setPv] = useState("");
  const [battery, setBattery] = useState("");
  const [hours, setHours] = useState("8");
  const chosen = CHARGE_OPTIONS.find((item) => item.id === option) ?? CHARGE_OPTIONS[2];
  const countN = required(count);
  const result = countN !== null ? chargeInstallation({
    count: countN, kwEach: chosen.kw, phases: chosen.phases, management, siaClass, share: share / 100,
    hausA: Number(haus), gridA: Number(grid), connection,
    reserveKw: optional(reserve), pvKwp: optional(pv), batteryKwh: optional(battery), batteryHours: optional(hours),
  }) : null;
  const fuses = SERVICE_FUSE_A.map((amps) => ({ value: String(amps), label: `${amps} A` }));
  const upstream = Math.min(Number(haus), Number(grid));
  return <Panel id="calc-emob" title="E-Mobilität" norm="NIN 7.22 · SIA 2060 als Näherung" info={<p>
    Ohne Lastmanagement ist k = 1: jede Station kann mit Nennleistung laden. Mit statischem Lastmanagement stammt k aus wenigen veröffentlichten Beispielwerten und ist als Näherung gekennzeichnet.
    3,7 kW und 7,4 kW sind einphasig, 11 kW und 22 kW sind dreiphasig. PV rechnet mit der Annahme 0,7 · kWp, der Speicher mit kWh je Betriebsstunde.
  </p>}>
    <div className="calc-grid">
      <Sel label="Hausanschluss" value={haus} onChange={setHaus} options={fuses} />
      <Sel label="Grid" value={grid} onChange={setGrid} options={fuses} />
      <Num label="Ladepunkte" value={count} onChange={setCount} />
      <Sel label="Ladeleistung" value={option} onChange={setOption} options={CHARGE_OPTIONS.map((item) => ({ value: item.id, label: item.label }))} />
      <Sel label="Lastmanagement" value={management} onChange={(value) => setManagement(value === "static" ? "static" : "none")} options={[
        { value: "none", label: "Keines · k = 1" }, { value: "static", label: "Statisch" }]} />
      <Sel label="Anschluss von PV und Speicher" value={connection} onChange={(value) => setConnection(value === "grid" ? "grid" : "haus")} options={[
        { value: "haus", label: "am Hausanschluss" }, { value: "grid", label: "am Grid" }]} />
      {management === "static" && <Sel label="Gleichzeitigkeit" value={siaClass} onChange={(value) => setSiaClass(value as SiaClass)} options={[
        { value: "bewohner", label: "Bewohner, Näherung" }, { value: "beschaeftigte", label: "Beschäftigte, Näherung" },
        { value: "besucher", label: "Besucher, 11 kW" }, { value: "share", label: "eigener Anteil" }]} />}
      <Num label="Reserve" unit="kW" value={reserve} onChange={setReserve} />
      <Num label="Photovoltaik" unit="kWp" value={pv} onChange={setPv} />
      <Num label="Batterie" unit="kWh" value={battery} onChange={setBattery} />
      <Num label="Speicherstunden" unit="h" value={hours} onChange={setHours} />
    </div>
    {management === "static" && siaClass === "share" && <label className="field">Gleichzeitiger Anteil
      <input type="range" min={0} max={100} value={share} onChange={(event) => setShare(Number(event.target.value))} />
      <span>{share} %</span>
    </label>}
    {result === null && <Missing text="Anzahl Ladepunkte prüfen." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "Faktor k", value: de(result.value.k, 2), tone: result.value.tone },
        { label: "Leistung", value: `${de(result.value.powerKw, 1)} kW` },
        { label: "Verfügbar", value: `${de(result.value.availableKw, 1)} kW` },
        { label: "Auslastung", value: Number.isFinite(result.value.utilization) ? `${de(result.value.utilization, 0)} %` : "> 999 %", tone: result.value.tone },
      ]} />
      <LimitBar percent={Math.min(result.value.utilization, 100)} tone={result.value.tone}
        label={`Auslastung ${de(result.value.utilization, 0)} Prozent`} />
      <p className="calc-formula">P = Σ P_LP · k = {countN} · {de(chosen.kw, 1)} kW · {de(result.value.k, 2)} = {de(result.value.powerKw, 2)} kW. {result.value.factorNote}</p>
      <p className="calc-note">Strom je Station {de(result.value.stationA, 1)} A ({chosen.phases === 1 ? "230 V, eine Phase" : "400 V, drei Phasen"}).
        Stärkster Aussenleiter {de(result.value.strongestPhaseA, 1)} A. Schutz je Punkt {result.value.deviceA ?? "> 125"} A nach Nennstrom.</p>
    </>}
    <ChargeSingleLine hausA={Number(haus)} gridA={Number(grid)} connection={connection} count={countN ?? 0}
      kw={chosen.kw} phases={chosen.phases} pv={optional(pv) > 0} battery={optional(battery) > 0} />
    <SelectivitySketch upstreamA={upstream} downstreamA={result?.ok ? result.value.deviceA : null} />
  </Panel>;
}

function LightingPanel() {
  const [illuminance, setIlluminance] = useState("500");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("6");
  const [height, setHeight] = useState("3");
  const [plane, setPlane] = useState("0,8");
  const [flux, setFlux] = useState("4000");
  const [eta, setEta] = useState("0,6");
  const [maintenance, setMaintenance] = useState("0,8");
  const [luminaire, setLuminaire] = useState("32");
  const values = [required(illuminance), required(length), required(width), required(height), required(plane), required(flux), required(eta), required(maintenance)];
  const power = required(luminaire);
  const result = values.every((value) => value !== null) ? lighting({
    illuminanceLux: values[0] ?? 0, lengthM: values[1] ?? 0, widthM: values[2] ?? 0, heightM: values[3] ?? 0,
    workplaneM: values[4] ?? 0, fluxLm: values[5] ?? 0, eta: values[6] ?? 0, maintenance: values[7] ?? 0,
    luminairePowerW: power,
  }) : null;
  return <Panel id="calc-licht" title="Beleuchtung" norm="Wirkungsgradmethode, η vereinfacht" info={<p>
    Die Leuchtenzahl ist n = ceil(E · A / (Φ · η · MF)). η ist ein vereinfachter Raumwirkungsgrad und keine LiTG-Tabelle.
    Der Strom gilt nur für 230 V einphasig und nur, wenn eine Leuchtenleistung eingetragen ist.
  </p>}>
    <div className="calc-grid">
      <Num label="Beleuchtungsstärke" unit="lx" value={illuminance} onChange={setIlluminance} />
      <Num label="Länge" unit="m" value={length} onChange={setLength} />
      <Num label="Breite" unit="m" value={width} onChange={setWidth} />
      <Num label="Raumhöhe" unit="m" value={height} onChange={setHeight} />
      <Num label="Nutzebene" unit="m" value={plane} onChange={setPlane} />
      <Num label="Lichtstrom je Leuchte" unit="lm" value={flux} onChange={setFlux} />
      <Num label="η vereinfacht" value={eta} onChange={setEta} />
      <Num label="Wartungsfaktor" value={maintenance} onChange={setMaintenance} />
      <Num label="Leistung je Leuchte" unit="W" value={luminaire} onChange={setLuminaire} />
    </div>
    {result === null && <Missing text="Eingabe unvollständig." />}
    {result && !result.ok && <Missing text={result.message} />}
    {result?.ok && <>
      <Kpis items={[
        { label: "Leuchten", value: String(result.value.count) },
        { label: "Raumindex k", value: de(result.value.roomIndex, 2) },
        { label: "Fläche", value: `${de(result.value.areaM2, 1)} m²` },
        { label: "Strom 230 V, 1~", value: result.value.currentA === null ? "—" : `${de(result.value.currentA, 1)} A` },
      ]} />
      <p className="calc-formula">n = ceil({values[0]} lx · {de(result.value.areaM2, 2)} m² / ({values[5]} lm · {de(values[6] ?? 0, 2)} · {de(values[7] ?? 0, 2)})) = {result.value.count}</p>
      <p className="calc-note">k = A / (hm · (L + W)) = {de(result.value.roomIndex, 3)}. η ist keine LiTG-Tabelle. Der Strom ist einphasig bei 230 V.</p>
    </>}
  </Panel>;
}

export default function Berechnungen({ onHome }: ToolProps) {
  const [tab, setTab] = useState<Tab>("spannungsfall");
  const [pdfNote, setPdfNote] = useState(false);
  return <div className="calc-tool">
    <ToolHeader title="Berechnungen" onHome={onHome}>
      <button type="button" className="btn" onClick={() => setPdfNote(true)}>PDF</button>
    </ToolHeader>
    <div className="calc-body">
      {pdfNote && <p className="calc-pdf-note" role="status">PDF-Export folgt. Der Kopf soll das Logo der edeco ag und das Datum tragen. In diesem Stand wird noch keine Datei erzeugt.</p>}
      <div className="calc-layout">
        <nav className="calc-nav" aria-label="Rechner">
          {TABS.map((item) => <button type="button" key={item.id} className={tab === item.id ? "btn is-on" : "btn"}
            aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>
        {tab === "spannungsfall" && <VoltageDropPanel />}
        {tab === "verlust" && <LossPanel />}
        {tab === "kurzschluss" && <ShortCircuitPanel />}
        {tab === "trafo" && <TransformerPanel />}
        {tab === "blind" && <ReactivePanel />}
        {tab === "ohm" && <OhmPanel />}
        {tab === "pa" && <BondingPanel />}
        {tab === "motor" && <MotorPanel />}
        {tab === "emob" && <ChargePanel />}
        {tab === "licht" && <LightingPanel />}
      </div>
    </div>
  </div>;
}
