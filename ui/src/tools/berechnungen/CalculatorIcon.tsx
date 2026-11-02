import {
  Activity, AlarmSmoke, Banknote, BookOpen, Cable, Calculator, CarFront,
  ChartNoAxesCombined, CircuitBoard, CircleGauge, Cog, EthernetPort, Flame,
  FolderArchive, Network, Omega, ParkingSquare, Router, ShieldCheck, Split,
  Sun, Thermometer, ToggleLeft, Truck, UtilityPole, Zap, Lightbulb, Layers,
  type LucideIcon,
} from "lucide-react";

/** Separate identities keep related calculators distinguishable in dense lists. */
export const CALCULATOR_ICONS: Readonly<Record<string, LucideIcon>> = {
  berechnungen: Calculator,
  "wissens-hub": BookOpen,
  berechnungsablage: FolderArchive,
  blitzschutz: ShieldCheck,
  kabelberechnung: Cable,
  "nin-kabelrechner": UtilityPole,
  strombelastbarkeit: CircleGauge,
  kurzschlussstrom: Zap,
  "ls-schalter": ToggleLeft,
  potenzialausgleich: Layers,
  transformator: CircuitBoard,
  motoranlauf: Cog,
  blindleistung: Activity,
  verlustleistung: Thermometer,
  "ohmsches-gesetz": Omega,
  beleuchtung: Lightbulb,
  "pva-rechner": Sun,
  emobilitaet: CarFront,
  brandlast: Flame,
  poe: EthernetPort,
  "premium-pkw": ParkingSquare,
  "premium-lkw": Truck,
  "premium-brandmelder": AlarmSmoke,
  "premium-selektivitaet": Split,
  "premium-ladekosten": Banknote,
  "premium-sia2056": ChartNoAxesCombined,
  "premium-poe": Router,
  "premium-brandlast": FolderArchive,
  netzplaner: Network,
};

export default function CalculatorIcon({ id, size = 25 }: { id: string; size?: number }) {
  const Icon = CALCULATOR_ICONS[id] ?? Calculator;
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}
