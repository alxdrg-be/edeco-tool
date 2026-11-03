export interface MemoryVariable { symbol: string; label: string; unit: string }
export interface MemoryEntry {
  id: string;
  title: string;
  kind: "formula" | "reference" | "diagram";
  formula?: string;
  variables?: MemoryVariable[];
  explanation?: string;
  paragraphs?: string[];
  conditions?: string[];
  calculatorFormulaId?: string;
  diagram?: "ohm" | "power-triangle" | "dc-ac" | "resistors" | "ip-code";
  table?: { headers: string[]; rows: string[][]; note?: string };
  source: { page?: number; section?: string; label?: string };
  confidence: "verified" | "needs-review";
  sourceTranscription?: string;
  correction?: string;
  referenceValues?: { quantity: string; sourceValue: string }[];
  audit?: { sourceReadability: string; mathematicalReview: string; normativeValidation: string };
}
export interface MemoryTopic {
  id: string;
  title: string;
  summary?: string;
  pages: number[];
  entries: MemoryEntry[];
  group?: "basics" | "formulas" | "reference";
}
export interface MemoryCatalog {
  source?: { file?: string; sha256?: string; edition?: string };
  completeness: { totalPages: number; inventoriedPages: number[]; notes?: string[] };
  topics: MemoryTopic[];
  findings?: { id: string; page: number; severity: string; message: string }[];
}
