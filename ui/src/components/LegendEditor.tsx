import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";
import { api, Category, CompanySymbolLook, FamilyItem, GeneralInfo, LegendInfo, LegendLayout, LegendPrim, ProjectDetail, StencilData, StencilEntry, SymbolRender } from "../api";
import { exportDiagnostic } from "../diagnostics";
import InfoTip from "./InfoTip";
import {
  addBlock,
  addItem,
  beginSave,
  blockForCategory,
  commit,
  combineItems,
  coveredRows,
  describe,
  entryText,
  duplicateItems,
  hideCovered,
  History,
  historyOf,
  inLegend,
  insertItem,
  isCurrentSave,
  LegendBlock,
  GeneralSection,
  LegendDoc,
  LegendItem,
  LineStyle,
  missingRows,
  moveBlockInOrder,
  moveItemInOrder,
  moveItemTo,
  moveItemToBlock,
  companyKey,
  makeItem,
  placeInCell,
  push,
  redo,
  removeBlock,
  removeItem,
  replace,
  rotateItem,
  SectionStyle,
  splitItem,
  detachPart,
  LegendPart,
  updatePart,
  Selection,
  staleItems,
  symbolRequestKey,
  undo,
  updateBlock,
  updateItem,
  updateSectionStyle,
} from "../legend";
import { Icon, TrashIcon } from "./Icons";
import { SaveSession } from "../saveSession";
import { useNavigation } from "../Navigation";
import Menu from "./Menu";
import { ArrowLeft, ChevronDown, Hand, Maximize2, Minimize2, Minus, Plus, SlidersHorizontal } from "lucide-react";
import "./LegendSection.css";
import { a4CompactLegendDocument, alignLegendSectionColors, compactLegendDocument, legendItemColors, legendLayerColors, legendVisibleItemColors, legendVisibleLayerColors, type LayerColorSource } from "../legendViewport";
import { useLegendViewport } from "../useLegendViewport";
import LegendScopePanel from "./LegendScopePanel";
import LegendTextPanel from "./LegendTextPanel";
import LegendVariantPanel from "./LegendVariantPanel";
import LegendPalettePanel from "./LegendPalettePanel";
import LegendPresentationPanel from "./LegendPresentationPanel";
import LegendDefaultsPanel from "./LegendDefaultsPanel";
import { stageToolHandoff } from "../toolbox/toolHandoff";
import { legendSourceSelection } from "../legendSourceSelection";
import "./LegendEditor.css";

interface Props {
  projectId: string;
  data: ProjectDetail;
  categories: Category[];
  notify: (text: string, error?: boolean) => void;
  /** The named legend to edit; null opens the first legend of the project. */
  legendId?: number | null;
  onProjects?: () => void;
  onOpenTool?: (toolId: string) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const DASH: Record<LineStyle, string> = { solid: "", dashed: "2 1.2", dotted: "0.2 1", dashdot: "2 0.8 0.2 0.8" };
const LINE_LABEL: Record<LineStyle, string> = { solid: "durchgezogen", dashed: "gestrichelt", dotted: "punktiert", dashdot: "Strich-Punkt" };
const FREE_TEXT_HINT = "Freier Text ist ein Zusatztext in der Legende, kein Apparat. Er sitzt im Raster wie ein Eintrag und nutzt die gemeinsame Schriftgrösse.";
const GRID_KEY = "nl.legend.grid";

/** What is being dragged: an entry of the legend or a new symbol from the left lists. */
type DragPayload =
  | { type: "move"; block: string; item: string }
  | { type: "add"; family_key: string | null; symbol_key: string; text: string; categories: string[] };
/** Where it lands: in front of `before` in `block` (null: at the end). */
type DropTarget = { block: string; before: string | null; cell?: number };
/** Id of the entry a drop preview shows for a new symbol from the lists. */
const DROP_ID = "__drop__";

const BAR_KEY = "nl.legend.toolbar";
/** What the toolbar of the legend editor can show; each computer chooses (Ansicht ▾). */
const TOOLBAR_ITEMS = [
  { id: "history", label: "Neuer Vorschlag, Rückgängig" },
  { id: "insert", label: "Einfügen" },
  { id: "grid", label: "Raster" },
  { id: "rows", label: "Zeile und Text (mm)" },
  { id: "columns", label: "Spalten" },
  { id: "sizes", label: "Schrift, Symbole, gleiche Fläche" },
  { id: "general", label: "Allgemeinteil ein/aus" },
  { id: "gridlines", label: "Raster anzeigen" },
  { id: "export", label: "DXF herunterladen" },
] as const;
const TOOLBAR_DEFAULT = ["history", "insert", "columns", "general", "gridlines", "export"];

function readBarPref(): Set<string> {
  try {
    const raw = window.localStorage.getItem(BAR_KEY);
    const list = raw ? JSON.parse(raw) : null;
    if (Array.isArray(list)) return new Set(list.filter((x) => typeof x === "string"));
  } catch {
    /* default */
  }
  return new Set(TOOLBAR_DEFAULT);
}

function readGridPref(): boolean {
  try {
    // on, until this computer switches it off
    return window.localStorage.getItem(GRID_KEY) !== "0";
  } catch {
    return true;
  }
}

const PANE_KEY = "nl.legend.panes";
const PANE_LIMITS = { outline: [180, 520], props: [240, 560] } as const;

/** Widths of the side panels, as the user dragged them (per computer). */
function readPanes(): { outline: number; props: number } {
  try {
    const v = JSON.parse(window.localStorage.getItem(PANE_KEY) || "{}");
    return { outline: Number(v.outline) || 210, props: Number(v.props) || 280 };
  } catch {
    return { outline: 210, props: 280 };
  }
}

export default function LegendEditor({ projectId, data, categories, notify, legendId = null, onProjects, onOpenTool }: Props) {
  const [hist, setHist] = useState<History<LegendDoc> | null>(null);
  const [info, setInfo] = useState<LegendInfo | null>(null);
  const [placed, setPlaced] = useState<LegendLayout | null>(null);
  const [general, setGeneral] = useState<(GeneralInfo & { svg: string; prims: LegendPrim[] }) | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedInfo, setSavedInfo] = useState("");
  const [sel, setSel] = useState<Selection>(null);
  // a second entry chosen with Ctrl/Shift+click: it can be combined with the selected one
  const [pick, setPick] = useState<{ block: string; item: string } | null>(null);
  const selectOnSheet = useCallback((s: Selection, add?: boolean) => {
    setSel((cur) => {
      if (add && s?.type === "item" && cur?.type === "item" && cur.item !== s.item) {
        setPick({ block: s.block, item: s.item });
        return cur;
      }
      setPick(null);
      return s;
    });
  }, []);
  const [generalRev, setGeneralRev] = useState(0);
  const [symbols, setSymbols] = useState<Record<string, SymbolRender>>({});
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FamilyItem[]>([]);
  const [exportBlock, setExportBlock] = useState("");

  const [showGrid, setShowGrid] = useState(readGridPref);
  const [panes, setPanes] = useState(readPanes);

  /** Drag the border of a side panel, like a pane in the Explorer. Double click: back to the default. */
  function startPaneDrag(e: ReactPointerEvent, which: "outline" | "props") {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = panes[which];
    const [lo, hi] = PANE_LIMITS[which];
    let latest = panes;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const w = Math.round(Math.max(lo, Math.min(hi, which === "outline" ? w0 + dx : w0 - dx)));
      latest = { ...latest, [which]: w };
      setPanes(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("pane-resizing");
      try {
        window.localStorage.setItem(PANE_KEY, JSON.stringify(latest));
      } catch {
        /* only a convenience */
      }
    };
    document.body.classList.add("pane-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function resetPane(which: "outline" | "props") {
    const next = { ...panes, [which]: which === "outline" ? 240 : 280 };
    setPanes(next);
    try {
      window.localStorage.setItem(PANE_KEY, JSON.stringify(next));
    } catch {
      /* only a convenience */
    }
  }
  const [detached, setDetached] = useState(false);
  const [windowed, setWindowed] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [grayscale, setGrayscale] = useState(false);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [originalEdit, setOriginalEdit] = useState("");
  // sections opened in the list on the left (one line per section until opened)
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string) => setOpenBlocks((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const [bar, setBar] = useState<Set<string>>(readBarPref);
  const saveBar = (next: Set<string>) => {
    setBar(next);
    try {
      window.localStorage.setItem(BAR_KEY, JSON.stringify([...next]));
    } catch {
      /* only a convenience */
    }
  };
  const toggleBar = (id: string) => {
    const next = new Set(bar);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveBar(next);
  };
  const [dropAt, setDropAt] = useState<DropTarget | null>(null);
  // while dragging onto a cell: the legend as it would look after the drop (others make room)
  const [preview, setPreview] = useState<{ layout: LegendLayout; id: string } | null>(null);
  const paperRef = useRef<SVGSVGElement>(null);
  const [exporting, setExporting] = useState(false);
  const dragPayload = useRef<DragPayload | null>(null);
  const sheetDrag = useRef<{ block: string; item: string; x: number; y: number; active: boolean } | null>(null);
  const justDragged = useRef(false);
  // one save session per legend: writes always go to the legend that was edited
  const [saveSession] = useState(() => new SaveSession(projectId, (pid: string, d: LegendDoc) => api.saveLegend(pid, d, undefined, legendId)));
  const { register } = useNavigation();
  const layoutGate = useRef({ generation: 0 });
  const fieldBefore = useRef<LegendDoc | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewLayout = dropAt?.cell !== undefined && preview ? preview.layout : placed;
  const viewport = useLegendViewport(canvasRef, paperRef, viewLayout?.width ?? 200, viewLayout?.height ?? 100, Boolean(info && hist));
  const { zoom } = viewport;

  useEffect(() => {
    const editor = editorRef.current;
    if (!windowed || !editor) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep the project/header behind the enlarged editor out of keyboard navigation.
    const changed: { node: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = editor;
    while (branch.parentElement) {
      for (const child of branch.parentElement.children) {
        if (child === branch || !(child instanceof HTMLElement) || child.classList.contains("legend-window-back")) continue;
        changed.push({ node: child, inert: child.inert }); child.inert = true;
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const controls = () => [...editor.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']")].filter(node => node.getClientRects().length > 0);
    (controls()[0] ?? editor).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = controls(), first = nodes[0] ?? editor, last = nodes[nodes.length - 1] ?? editor;
      if (!editor.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = oldOverflow;
      changed.forEach(({ node, inert }) => { node.inert = inert; });
      document.removeEventListener("keydown", trap);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [windowed]);

  const doc = hist?.present ?? null;
  const colorByCat = useMemo(() => Object.fromEntries(data.category_colors.map((c) => [c.id, c.color])), [data.category_colors]);
  const layerByCat = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.layer ?? ""])), [categories]);
  const catTitle = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.title])), [categories]);
  const catParent = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.parent ?? null])), [categories]);
  /** A group and its sections up to the top: an entry of «UKV» goes to «UKV» if the legend
   *  has that section, else to «Kommunikation». */
  const lineage = useCallback((id: string): string[] => {
    const out = [id];
    while (catParent[out[out.length - 1]] && !out.includes(catParent[out[out.length - 1]]!)) out.push(catParent[out[out.length - 1]]!);
    return out;
  }, [catParent]);
  const descriptions = info?.descriptions ?? {};
  // the general part belongs to the legend: a themed legend (only UKV) goes without it
  const exportGeneral = doc?.general_on !== false;
  const setExportGeneral = (on: boolean) => {
    if (doc) change({ ...doc, general_on: on });
  };
  const stencilNames = info?.stencil_names ?? {};
  const companySymbols = info?.company_symbols ?? {};
  /** Size, turn and mirror a company symbol brings along when it is added. */
  const look = (familyKey: string | null | undefined): Partial<LegendItem> => {
    const saved = familyKey ? companySymbols[familyKey] : undefined;
    return saved ? { symbol_factor: saved.symbol_factor, rotation: saved.rotation, mirror: saved.mirror } : {};
  };
  // your Nova user stencil: loaded once per editor, one tab open at a time
  const [stencil, setStencil] = useState<StencilData | null>(null);
  const [stencilTab, setStencilTab] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.stencils(projectId).then((r) => alive && setStencil(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [projectId]);
  const openStencilEntries = useMemo(() => {
    if (!stencil || !stencilTab) return [];
    const [si, ti] = stencilTab.split(":").map(Number);
    return stencil.sets[si]?.tabs[ti]?.entries ?? [];
  }, [stencil, stencilTab]);

  // -- load, general part, save ------------------------------------------------------------

  useEffect(() => {
    let alive = true;
    setInfo(null);
    api
      .legend(projectId, legendId)
      .then((r) => {
        if (!alive) return;
        setInfo(r);
        if (r.legend) {
          saveSession.initialize(r.legend.doc);
          // entries the general part already shows: hidden (one undo step), not deleted
          const hidden = hideCovered(r.legend.doc, r.in_general);
          setHist(hidden === r.legend.doc ? historyOf(r.legend.doc) : push(historyOf(r.legend.doc), hidden));
          if (hidden !== r.legend.doc) {
            const n = hidden.blocks.flatMap((b) => b.items).filter((it) => it.hidden).length - r.legend.doc.blocks.flatMap((b) => b.items).filter((it) => it.hidden).length;
            notify(`${n} Einträge ausgeblendet: Der Allgemeinteil zeigt sie schon. Rückgängig mit Strg+Z.`);
          }
          setSavedInfo(`${formatStamp(r.legend.updated_at)} von ${r.legend.updated_by}`);
        } else {
          saveSession.initialize(null);
          setHist(null);
        }
      })
      .catch((e) => alive && notify((e as Error).message, true));
    api
      .legendGeneral(projectId)
      .then((g) => alive && setGeneral(g))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [projectId, legendId, notify, saveSession]);

  // Register the latest rendered edit before navigation events can flush it.
  useLayoutEffect(() => { saveSession.update(doc); }, [doc, saveSession]);

  const saveNow = useCallback(async (): Promise<void> => {
    if (!saveSession.dirty) return;
    setSaveState("saving");
    try {
      await saveSession.flush();
      const r = saveSession.result;
      setSaveState("saved");
      if (r) setSavedInfo(`${formatStamp(r.legend.updated_at)} von ${r.legend.updated_by}`);
    } catch (e) {
      setSaveState("error");
      notify(`Legende nicht gespeichert: ${(e as Error).message}. Bitte erneut versuchen; deine Änderungen bleiben im Editor.`, true);
      throw e;
    }
  }, [notify, saveSession]);

  const saveLegend = useCallback(async () => {
    if (!saveSession.dirty) {
      notify("Die Legende ist bereits gespeichert.");
      return;
    }
    try {
      await saveNow();
      notify("Legende gespeichert.");
    } catch {
      /* saveNow already reported the error */
    }
  }, [notify, saveNow, saveSession]);

  useEffect(() => register({ flush: saveNow, dirty: () => saveSession.dirty }), [register, saveNow, saveSession]);

  useEffect(() => {
    if (!saveSession.dirty) return;
    setSaveState("saving");
    const handle = window.setTimeout(() => { saveNow().catch(() => undefined); }, 700);
    return () => window.clearTimeout(handle);
  }, [doc, saveNow, saveSession]);

  // layout from the backend (same code as the DXF export)
  useEffect(() => {
    if (!doc) return;
    const ctrl = new AbortController();
    const handle = window.setTimeout(() => {
      const generation = beginSave(layoutGate.current);
      setLayoutBusy(true);
      api
        .layoutLegend(projectId, doc, ctrl.signal)
        .then((r) => isCurrentSave(layoutGate.current, generation) && setPlaced(r))
        .catch(error => { if (!ctrl.signal.aborted && isCurrentSave(layoutGate.current, generation)) notify(`Vorschau nicht aktualisiert: ${(error as Error).message}`, true); })
        .finally(() => { if (isCurrentSave(layoutGate.current, generation)) setLayoutBusy(false); });
    }, 120);
    return () => {
      window.clearTimeout(handle);
      ctrl.abort();
    };
  }, [doc, projectId, generalRev, notify]);

  // symbol drawings for the placed symbols (and those of a general part from a template project),
  // plus the small icons of the lists on the left (same drawing, without length)
  // "10" = hatches off, "01" = solid fills off: a change reloads the drawings
  const stripFill = `${doc?.style.hatch_off ? 1 : 0}${doc?.style.fill_off ? 1 : 0}`;
  const stripSeen = useRef(stripFill);
  const symbolGen = useRef(0);
  useEffect(() => {
    const switched = stripSeen.current !== stripFill;
    stripSeen.current = stripFill;
    const known = switched ? {} : symbols;
    const prims = [...(placed?.prims ?? []), ...(general?.prims ?? [])].filter((p) => p.t === "symbol");
    const need = new Map<string, LegendPrim>();
    for (const p of prims) {
      const key = symbolRequestKey({ symbol_key: p.key, length_mm: p.length_mm, width_mm: p.width_mm, flat: Boolean(p.flat) });
      if (!known[key]) need.set(key, p);
    }
    const listed = [
      ...data.rows.filter((r) => r.total > 0 && r.symbol_key).map((r) => ({ key: r.symbol_key, family_key: r.family_key })),
      ...results.map((f) => ({ key: f.representative.key, family_key: f.key })),
      ...openStencilEntries.filter((e) => e.symbol_key).map((e) => ({ key: e.symbol_key as string, family_key: e.family_key })),
    ];
    for (const l of listed) {
      const key = symbolRequestKey({ symbol_key: l.key, length_mm: null, width_mm: null });
      if (!known[key] && !need.has(key)) need.set(key, { t: "symbol", key: l.key, family_key: l.family_key, length_mm: null, width_mm: null });
    }
    for (const b of doc?.blocks ?? []) {
      for (const it of b.items) {
        if (it.kind !== "symbol" || !it.symbol_key) continue;
        for (const part of [it, ...(it.parts ?? [])]) {
          const key = symbolRequestKey({ symbol_key: part.symbol_key, length_mm: null, width_mm: null, flat: Boolean(it.symbol_color) });
          if (!known[key] && !need.has(key)) need.set(key, { t: "symbol", key: part.symbol_key, family_key: part.family_key, length_mm: null, width_mm: null, flat: Boolean(it.symbol_color) });
        }
      }
    }
    if (!need.size) return;
    const list = [...need.entries()];
    const gen = ++symbolGen.current;
    api
      .legendSymbols(list.map(([, p]) => ({ symbol_key: p.key, family_key: p.family_key, length_mm: p.length_mm, width_mm: p.width_mm, flat: Boolean(p.flat) })),
        { hatch_off: stripFill[0] === "1", fill_off: stripFill[1] === "1" })
      .then((r) => {
        if (gen !== symbolGen.current || stripSeen.current !== stripFill) return;
        setSymbols((prev) => {
          const next = switched ? {} : { ...prev };
          list.forEach(([key], i) => (next[key] = r.items[i]));
          return next;
        });
      })
      .catch(() => undefined);
  }, [placed, general, symbols, data.rows, results, openStencilEntries, stripFill, doc]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const h = window.setTimeout(() => {
      api
        .families({ q: search, category: "", dataset: "", mounting: "", all_variants: false })
        .then((r) => setResults(r.items.slice(0, 10)))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(h);
  }, [search]);

  // -- editing helpers ---------------------------------------------------------------------

  const change = useCallback((next: LegendDoc) => setHist((h) => (h ? push(h, next) : historyOf(next))), []);

  /** Text fields: live change while typing, one undo step per field visit. */
  function field(apply: (d: LegendDoc, value: string) => LegendDoc) {
    return {
      onFocus: () => (fieldBefore.current = doc),
      onChange: (e: { target: { value: string } }) => setHist((h) => (h ? replace(h, apply(h.present, e.target.value)) : h)),
      onBlur: () =>
        setHist((h) => {
          const before = fieldBefore.current;
          fieldBefore.current = null;
          return h && before ? commit(h, before) : h;
        }),
    };
  }

  async function proposal() {
    if (doc && !window.confirm("Neuen Vorschlag aus dem Projekt erstellen? Die jetzige Legende wird ersetzt (Rückgängig bleibt möglich).")) return;
    setBusy(true);
    try {
      const r = await api.proposeLegend(projectId, doc?.style ?? info?.style, doc ? { scope: doc.scope, text_rules: doc.text_rules, variant_rules: doc.variant_rules } : undefined);
      change(r.doc);
      setSel(null);
      notify("Vorschlag erstellt");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  function ensureBlock(d: LegendDoc, categoriesOfEntry: string[], fallback: string | null): { doc: LegendDoc; id: string } {
    const found = blockForCategory(d, categoriesOfEntry.flatMap(lineage), null);
    if (found) return { doc: d, id: found };
    // a new section is the top category of the group
    const cat = categoriesOfEntry.map((c) => lineage(c)[lineage(c).length - 1]).find((c) => catTitle[c]);
    if (cat) return addBlock(d, catTitle[cat], cat, colorByCat[cat], layerByCat[cat] ?? "");
    if (fallback && d.blocks.some((b) => b.id === fallback)) return { doc: d, id: fallback };
    if (d.blocks[0]) return { doc: d, id: d.blocks[0].id };
    return addBlock(d, "Legende");
  }

  function selectedBlockId(): string | null {
    return sel && "block" in sel ? sel.block : null;
  }

  function addRows(rows: typeof data.rows) {
    if (!doc) return;
    let d = doc;
    let last: { block: string; item: string } | null = null;
    for (const r of rows) {
      const target = ensureBlock(d, r.categories, selectedBlockId());
      const res = addItem(target.doc, target.id, { kind: "symbol", family_key: r.family_key, symbol_key: r.symbol_key, text: describe(r.family_key, r.title, descriptions, stencilNames), ...look(r.family_key) });
      d = res.doc;
      last = { block: target.id, item: res.id };
    }
    change(d);
    if (last && rows.length === 1) setSel({ type: "item", block: last.block, item: last.item });
  }

  function addFromLibrary(f: FamilyItem) {
    if (!doc) return;
    const familyKey = f.key;
    const target = ensureBlock(doc, f.categories, selectedBlockId());
    const res = addItem(target.doc, target.id, { kind: "symbol", family_key: familyKey, symbol_key: f.representative.key, text: describe(familyKey, f.title, descriptions, stencilNames), ...look(familyKey) });
    change(res.doc);
    setSel({ type: "item", block: target.id, item: res.id });
    setSearch("");
  }

  function addFromStencil(e: StencilEntry) {
    if (!doc || !e.symbol_key) return;
    const target = ensureBlock(doc, e.categories, selectedBlockId());
    const text = describe(e.family_key, e.name, descriptions, {});
    const res = addItem(target.doc, target.id, { kind: "symbol", family_key: e.family_key, symbol_key: e.symbol_key, text, ...look(e.family_key) });
    change(res.doc);
    setSel({ type: "item", block: target.id, item: res.id });
  }

  function addKind(kind: "line" | "note" | "text") {
    if (!doc) return;
    let d = doc;
    let blockId = selectedBlockId();
    if (!blockId || !d.blocks.some((b) => b.id === blockId)) {
      if (kind === "text") {
        const nb = addBlock(d, "Zusatztext");
        d = nb.doc;
        blockId = nb.id;
      } else {
        const t = ensureBlock(d, [], null);
        d = t.doc;
        blockId = t.id;
      }
    }
    const text = kind === "line" ? "UP-Wandleitung" : kind === "note" ? "Hinweis" : "Zusatztext";
    const res = addItem(d, blockId, { kind, text });
    change(res.doc);
    setSel({ type: "item", block: blockId, item: res.id });
  }

  function removeSelected() {
    if (!doc || !sel) return;
    if (sel.type === "item") change(removeItem(doc, sel.block, sel.item));
    else if (sel.type === "block") {
      const b = doc.blocks.find((x) => x.id === sel.block);
      if (b && b.items.length && !window.confirm(`Abschnitt «${b.title}» mit ${b.items.length} Einträgen entfernen?`)) return;
      change(removeBlock(doc, sel.block));
    } else return;
    setSel(null);
  }

  function moveSelected(delta: number) {
    if (!doc || !sel) return;
    if (sel.type === "item") {
      const r = moveItemInOrder(doc, sel.block, sel.item, delta);
      change(r.doc);
      setSel({ type: "item", block: r.block, item: sel.item });
    } else if (sel.type === "block") change(moveBlockInOrder(doc, sel.block, delta));
  }

  // -- drag and drop ---------------------------------------------------------------------

  function drop(payload: DragPayload | null, target: DropTarget | null) {
    // the preview already shows the legend after the drop: keep it on the sheet until the
    // new layout arrives, so the entries do not jump back to their old places first
    if (target?.cell !== undefined && preview) setPlaced(preview.layout);
    setDropAt(null);
    setPreview(null);
    if (!doc || !payload || !target) return;
    if (target.cell !== undefined) {
      if (payload.type === "move") {
        change(placeInCell(doc, target.block, target.cell, { block: payload.block, item: payload.item }));
        setSel({ type: "item", block: target.block, item: payload.item });
      } else {
        const fresh = makeItem({ kind: "symbol", family_key: payload.family_key, symbol_key: payload.symbol_key, text: payload.text, ...look(payload.family_key) });
        change(placeInCell(doc, target.block, target.cell, { item: fresh }));
        setSel({ type: "item", block: target.block, item: fresh.id });
      }
      return;
    }
    if (payload.type === "move") {
      if (payload.item === target.before) return;
      change(moveItemTo(doc, payload.block, payload.item, target.block, target.before));
      setSel({ type: "item", block: target.block, item: payload.item });
    } else {
      const res = insertItem(doc, target.block, { kind: "symbol", family_key: payload.family_key, symbol_key: payload.symbol_key, text: payload.text, ...look(payload.family_key) }, target.before);
      change(res.doc);
      setSel({ type: "item", block: target.block, item: res.id });
    }
  }

  /** Cell of the grid under the pointer (from the layout before the drag started). */
  function cellAt(x: number, y: number): DropTarget | null {
    const svg = paperRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !placed) return null;
    const pt = new DOMPoint(x, y).matrixTransform(ctm.inverse());
    const c = placed.prims.find((p) => p.t === "cell" && pt.x >= p.x && pt.x < p.x + p.w && pt.y >= p.y && pt.y < p.y + p.h);
    return c ? { block: c.block, before: null, cell: c.index } : null;
  }

  /** Drop place under the pointer on the sheet: a cell of the grid, else the end of a section. */
  function sheetTargetAt(x: number, y: number): DropTarget | null {
    if (!doc) return null;
    const cell = cellAt(x, y);
    if (cell) return cell;
    const el = document.elementFromPoint(x, y) as (Element & { dataset?: DOMStringMap }) | null;
    const hit = el?.closest?.("[data-hit]") as (SVGElement & { dataset: DOMStringMap }) | null;
    if (!hit) return null;
    const { hit: kind, block, id } = hit.dataset;
    if (!block) return null;
    if (kind === "item" && id) {
      const r = hit.getBoundingClientRect();
      if (y < r.top + r.height / 2) return { block, before: id };
      const items = doc.blocks.find((b) => b.id === block)?.items.filter((it) => !it.hidden) ?? [];
      const i = items.findIndex((it) => it.id === id);
      return { block, before: items[i + 1]?.id ?? null };
    }
    return { block, before: null };
  }

  function startSheetDrag(e: ReactPointerEvent, block: string, item: string) {
    if (e.button !== 0) return;
    sheetDrag.current = { block, item, x: e.clientX, y: e.clientY, active: false };
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = sheetDrag.current;
      if (!d) return;
      if (!d.active && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      d.active = true;
      const t = sheetTargetAt(e.clientX, e.clientY);
      setDropAt((old) => (old?.block === t?.block && old?.before === t?.before && old?.cell === t?.cell ? old : t));
    };
    const up = (e: PointerEvent) => {
      const d = sheetDrag.current;
      sheetDrag.current = null;
      if (!d?.active) return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      drop({ type: "move", block: d.block, item: d.item }, sheetTargetAt(e.clientX, e.clientY));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  /** HTML drag (left lists): what to carry. */
  function dragProps(payload: DragPayload) {
    return {
      draggable: true,
      onDragStart: (e: ReactDragEvent) => {
        dragPayload.current = payload;
        e.dataTransfer.effectAllowed = payload.type === "move" ? "move" : "copy";
        e.dataTransfer.setData("text/plain", payload.type === "move" ? "legend-entry" : payload.text);
      },
      onDragEnd: () => {
        dragPayload.current = null;
        setDropAt(null);
        setPreview(null);
      },
    };
  }

  /** HTML drop on a row of the outline. */
  function dropProps(target: DropTarget) {
    return {
      onDragOver: (e: ReactDragEvent) => {
        if (!dragPayload.current) return;
        e.preventDefault();
        e.stopPropagation();
        if (dropAt?.block !== target.block || dropAt?.before !== target.before) setDropAt(target);
      },
      onDrop: (e: ReactDragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        drop(dragPayload.current, target);
        dragPayload.current = null;
      },
    };
  }

  // live preview of a drop into a cell: the layout after the drop, others moved on
  useEffect(() => {
    if (!doc || dropAt?.cell === undefined) {
      setPreview(null);
      return;
    }
    const sheet = sheetDrag.current;
    const payload: DragPayload | null = sheet?.active ? { type: "move", block: sheet.block, item: sheet.item } : dragPayload.current;
    if (!payload) return;
    const next =
      payload.type === "move"
        ? placeInCell(doc, dropAt.block, dropAt.cell, { block: payload.block, item: payload.item })
        : placeInCell(doc, dropAt.block, dropAt.cell, {
            item: makeItem({ id: DROP_ID, kind: "symbol", family_key: payload.family_key, symbol_key: payload.symbol_key, text: payload.text, ...look(payload.family_key) }),
          });
    const id = payload.type === "move" ? payload.item : DROP_ID;
    const ctrl = new AbortController();
    const handle = window.setTimeout(() => {
      api
        .layoutLegend(projectId, next, ctrl.signal)
        .then((layout) => setPreview({ layout, id }))
        .catch(() => undefined);
    }, 30);
    return () => {
      window.clearTimeout(handle);
      ctrl.abort();
    };
  }, [dropAt, doc, projectId]);

  // Entries glide to their new place when the layout changes (drag preview, drop, undo):
  // FLIP, start where the entry was, then let CSS move it to where it is now.
  const entryPos = useRef<Map<string, { x: number; y: number }>>(new Map());
  const layoutNow = dropAt?.cell !== undefined && preview ? preview.layout : placed;
  useLayoutEffect(() => {
    const svg = paperRef.current;
    if (!svg || !layoutNow) return;
    const now = new Map<string, { x: number; y: number }>();
    for (const p of layoutNow.prims) if (p.t === "hit" && p.kind === "item") now.set(p.id, { x: p.x, y: p.y });
    const before = entryPos.current;
    entryPos.current = now;
    if (!before.size || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    svg.querySelectorAll<SVGGElement>("g[data-entry]").forEach((g) => {
      const id = g.dataset.entry ?? "";
      const a = before.get(id);
      const b = now.get(id);
      if (!a || !b || (Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01)) return;
      g.style.transition = "none";
      g.style.transform = `translate(${a.x - b.x}px, ${a.y - b.y}px)`;
      g.getBoundingClientRect();           // apply the start position before the move
      requestAnimationFrame(() => {
        g.style.transition = "transform 180ms cubic-bezier(.2,.7,.3,1)";
        g.style.transform = "";
      });
    });
  }, [layoutNow]);

  // -- save now and export ----------------------------------------------------------------

  async function exportFile(format: "dxf" | "dwg" | "pdf", block: string, withGeneral: boolean, handoff = false) {
    if (format === "dwg" && !info?.oda) {
      notify("Für DWG-Dateien wird der ODA File Converter gebraucht. Er ist nicht installiert. Alternative: DXF exportieren.", true);
      return;
    }
    setExporting(true);
    try {
      await saveNow();
      const { name } = await api.legendExportName(projectId, format, block, legendId);
      const blob = await api.legendExportFile(api.legendExportUrl(projectId, name, format, block, withGeneral, legendId));
      if (handoff && onOpenTool) {
        stageToolHandoff({ target: "pdf-werkzeuge", source: "NOVA-Legenden", files: [new File([blob], name, { type: "application/pdf" })], projectId, projectLabel: data.meta.name });
        onOpenTool("pdf-werkzeuge");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      notify(`${name} exportiert`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        setHist((h) => (h ? undo(h) : h));
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        setHist((h) => (h ? redo(h) : h));
      } else if (e.key === "Delete" && sel && sel.type !== "general") {
        e.preventDefault();
        removeSelected();
      } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && sel && sel.type !== "general") {
        e.preventDefault();
        moveSelected(e.key === "ArrowUp" ? -1 : 1);
      } else if (e.key === "Escape") {
        if (sel) setSel(null);
        else if (windowed) setWindowed(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function fitWidth() { viewport.fitView("width"); }

  const generalOpen = openBlocks.has("__general__") || sel?.type === "general-row";

  /** A section is open in the list when opened by hand or when it holds the selected entry. */
  function isOpen(b: LegendBlock): boolean {
    return openBlocks.has(b.id) || (sel?.type === "item" && sel.block === b.id);
  }

  function toggleGrid() {
    const next = !showGrid;
    setShowGrid(next);
    try {
      window.localStorage.setItem(GRID_KEY, next ? "1" : "0");
    } catch {
      /* only a convenience */
    }
  }

  // -- render ------------------------------------------------------------------------------

  if (!info) return <div className="hint">lädt …</div>;

  const generalBox = general?.kind && doc?.general_on === false ? (
    <p className="info-line">
      Ohne Allgemeinteil.{" "}
      <button className="btn small" onClick={() => setExportGeneral(true)}>Einblenden</button>
    </p>
  ) : general?.error ? (
    <p className="info-line company">
      <span title={general.error}>Allgemeinteil nicht gefunden.</span>{" "}
      <button className="btn small" onClick={() => window.dispatchEvent(new CustomEvent("nl:open-settings"))}>
        Vorlage wählen
      </button>
    </p>
  ) : general?.scope_warning ? <details className="legend-help"><summary>ⓘ Mehrspaltige Firmenvorlage</summary><div>{general.scope_warning}</div></details>
    : general?.kind && general.source !== "edeco:allgemein-2026" && (general.rows || []).filter(row => row.picture === "swatch").length > 0
      ? <details className="legend-help"><summary>ⓘ Allgemeinvorlage · {(general.rows || []).filter(row => row.picture === "swatch").length} Farbcodes</summary>
        <p>Diese Legende nutzt die eingestellte Firmenquelle. Die neue edeco-Vorlage mit 21 allgemeinen Zeilen und 12 Farbcodes lässt sich in den Einstellungen vor der Übernahme ansehen und wieder zurücksetzen.</p>
        <button className="btn small" onClick={() => window.dispatchEvent(new CustomEvent("nl:open-settings"))}>Allgemeinvorlage ansehen</button>
      </details> : null;

  if (!doc) {
    return (
      <div className="empty" style={{ padding: 32 }}>
        {generalBox}
        <p>Für dieses Projekt gibt es noch keine Legende.</p>
        <button className="btn primary" disabled={busy} onClick={proposal}>
          Vorschlag aus dem Projekt erstellen
        </button>
        <details className="legend-help"><summary>ⓘ Vorschlag und Vorgaben</summary><div>Der Vorschlag enthält die Apparate der aktuellen Importe nach Kategorien und übernimmt Firmentexte oder Bibliotheksnamen. Schriftgrösse {String(info.style.text_size).replace(".", ",")} mm und Symbolmassstab {String(info.style.symbol_scale).replace(".", ",")} kommen aus dem Firmenstandard beziehungsweise der Vorlage.</div></details>
      </div>
    );
  }

  const style = doc.style;
  const scopeRows = placed?.scope_info?.rows ?? info.scope_info?.rows ?? data.rows;
  const stale = staleItems(doc, scopeRows);
  const covered = new Set(info.in_general?.covered ?? []);
  const missing = missingRows(doc, scopeRows, covered);
  const inGeneralRows = coveredRows(scopeRows, covered);
  const dups = duplicateItems(doc);
  const multicolorIds = new Set(doc.blocks.flatMap(block => block.items.filter(item => legendItemColors(item).length > 1 && !item.symbol_color).map(item => item.id)));
  const selBlock = sel && "block" in sel ? doc.blocks.find((b) => b.id === sel.block) : undefined;
  const selItem = sel?.type === "item" ? selBlock?.items.find((i) => i.id === sel.item) : undefined;
  // during a drag onto a cell the sheet shows the preview, so the others visibly make room
  const shown = dropAt?.cell !== undefined && preview ? preview.layout : placed;
  const selectedSource = selItem ? legendSourceSelection(selItem, shown?.prims ?? []) : null;
  const originalEditKey = `${selItem?.id ?? ""}:${selectedSource?.visibleKey ?? ""}`;
  const selectedGroup = (shown?.variant_info ?? info.variant_info)?.groups.find(group => group.item === selItem?.id || group.source_ids.includes(selItem?.id ?? ""));
  const paperSelection = selectedGroup && sel?.type === "item" ? { ...sel, item: selectedGroup.item } : sel;
  const W = shown?.width ?? 200;
  const H = shown?.height ?? 100;
  const setStyle = (patch: Partial<LegendDoc["style"]>) => change({ ...doc, style: { ...style, ...patch } });
  const applyCompact = () => change(compactLegendDocument(doc));
  const alignSectionColors = () => {
    const next = alignLegendSectionColors(doc);
    const amount = next.blocks.filter((block, index) => block !== doc.blocks[index]).length;
    change(next);
    notify(`${amount} Rubrikfarben angeglichen. Die Originalfarben der Symbole bleiben erhalten. Rückgängig mit Strg+Z.`);
  };
  const applyA4 = () => change(a4CompactLegendDocument(doc));

  return (
    <>
    {windowed && (
      <button type="button" className="legend-window-back" aria-label="Grossansicht beenden" title="Grossansicht beenden" onClick={() => setWindowed(false)} />
    )}
    <div ref={editorRef} className={`legend-editor ${windowed ? "windowed" : ""} ${grayscale ? "preview-grayscale" : ""}`} role={windowed ? "dialog" : undefined} aria-modal={windowed || undefined} aria-label={windowed ? "Legendeneditor" : undefined} tabIndex={-1}>
      <div className="legend-editor-heading">
        <div className="legend-editor-heading-main">
          {onProjects && <button type="button" className="btn primary legend-projects-back" aria-label="Zurück zu Projekten" onClick={onProjects}><ArrowLeft size={15} /> Projekte</button>}
          <div><strong>{info.legend?.name || "Legende"}</strong><span className="hint legend-sheet-size">PDF {Math.round((W + 10) * 10) / 10} × {Math.round((H + 10) * 10) / 10} mm</span>
            {H + 10 > 297.1 && <span className="legend-paper-warning" title="Die Ausgabe ist höher als A4. Das Layout folgt dem Inhalt und schneidet keine Zeilen ab.">Höher als A4</span>}</div>
          <InfoTip text="Die Blatthöhe folgt dem Inhalt. Änderungen werden automatisch gespeichert. Der Ansichtzoom verändert weder die Zeichnungsmasse noch den Export." />
        </div>
        <button type="button" className="btn legend-expand-button" aria-pressed={windowed} onClick={() => setWindowed(value => !value)} title={windowed ? "Zur eingebetteten Ansicht zurückkehren" : "Grosse Arbeitsfläche für die Legende innerhalb des Toolhubs öffnen"}>
          {windowed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{windowed ? "Grossansicht beenden" : "Editor gross öffnen"}
        </button>
      </div>
      {(!style.compact_flow || style.row > 9 || style.symbol_fit !== "corridor") && <div className="legend-layout-notice">
        <span>Gespeichertes Layout <InfoTip text="Diese Legende verwendet ihre bisherigen Abstände und Grössen. Die kompakte Vorlage setzt drei Apparatespalten, ein dichtes Raster, 2,8 mm Schrift und kleinere Abstände. Inhalte, Zuordnungen und Originalfarben bleiben erhalten. Die Änderung lässt sich mit Rückgängig zurücknehmen." /></span>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="btn small" onClick={applyCompact}>Kompakte Vorlage anwenden</button>
          <button className="btn small" onClick={applyA4} title="Vier Spalten, kompakte Abstände. Die Seitenhöhe folgt dem Inhalt.">A4 kompakt</button>
        </div>
      </div>}
      {generalBox}
      <div className="legend-toolbar">
        <button type="button" className="btn small" aria-expanded={outlineOpen} aria-controls="legend-sections-outline" onClick={() => setOutlineOpen(value => !value)}>Abschnitte {outlineOpen ? "ausblenden" : "einblenden"}</button>
        {bar.has("history") && (
          <div className="tool-group" role="group" aria-label="Verlauf">
            <button className="btn small" disabled={busy} onClick={proposal} title="Legende aus den aktuellen Projektzahlen neu vorschlagen">
              Neuer Vorschlag
            </button>
            <button className="btn small icon-btn" disabled={!hist?.past.length} onClick={() => setHist((h) => (h ? undo(h) : h))}
              title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button>
            <button className="btn small icon-btn" disabled={!hist?.future.length} onClick={() => setHist((h) => (h ? redo(h) : h))}
              title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button>
          </div>
        )}
        {bar.has("insert") && (
          <Menu label="Einfügen" portalContainer={() => editorRef.current}>
            <button className="btn small" onClick={() => addKind("text")} title={FREE_TEXT_HINT}>+ Freier Text</button>
            <button className="btn small" onClick={() => addKind("line")} title="Linienmuster, z. B. für Leitungen und Trassen">+ Linie</button>
            <button className="btn small" onClick={() => addKind("note")}>+ Hinweis</button>
            <button className="btn small" onClick={() => {
              const r = addBlock(doc, "Neuer Abschnitt");
              change(r.doc);
              setSel({ type: "block", block: r.id });
            }}>+ Abschnitt</button>
          </Menu>
        )}
        {(bar.has("grid") || bar.has("rows") || bar.has("columns")) && (
          <div className="tool-group" role="group" aria-label="Raster">
          {bar.has("grid") && (<label className="filter-label">
            Raster
            <select
              className="select"
              value={style.grid}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setStyle({ grid: "custom" });
                  return;
                }
                // row and text step change at once, so the grid lines follow without a reload
                const g = info.grids.find((x) => x.id === e.target.value);
                if (g) setStyle({ grid: g.id, row: g.row, text_offset: g.text_offset });
              }}
              aria-label="Rastermass"
              title="Zeilenhöhe / Textabstand in mm"
            >
              {info.grids.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id === "standard"
                    ? "Standard (aus Schrift)"
                    : `${g.label} ${String(g.row).replace(".", ",")} / ${String(g.text_offset).replace(".", ",")} mm`}
                </option>
              ))}
              <option value="custom">Eigenes Mass</option>
            </select>
          </label>)}
            {bar.has("rows") && (
              <>
                <label className="filter-label">
                  Zeile
                  <span className="grid-mm">
                    <NumberInput label="Zeilenhöhe in mm" value={style.row} step={0.5} min={3} max={30}
                      onCommit={(v) => setStyle({ grid: "custom", row: Math.round(v * 100) / 100 })} />
                  </span>
                </label>
                <label className="filter-label">
                  Text
                  <span className="grid-mm">
                    <NumberInput label="Textabstand in mm" value={style.text_offset} step={0.5} min={5} max={45}
                      onCommit={(v) => setStyle({ grid: "custom", text_offset: Math.round(v * 100) / 100 })} />
                  </span>
                </label>
              </>
            )}
            {bar.has("columns") && (
              <label className="filter-label">
                Spalten
                <select className="select" value={style.columns} onChange={(e) => setStyle({ columns: Number(e.target.value) })}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>
            )}
          </div>
        )}
        {bar.has("sizes") && (
          <div className="tool-group" role="group" aria-label="Grössen">
            <label className="filter-label">
              Schrift
              <span className="grid-mm">
                <NumberInput label="Schriftgrösse in mm" value={style.text_size} step={0.25} min={1} max={10}
                  onCommit={(v) => setStyle({ text_size: Math.max(1, Math.min(10, v)) })} />
              </span>
            </label>
            <label className="filter-label">
              Symbole
              <span className="grid-mm">
                <NumberInput label="Symbolmassstab" value={style.symbol_scale} step={0.1} min={0.2} max={5}
                  onCommit={(v) => setStyle({ symbol_scale: Math.max(0.2, Math.min(5, v)) })} />
              </span>
            </label>
            {(style.symbol_size ?? "tile") === "tile" && style.symbol_fit !== "corridor" && (
              <label className="toggle" title="Jedes Symbol bekommt dieselbe Fläche, mit einem kleinen freien Rand">
                <input type="checkbox" checked={style.normalize_size !== false} onChange={(e) => setStyle({ normalize_size: e.target.checked })} />
                Gleiche Fläche
              </label>
            )}
          </div>
        )}
        {bar.has("general") && general?.kind && (
          <label className="toggle tool-toggle" title={`Allgemeinteil in dieser Legende zeigen (Vorschau und Export). ${general.kind === "dxf" ? "DXF/DWG" : "Vorlagen-Projekt"} vom Server, gesperrt. Schrift, Symbolgrösse, Abstand und Spalten übernimmt er von dieser Legende.`}>
            <input type="checkbox" checked={exportGeneral} onChange={(e) => setExportGeneral(e.target.checked)} />
            Allgemeinteil
          </label>
        )}
        {bar.has("gridlines") && (
          <button className={`btn small ${showGrid ? "is-on" : ""}`} aria-pressed={showGrid} onClick={toggleGrid} aria-label="Raster anzeigen"
            title="Rasterlinien im gewählten Mass einblenden. Sie erscheinen nicht im Export.">
            ▦ Raster
          </button>
        )}
        <Menu label="Ansicht" portalContainer={() => editorRef.current}>
          <div className="menu-fields">
            <label className="filter-label">
              Raster
              <select
                className="select"
                value={style.grid}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setStyle({ grid: "custom" });
                    return;
                  }
                  // row and text step change at once, so the grid lines follow without a reload
                  const g = info.grids.find((x) => x.id === e.target.value);
                  if (g) setStyle({ grid: g.id, row: g.row, text_offset: g.text_offset });
                }}
                aria-label="Rastermass"
                title="Zeilenhöhe / Textabstand in mm"
              >
                {info.grids.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id === "standard"
                      ? "★ Standard · Kachel aus der Schrift"
                      : `${g.label} · Zeile ${String(g.row).replace(".", ",")} mm · Text ${String(g.text_offset).replace(".", ",")} mm`}
                  </option>
                ))}
                <option value="custom">Benutzerdefiniert</option>
              </select>
            </label>
          </div>
          {!bar.has("gridlines") && (
            <button className={`btn small ${showGrid ? "is-on" : ""}`} aria-pressed={showGrid} onClick={toggleGrid}>Raster anzeigen</button>
          )}
          <button className={`btn small ${style.compact_flow && style.columns !== 4 ? "is-on" : ""}`} aria-pressed={Boolean(style.compact_flow && style.columns !== 4)} onClick={applyCompact}>
            Dichte wie Entwurf
          </button>
          <button className={`btn small ${style.compact_flow && style.columns === 4 ? "is-on" : ""}`} aria-pressed={Boolean(style.compact_flow && style.columns === 4)} onClick={applyA4} title="Vier Spalten, kompakte Abstände. Die Seitenhöhe folgt dem Inhalt.">
            A4 kompakt
          </button>
          <button className="btn small" onClick={alignSectionColors} title="Rubrikmarkierung und Trennlinie auf die häufigste Originalfarbe ihrer Symbole setzen. Quellfarben, Farbvarianten und eigene Symbolfarben bleiben unverändert.">
            Rubrikfarben aus Symbolen
          </button>
          <button className={`btn small ${detached ? "is-on" : ""}`} aria-pressed={detached} onClick={() => setDetached((v) => !v)}>
            {detached ? "Einstellungen andocken" : "Einstellungen schwebend"}
          </button>
          <div className="menu-divider" />
          <div className="menu-fields bar-choice" role="group" aria-label="Sichtbar in der Leiste">
            <span className="hint">In der Leiste zeigen:</span>
            {TOOLBAR_ITEMS.map((t) => (
              <label key={t.id} className="toggle">
                <input type="checkbox" checked={bar.has(t.id)} onChange={() => toggleBar(t.id)} />
                {t.label}
              </label>
            ))}
            <button className="btn small" onClick={() => saveBar(new Set(TOOLBAR_DEFAULT))}>Standard</button>
          </div>
        </Menu>

        <span style={{ flex: 1 }} />
        <span className={saveState === "error" ? "dirty" : saveState === "saving" ? "hint" : "saved"} role="status"
          title={savedInfo ? `Zuletzt gespeichert ${savedInfo}` : undefined}>
          {saveState === "saving" ? "Speichert …" : saveState === "error" ? "Nicht gespeichert" : savedInfo ? "Gespeichert" : ""}
        </span>
        {bar.has("export") && (
          <button className="btn small primary" disabled={busy || exporting}
            onClick={() => exportFile("dxf", exportBlock, exportGeneral && Boolean(general?.kind))}
            title={exportBlock ? "Den gewählten Abschnitt als DXF herunterladen" : "Die ganze Legende als DXF herunterladen"}>
            <Icon name="download" size={16} /> {exporting ? "Exportiert …" : "DXF herunterladen"}
          </button>
        )}
      </div>


      <div className={`legend-body ${detached ? "detached" : ""} ${outlineOpen ? "" : "outline-hidden"}`}
        style={{ ["--outline-w" as string]: `${panes.outline}px`, ["--props-w" as string]: `${panes.props}px` }}>
        <div hidden={!outlineOpen} className="pane-handle outline" role="separator" aria-orientation="vertical" aria-label="Breite der Liste links ändern"
          title="Ziehen ändert die Breite. Doppelklick: Standardbreite." onPointerDown={(e) => startPaneDrag(e, "outline")}
          onDoubleClick={() => resetPane("outline")} />
        {!detached && (
          <div className="pane-handle props" role="separator" aria-orientation="vertical" aria-label="Breite der Einstellungen ändern"
            title="Ziehen ändert die Breite. Doppelklick: Standardbreite." onPointerDown={(e) => startPaneDrag(e, "props")}
            onDoubleClick={() => resetPane("props")} />
        )}
        <aside id="legend-sections-outline" hidden={!outlineOpen} className="legend-outline">
          <div className="section" style={{ marginTop: 0 }}>
            Abschnitte
          </div>
          {general?.kind && doc.general_on !== false && (
            <div className="outline-block">
              <div className={`outline-row ${sel?.type === "general" ? "active" : ""}`}>
                <button className="fold-btn" aria-label={generalOpen ? "Einklappen" : "Aufklappen"} aria-expanded={generalOpen}
                  onClick={() => toggleOpen("__general__")}>{generalOpen ? "▾" : "▸"}</button>
                <span className="swatch" style={{ background: "#b8bec4", width: 12, height: 2 }} />
                <button className="outline-title" onClick={() => { setSel({ type: "general" }); toggleOpen("__general__"); }} title="Kategorie des Allgemeinteils">
                  <span className="outline-text">{doc.general_section?.title || "Allgemein"}</span>
                  <span className="outline-count">{general.rows?.length ?? ""}</span>
                </button>
              </div>
              {generalOpen && general.rows?.map((row) => (
                <button
                  key={row.id}
                  className={`outline-item ${sel?.type === "general-row" && sel.id === row.id ? "active" : ""}`}
                  onClick={() => setSel({ type: "general-row", id: row.id })}
                  title={row.heading ? "Zwischenüberschrift" : row.text}
                >
                  {row.heading ? "T " : ""}{row.text}
                </button>
              ))}
            </div>
          )}
          {doc.title.text.trim() && (
            <button className={`outline-item ${sel?.type === "title" ? "active" : ""}`} style={{ paddingLeft: 6 }} onClick={() => setSel({ type: "title" })} title={doc.title.text}>
              T Titel
            </button>
          )}
          {doc.blocks.map((b) => (
            <div key={b.id} className="outline-block">
              <div
                className={`outline-row ${sel?.type === "block" && sel.block === b.id ? "active" : ""} ${dropAt?.block === b.id && dropAt.before === null ? "drop-end" : ""}`}
                {...dropProps({ block: b.id, before: null })}
              >
                <button className="fold-btn" aria-label={isOpen(b) ? "Einklappen" : "Aufklappen"} aria-expanded={isOpen(b)} onClick={() => toggleOpen(b.id)}>
                  {isOpen(b) ? "▾" : "▸"}
                </button>
                <span className="swatch" style={{ background: b.style.header, width: 12, height: 12 }} />
                <button className="outline-title" onClick={() => { setSel({ type: "block", block: b.id }); toggleOpen(b.id); }} title={b.title}>
                  <span className="outline-text">{b.title || "(ohne Überschrift)"}</span>
                  <span className="outline-count">{b.items.filter((it) => !it.hidden && it.kind !== "gap").length}</span>
                </button>
              </div>
              {isOpen(b) &&
                b.items.filter((it) => it.kind !== "gap").map((it) => (
                  <button
                    key={it.id}
                    className={`outline-item ${sel?.type === "item" && sel.item === it.id ? "active" : ""} ${it.hidden ? "hidden-entry" : ""} ${multicolorIds.has(it.id) ? "has-layer-variants" : ""} ${dropAt?.block === b.id && dropAt.before === it.id ? "drop-before" : ""}`}
                    onClick={(e) => selectOnSheet({ type: "item", block: b.id, item: it.id }, e.ctrlKey || e.metaKey || e.shiftKey)}
                    title={`${entryText(it)} · ziehen zum Verschieben · Strg+Klick: zweites Kästchen zum Kombinieren`}
                    {...dragProps({ type: "move", block: b.id, item: it.id })}
                    {...dropProps({ block: b.id, before: it.id })}
                  >
                    {it.kind === "symbol" && it.symbol_key ? <span className="legend-outline-symbols">{[it, ...(it.parts ?? [])].flatMap((part, partIndex) => (it.symbol_color ? [it.symbol_color] : legendVisibleLayerColors(part).length ? legendVisibleLayerColors(part) : [b.style.symbol]).map(color => <SymIcon key={`${partIndex}:${color}`} r={symbols[symbolRequestKey({ symbol_key: part.symbol_key, length_mm: null, width_mm: null, flat: Boolean(it.symbol_color) })]} color={color} />))}</span> : null}
                    {it.kind === "line" ? "― " : it.kind === "note" ? "◐ " : it.kind === "text" ? "¶ " : ""}
                    <span className="outline-text">{entryText(it) || "(ohne Text)"}</span>
                    {companyKey(it) && descriptions[companyKey(it)!] === it.text.trim() && (
                      <span className="badge company" title="Dieser Text ist der Firmentext">F</span>
                    )}
                    {multicolorIds.has(it.id) && <span className="badge layer-variant-badge">{legendVisibleItemColors(it).length < legendItemColors(it).length ? `${legendVisibleItemColors(it).length}/${legendItemColors(it).length}` : legendItemColors(it).length} Farben</span>}
                    {it.hidden && <span className="badge">im Allgemeinteil</span>}
                    {dups.has(it.id) && <span className="badge warn">doppelt</span>}
                    {stale.has(it.id) && <span className="badge weg">nicht im Projekt</span>}
                  </button>
                ))}
            </div>
          ))}

          <div className="section">Fehlende Einträge ({missing.length}) <InfoTip text="Apparate aus den aktuellen Importen, die weder die Legende noch der Allgemeinteil zeigen. Ein Klick fügt sie hinzu; Ziehen legt sie im gewünschten Abschnitt ab." /></div>
          {missing.length === 0 ? (
            <p className="hint">✓ Vollständig</p>
          ) : (
            <>
              <p className="hint">Anklicken oder auf einen Abschnitt ziehen.</p>
              {missing.slice(0, 40).map((r) => {
                const text = describe(r.family_key, r.title, descriptions, stencilNames);
                return (
                  <button
                    key={r.family_key}
                    className="outline-item add"
                    onClick={() => addRows([r])}
                    title={`${text} hinzufügen`}
                    {...dragProps({ type: "add", family_key: r.family_key, symbol_key: r.symbol_key, text, categories: r.categories })}
                  >
                    <SymIcon r={symbols[symbolRequestKey({ symbol_key: r.symbol_key, length_mm: null, width_mm: null })]} />
                    {text} <span className="hint">{r.total}×</span>
                  </button>
                );
              })}
              <button className="btn small" style={{ marginTop: 6 }} onClick={() => addRows(missing)}>
                Alle hinzufügen
              </button>
            </>
          )}

          {inGeneralRows.length > 0 && (
            <>
              <div className="section">Im Allgemeinteil ({inGeneralRows.length})</div>
              <details className="legend-help"><summary>ⓘ Bereits im Allgemeinteil</summary><div>Diese Apparate zeigt der Allgemeinteil bereits. Sie werden im Vorschlag nicht doppelt aufgenommen. Bei Bedarf trotzdem in einen Abschnitt ziehen.</div></details>
              {inGeneralRows.map((r) => {
                const text = describe(r.family_key, r.title, descriptions, stencilNames);
                return (
                  <div
                    key={r.family_key}
                    className="outline-item hidden-entry"
                    title="im Allgemeinteil"
                    {...dragProps({ type: "add", family_key: r.family_key, symbol_key: r.symbol_key, text, categories: r.categories })}
                  >
                    <SymIcon r={symbols[symbolRequestKey({ symbol_key: r.symbol_key, length_mm: null, width_mm: null })]} />
                    {text} <span className="badge">im Allgemeinteil</span>
                  </div>
                );
              })}
            </>
          )}

          <div className="section">Aus der Bibliothek</div>
          <input className="input" style={{ width: "100%" }} placeholder="Name oder Katalogcode" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Bibliothek durchsuchen" />
          {results.map((f) => {
            const fam = f.key;
            const text = describe(fam, f.title, descriptions, stencilNames);
            const twice = inLegend(doc, fam, f.representative.key);
            return (
              <button
                key={f.id}
                className="outline-item add"
                onClick={() => addFromLibrary(f)}
                title={twice ? `${f.title} · schon in der Legende` : f.title}
                {...dragProps({ type: "add", family_key: fam, symbol_key: f.representative.key, text, categories: f.categories })}
              >
                <SymIcon r={symbols[symbolRequestKey({ symbol_key: f.representative.key, length_mm: null, width_mm: null })]} />
                {text} <span className="hint">{f.representative.item}</span>
                {twice && <span className="badge warn">doppelt</span>}
              </button>
            );
          })}

          <div className="section">Benutzerschablone{stencil?.nova ? ` · Nova ${stencil.nova}` : ""}</div>
          {stencil && !stencil.sets.length && (
            <details className="legend-help">
              <summary>{stencil.found ? "Keine Schablone" : "Ordner fehlt"}</summary>
              <div><p>{stencil.found ? "Im Ordner liegt keine lesbare Schablone (.n5q)." : "Der konfigurierte Ordner wurde nicht gefunden."}</p><p className="legend-folder-path">{stencil.folder}</p>
              <button className="btn small" onClick={() => window.dispatchEvent(new CustomEvent("nl:open-settings"))}>Einstellungen öffnen</button></div>
            </details>
          )}
          {stencil?.sets.map((sset, si) => (
            <div key={`${sset.name}${si}`} className="stencil-set">
              <div className="stencil-set-name" title={sset.description}>{sset.name}</div>
              {sset.tabs.map((tab, ti) => {
                const id = `${si}:${ti}`;
                const open = stencilTab === id;
                return (
                  <div key={id}>
                    <button className={`outline-row stencil-tab ${open ? "active" : ""}`} aria-expanded={open}
                      onClick={() => setStencilTab(open ? null : id)} title={tab.description}>
                      <span className="fold-btn" aria-hidden>{open ? "▾" : "▸"}</span>
                      <span className="outline-text">{tab.name}</span>
                      <span className="hint">{tab.entries.length}</span>
                    </button>
                    {open && tab.entries.map((e, k) =>
                      e.symbol_key ? (
                        <button key={k} className="outline-item add" onClick={() => addFromStencil(e)}
                          title={`${e.name}${e.item ? ` · ${e.item}` : ""}${e.description ? ` · ${e.description}` : ""}`}
                          {...dragProps({ type: "add", family_key: e.family_key, symbol_key: e.symbol_key, text: describe(e.family_key, e.name, descriptions, {}), categories: e.categories })}>
                          <SymIcon r={symbols[symbolRequestKey({ symbol_key: e.symbol_key, length_mm: null, width_mm: null })]} />
                          <span className="outline-text">{e.name}</span>
                          {e.family_key && inLegend(doc, e.family_key, e.symbol_key) && <span className="badge warn">doppelt</span>}
                        </button>
                      ) : (
                        <div key={k} className="outline-item add disabled"
                          title={e.macro ? `Makro: ${e.macro}. Makros lassen sich noch nicht in die Legende ziehen.` : "Ohne Katalogsymbol: nicht in der Bibliothek."}>
                          {e.macro && e.macro_found ? (
                            <img className="sym-icon" src={api.macroPreviewUrl(projectId, e.macro)} alt="" />
                          ) : (
                            <span className="sym-icon empty" aria-hidden />
                          )}
                          <span className="outline-text">{e.name}</span>
                          <span className="badge">{e.macro ? "Makro" : "kein Symbol"}</span>
                        </div>
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </aside>

        <div className="legend-canvas-shell" aria-busy={layoutBusy}>
        <div
          ref={canvasRef}
          className={`legend-canvas ${viewport.hand ? "hand-mode" : ""} ${viewport.space ? "space-pan" : ""} ${viewport.panning ? "is-panning" : ""}`}
          data-document-zoom="true" tabIndex={0} aria-label="Legendenblatt: Strg und Mausrad zum Zoomen, Leertaste zum Verschieben"
          {...viewport.canvasEvents}
          onClick={() => !justDragged.current && setSel({ type: "legend" })}
          onDragOver={(e) => {
            if (!dragPayload.current) return;
            e.preventDefault();
            const t = sheetTargetAt(e.clientX, e.clientY);
            if (t?.block !== dropAt?.block || t?.before !== dropAt?.before || t?.cell !== dropAt?.cell) setDropAt(t);
          }}
          onDragLeave={(e) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropAt(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(dragPayload.current, sheetTargetAt(e.clientX, e.clientY));
            dragPayload.current = null;
          }}
        >
          <svg
            ref={paperRef}
            className="legend-paper"
            viewBox={`0 0 ${W} ${H}`}
            width={W * zoom}
            height={H * zoom}
            style={{ fontFamily: `${style.font}, Arial, sans-serif` }}
            aria-label={`Legende, ${W} × ${H} mm`}
          >
            <rect width={W} height={H} fill="#fff" />
            {/* section backgrounds, then the grid above the paper, then everything else */}
            {(shown?.prims ?? [])
              .filter((p) => p.t === "rect" && p.role === "background")
              .map((p, i) => (
                <Prim key={`bg${i}`} p={p} symbols={symbols} general={general} sel={paperSelection} pick={pick?.item} stale={stale} dups={dups} variants={multicolorIds} onSelect={selectOnSheet} />
              ))}
            {showGrid && (shown?.prims ?? []).filter((p) => p.t === "grid").map((g) => <GridLines key={`g${g.block}:${g.flow_column ?? ""}:${g.y}`} g={g} />)}
            {groupByEntry((shown?.prims ?? []).filter((p) => !(p.t === "rect" && p.role === "background") && p.t !== "grid")).map((g, i) =>
              g.item ? (
                // one group per entry, keyed by its id: it glides to a new place (see the FLIP effect)
                <g key={`e:${g.item}`} data-entry={g.item} className="lg-entry">
                  {g.prims.map((p, j) => (
                    <Prim key={j} p={p} symbols={symbols} general={general} sel={paperSelection} pick={pick?.item} stale={stale} dups={dups} variants={multicolorIds} onSelect={selectOnSheet} onDragStart={startSheetDrag} />
                  ))}
                </g>
              ) : (
                <Prim key={`p${i}`} p={g.prims[0]} symbols={symbols} general={general} sel={paperSelection} pick={pick?.item} stale={stale} dups={dups} variants={multicolorIds} onSelect={selectOnSheet} onDragStart={startSheetDrag} />
              ),
            )}
            {dropAt && dropAt.cell !== undefined && preview && <DropCell layout={preview.layout} id={preview.id} />}
            {dropAt && dropAt.cell === undefined && placed && <DropMarker placed={placed} target={dropAt} doc={doc} />}
          </svg>
        </div>
        <div className="legend-zoom-dock" role="group" aria-label="Dokumentzoom">
          <button type="button" className="btn small icon-btn" aria-label="Ansicht verschieben" aria-pressed={viewport.hand} onClick={() => viewport.setHand(value => !value)}><Hand size={15} /></button>
          <span className="legend-dock-divider" />
          <button type="button" className="btn small icon-btn" aria-label="Verkleinern" onClick={() => viewport.zoomTo(zoom / 1.2)}><Minus size={14} /></button>
          <button type="button" className="btn small legend-zoom-value" aria-label="Ansicht auf 100 Prozent" onClick={() => viewport.zoomTo(4)}>{Math.round(zoom / 4 * 100)} %</button>
          <button type="button" className="btn small icon-btn" aria-label="Vergrössern" onClick={() => viewport.zoomTo(zoom * 1.2)}><Plus size={14} /></button>
          <span className="legend-dock-divider" />
          <button type="button" className="btn small" onClick={fitWidth}>Breite</button>
          <button type="button" className="btn small" onClick={() => viewport.fitView("page")}><Maximize2 size={14} /> Ganzes Blatt</button>
          <InfoTip text="Strg + Mausrad zoomt am Mauszeiger. Strg + Plus/Minus/0 verändert nur dieses Blatt. Leertaste halten oder die Hand wählen und ziehen verschiebt die Ansicht." />
        </div>
        <div className="legend-preview-heading"><strong>Vorschau</strong><span className="hint">{Math.round((H + 10) / 297 * 100)} % A4-Höhe · {Math.round((H + 10) / 420 * 100)} % A3-Höhe</span><span role="status" className="hint">{layoutBusy ? "Aktualisiert …" : "Gleiche Zeichnung wie im Export"}</span></div>
        {!!shown?.warnings?.length && <div className="legend-layout-warnings" aria-label="Texthinweise"><strong>{shown.warnings.length} Texte prüfen</strong>{shown.warnings.map(warning => <button type="button" key={warning.id} onClick={() => {
          setSel({ type: "item", block: warning.block, item: warning.item });
          setOpenBlocks(current => new Set([...current, warning.block]));
          requestAnimationFrame(() => {
            paperRef.current?.querySelector(`[data-entry="${CSS.escape(warning.item)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
            const details = editorRef.current?.querySelector<HTMLDetailsElement>(".legend-selection-details");
            if (details) details.open = true;
            const input = editorRef.current?.querySelector<HTMLInputElement>(`[data-legend-text="${CSS.escape(warning.item)}"]`);
            input?.scrollIntoView({ block: "nearest", inline: "nearest" });
            input?.focus({ preventScroll: true });
          });
        }}><span>{warning.text}</span><small>{warning.width_mm.toFixed(1)} / {warning.available_mm.toFixed(1)} mm{warning.suggestion ? ` · Vorschlag: ${warning.suggestion}` : " · Text oder Spaltenbreite prüfen"}</small></button>)}</div>}
        </div>

        <aside className={`legend-props ${detached ? "floating" : ""}`}>
        <div className="props-export">
        <button className="btn small" disabled={busy || saveState === "saving"} onClick={() => { void saveLegend(); }}
          title="Die Legende jetzt speichern. Änderungen werden sonst kurz danach von selbst gespeichert.">
          {saveState === "saving" ? "Speichert …" : "Legende speichern"}
        </button>
        <p className={`hint props-save-state ${saveState === "error" ? "dirty" : ""}`} role="status">
          {saveState === "error"
            ? "Nicht gespeichert"
            : savedInfo
              ? `Gespeichert ${savedInfo}`
              : "Wird auch automatisch gespeichert."}
        </p>
        {!bar.has("export") && (
          <button className="btn small primary" disabled={busy || exporting} onClick={() => exportFile("dxf", exportBlock, exportGeneral && Boolean(general?.kind))}
            title={exportBlock ? "Den in den Exportoptionen gewählten Abschnitt als DXF herunterladen" : "Die ganze Legende als DXF herunterladen"}>
            <Icon name="download" size={16} /> {exporting ? "Exportiert …" : "DXF herunterladen"}
          </button>
        )}
        </div>
          <LegendScopePanel key={legendId ?? "first"} value={doc.scope} info={shown?.scope_info ?? info.scope_info} disabled={busy} onChange={scope => change({ ...doc, scope })} onShowItem={(block, item) => setSel({ type: "item", block, item })} />
          <LegendPresentationPanel style={style} onChange={setStyle} />
          <LegendTextPanel value={doc.text_rules} categories={categories} disabled={busy} onChange={text_rules => change({ ...doc, text_rules })} />
          <LegendVariantPanel value={doc.variant_rules} info={shown?.variant_info ?? info.variant_info} onChange={variant_rules => change({ ...doc, variant_rules })} />
          <LegendPalettePanel entries={doc.blocks.map(block => ({ id: block.id, title: block.title, color: block.style.header }))} threshold={doc.color_review?.threshold ?? 10} onThreshold={threshold => change({ ...doc, color_review: { threshold } })} onSelect={id => setSel({ type: "block", block: id })} grayscale={grayscale} onGrayscale={setGrayscale} />
          <LegendDefaultsPanel projectId={projectId} doc={doc} onApply={defaults => change({ ...doc, ...defaults })} />
          {onOpenTool && <button type="button" className="btn small" disabled={busy || exporting || layoutBusy} onClick={() => void exportFile("pdf", exportBlock, exportGeneral && Boolean(general?.kind), true)}>An PDF-Werkstatt übergeben</button>}
          <details className="legend-section legend-selection-details" open><summary><SlidersHorizontal size={15} aria-hidden="true" className="legend-section-icon" /><span className="legend-section-heading"><span className="legend-section-title">{sel && sel.type !== "legend" ? "Ausgewähltes Element" : "Weitere Einstellungen"}</span></span><ChevronDown size={15} aria-hidden="true" className="legend-section-chevron" /></summary>
          {selectedGroup && selectedGroup.source_ids.length > 1 && <div className="legend-source-context"><strong>Gemeinsame Ausgabe · Originaleintrag wählen</strong>{selectedGroup.source_ids.map(id => {
            const source = selBlock?.items.find(item => item.id === id);
            return source ? <button type="button" className="btn small" key={id} aria-pressed={id === selItem?.id} onClick={() => setSel({ type: "item", block: selectedGroup.block, item: id })}>{source.text}</button> : null;
          })}</div>}
          {sel?.type === "general" ? (
            <GeneralProps doc={doc} general={general} company={info.company} change={change} />
          ) : sel?.type === "general-row" ? (
            <GeneralRowProps
              row={general?.rows?.find((r) => r.id === sel.id) ?? null}
              admin={info.company.is_admin}
              sourceLook={Boolean(doc.style.general_source_look)}
              onCompanyLook={() => setStyle({ general_source_look: false })}
              onSave={async (patch) => {
                const row = general?.rows?.find((r) => r.id === sel.id);
                if (!row?.key) return;
                await api.saveGeneralRow({ key: row.key, ...patch });
                const g = await api.legendGeneral(projectId);
                setGeneral(g);
                setGeneralRev((n) => n + 1);
              }}
              notify={notify}
            />
          ) : sel?.type === "title" ? (
            <TitleProps doc={doc} field={field} change={change} />
          ) : selItem && selBlock ? (
            <>
            {selectedSource?.synthetic && originalEdit !== originalEditKey ? <div className="legend-source-context" role="status"><strong>Automatische Variantenansicht</strong><p>Die sichtbare Zeichnung entsteht aus einer Variantenregel. Sie ist kein eigener gespeicherter Eintrag.</p><p>Die Ausgangszeile «{entryText(selItem)}» bleibt erhalten. Ihre Bearbeitung ändert nicht automatisch jede ergänzte Katalogvariante.</p><button type="button" className="btn small" onClick={() => setOriginalEdit(originalEditKey)}>Ausgangszeile bewusst bearbeiten</button></div> : <>
            {(selectedSource?.initialPart ?? 0) > 0 && <p className="hint legend-source-context">Gefilterte Darstellung: Der sichtbare Teil dieser gespeicherten Kombination ist ausgewählt.</p>}
            {pick && (
              <CombineBox doc={doc} first={selItem} second={pick}
                onCombine={() => {
                  change(combineItems(doc, { block: selBlock.id, item: selItem.id }, pick));
                  setPick(null);
                  notify("Zu einem Eintrag kombiniert. «Trennen» macht wieder einzelne Einträge daraus.");
                }}
                onCancel={() => setPick(null)} />
            )}
            <ItemProps
              key={`${selItem.id}:${selectedSource?.initialPart ?? 0}`}
              initialPart={selectedSource?.initialPart ?? 0}
              item={selItem}
              block={selBlock}
              doc={doc}
              render={selItem.kind === "symbol" ? symbols[symbolRequestKey(selItem)] : undefined}
              stale={stale.has(selItem.id)}
              duplicate={dups.has(selItem.id)}
              onRotate={(step) => change(rotateItem(doc, selBlock.id, selItem.id, step))}
              onMirror={() => change(updateItem(doc, selBlock.id, selItem.id, { mirror: !selItem.mirror }))}
              templateTexts={info.template_texts}
              field={field}
              change={change}
              notify={notify}
              companyText={companyKey(selItem) ? descriptions[companyKey(selItem)!] ?? null : null}
              onDescription={(fam, text) => setInfo((i) => (i ? { ...i, descriptions: { ...i.descriptions, [fam]: text } } : i))}
              companySymbol={selItem.family_key ? companySymbols[selItem.family_key] ?? null : null}
              onCompanySymbols={(symbols, fam, text) => setInfo((i) => (i ? {
                ...i, company_symbols: symbols, descriptions: text ? { ...i.descriptions, [fam]: text } : i.descriptions,
              } : i))}
              onMoveTo={(to) => {
                change(moveItemToBlock(doc, selBlock.id, selItem.id, to));
                setSel({ type: "item", block: to, item: selItem.id });
              }}
              onMove={moveSelected}
              onRemove={removeSelected}
            />
            </>}
            </>
          ) : sel?.type === "block" && selBlock ? (
            <BlockProps block={selBlock} field={field} change={change} doc={doc} onMove={moveSelected} onRemove={removeSelected} catTitle={catTitle} templateTexts={info.template_texts} />
          ) : (
            <DocProps
              doc={doc}
              info={info}
              field={field}
              setStyle={setStyle}
              onCompact={applyCompact}
              onA4={applyA4}
              projectId={projectId}
              notify={notify}
              exportBlock={exportBlock}
              setExportBlock={setExportBlock}
              exportGeneral={exportGeneral}
              setExportGeneral={setExportGeneral}
              hasGeneral={Boolean(general?.kind)}
              exporting={exporting}
              onExport={exportFile}
            />
          )}
          </details>
        </aside>
      </div>
    </div>
    </>
  );
}

// -- sheet primitives -----------------------------------------------------------------------

function Prim({
  p,
  symbols,
  general,
  sel,
  pick,
  stale,
  dups,
  variants,
  onSelect,
  onDragStart,
  inert,
}: {
  p: LegendPrim;
  symbols: Record<string, SymbolRender>;
  general: (GeneralInfo & { svg: string; prims: LegendPrim[] }) | null;
  sel: Selection;
  pick?: string;
  stale: Set<string>;
  dups?: Set<string>;
  variants?: Set<string>;
  onSelect: (s: Selection, add?: boolean) => void;
  onDragStart?: (e: ReactPointerEvent, block: string, item: string) => void;
  inert?: boolean;
}) {
  switch (p.t) {
    case "rect":
      if (p.role === "general") {
        if (p.rows) return null;                 // drawn row by row (prims "grow")
        if (general?.kind === "dxf" && general.svg)
          return <image x={p.x} y={p.y} width={p.w} height={p.h} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(general.svg)}`} preserveAspectRatio="xMinYMin meet" />;
        if (general?.kind === "project")
          return (
            <g transform={`translate(${p.x} ${p.y}) scale(${p.fit ?? 1})`}>
              {general.prims.map((q, i) => (
                <Prim key={i} p={q} symbols={symbols} general={null} sel={null} stale={new Set()} onSelect={() => undefined} inert />
              ))}
            </g>
          );
        return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#f5f5f5" stroke="#bbb" strokeWidth={0.2} strokeDasharray="1 1" />;
      }
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill ?? "none"} stroke={p.stroke ?? "none"} strokeWidth={p.stroke ? 0.25 : 0} pointerEvents="none" />;
    case "text":
      return (
        <text x={p.x} y={p.y} fontSize={p.size} fontWeight={p.bold ? 700 : 400} fill={p.color} pointerEvents="none">
          {p.text}
        </text>
      );
    case "line":
      // the pattern comes from the layout (same rule as the DXF): it stays readable at any size
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={0.35}
        strokeDasharray={(p.dash?.length ? p.dash.join(" ") : DASH[p.style as LineStyle]) || undefined} strokeLinecap="round" pointerEvents="none" />;
    case "half":
      return (
        <g pointerEvents="none">
          <circle cx={p.cx} cy={p.cy} r={p.r} fill="none" stroke={p.color} strokeWidth={0.18} />
          <path d={`M${p.cx} ${p.cy - p.r} A${p.r} ${p.r} 0 0 1 ${p.cx} ${p.cy + p.r} Z`} fill={p.color} />
        </g>
      );
    case "symbol": {
      const r = symbols[symbolRequestKey({ symbol_key: p.key, length_mm: p.length_mm, width_mm: p.width_mm, flat: Boolean(p.flat) })];
      if (!r?.svg || !r.box)
        return (
          <g pointerEvents="none">
            <rect x={p.x0 ?? p.cx - p.w / 2} y={p.y0 ?? p.cy - p.h / 2} width={p.w} height={p.h} fill="none" stroke="#999" strokeWidth={0.15} strokeDasharray="0.6 0.4" />
            <title>{r ? "Keine Symbolvorschau verfügbar" : "lädt …"}</title>
          </g>
        );
      // The drawing keeps its own colours. Its insertion point (ax, ay; Nova y up) sits on the
      // symbol axis; turned around that point, counter-clockwise like the DXF.
      // Parts without own colour take the section colour (currentColor), areas next to
      // coloured lines its lighter tone; own colours stay. Mirrored left-right, then turned.
      const ax = p.ax ?? r.box[0] + r.box[2] / 2;
      const ay = p.ay ?? -(r.box[1] + r.box[3] / 2);
      const color: string = p.color || "#000000";
      return (
        <g
          transform={`translate(${p.cx} ${p.cy}) rotate(${-(p.rot || 0)}) scale(${(p.mirror ? -1 : 1) * p.scale} ${p.scale}) translate(${-ax} ${ay})`}
          pointerEvents="none"
          style={{ color, ["--sym-layer" as string]: tint(color, 0.45) }}
          dangerouslySetInnerHTML={{ __html: innerSvg(r.svg) }}
        />
      );
    }
    case "grow": {
      // one row graphic of the general part. A long stroke is drawn at symbol size and
      // cut at the tile, so the symbol itself stays as large as the other sections.
      const r = general?.row_svgs?.[p.row];
      if (!r) return null;
      if (p.draw_w && p.draw_h) {
        return <g transform={`translate(${p.x + p.w / 2} ${p.y + p.h / 2}) rotate(${-Number(p.rot || 0)})`} pointerEvents="none">
          <svg x={-p.draw_w / 2} y={-p.draw_h / 2} width={p.draw_w} height={p.draw_h} viewBox={r.vb}
            preserveAspectRatio="xMidYMid meet" overflow="visible" dangerouslySetInnerHTML={{ __html: r.svg }} />
        </g>;
      }
      const fullW = Number(p.full_w) || p.w;
      const fullH = Number(p.full_h) || p.h;
      const crop = fullW > p.w + 0.05 || fullH > p.h + 0.05;
      const fx = Number(p.fx) || 0;
      const fy = Number(p.fy) || 0;
      const innerX = crop ? -(fx * fullW) : 0;
      const innerY = crop ? -((1 - fy - p.h / fullH) * fullH) : 0;
      const graphic = (
        <svg x={p.x} y={p.y} width={p.w} height={p.h} overflow={crop ? "hidden" : "visible"} pointerEvents="none">
          <svg x={innerX} y={innerY} width={fullW} height={fullH} viewBox={r.vb} preserveAspectRatio="xMidYMid meet" overflow="visible"
            dangerouslySetInnerHTML={{ __html: r.svg }} />
        </svg>
      );
      const rot = Number(p.rot) || 0;
      if (!rot) return graphic;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      return (
        <g transform={`translate(${cx} ${cy}) rotate(${-rot}) translate(${-cx} ${-cy})`} pointerEvents="none">
          {graphic}
        </g>
      );
    }
    case "hit": {
      if (inert) return null;
      const selected =
        (p.kind === "item" && sel?.type === "item" && sel.item === p.id) ||
        (p.kind === "block" && sel?.type === "block" && sel.block === p.id) ||
        (p.kind === "general" && sel?.type === "general") ||
        (p.kind === "general-row" && sel?.type === "general-row" && sel.id === p.id) ||
        (p.kind === "title" && sel?.type === "title");
      const isStale = p.kind === "item" && stale.has(p.id);
      const picked = p.kind === "item" && pick === p.id;
      const isDup = p.kind === "item" && Boolean(dups?.has(p.id));
      const multiColor = p.kind === "item" && Boolean(variants?.has(p.id));
      if (p.kind === "section")
        return (
          <rect
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            fill="transparent"
            data-hit="section"
            data-block={p.block}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ type: "block", block: p.block });
            }}
          />
        );
      return (
        <rect
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill={selected || picked ? "rgba(11,107,203,0.10)" : "transparent"}
          stroke={multiColor ? "#e8590c" : selected || picked ? "#0b6bcb" : isDup ? "#e8590c" : isStale ? "#c92a2a" : "none"}
          strokeWidth={0.3}
          strokeDasharray={picked ? "1 0.5" : (isStale || isDup) && !selected ? "0.8 0.5" : undefined}
          className="lg-hit"
          data-hit={p.kind}
          data-block={p.block ?? undefined}
          data-id={p.id}
          data-layer-variants={multiColor || undefined}
          onPointerDown={p.kind === "item" && onDragStart ? (e) => onDragStart(e, p.block, p.id) : undefined}
          onClick={(e) => {
            e.stopPropagation();
            const add = e.ctrlKey || e.metaKey || e.shiftKey;
            onSelect(
              p.kind === "item"
                ? { type: "item", block: p.block, item: p.id }
                : p.kind === "block"
                  ? { type: "block", block: p.block }
                  : p.kind === "general-row"
                    ? { type: "general-row", id: p.id }
                    : p.kind === "title"
                      ? { type: "title" }
                      : { type: "general" },
              add,
            );
          }}
        >
          <title>
            {p.kind === "general"
              ? "Kategorie des Allgemeinteils"
              : p.kind === "general-row"
                ? "Anklicken zum Bearbeiten"
                : isDup
                ? "doppelt: Dieses Symbol steht schon weiter oben in der Legende"
                : isStale
                  ? "Kommt in den aktuellen Importen nicht vor"
                  : p.kind === "item"
                    ? "Anklicken zum Bearbeiten, ziehen zum Verschieben"
                    : "Anklicken zum Bearbeiten"}
          </title>
        </rect>
      );
    }
    default:
      return null;
  }
}

/** Grid of one section: the placeholders the entries sit in (rows in the chosen step,
 *  column edges, symbol axis and text line of every column). From the layout, so the
 *  lines match the entries exactly. */
function GridLines({ g }: { g: LegendPrim }) {
  // one slot per entry (tile or grid row), then the gap between entries
  const slot: number = g.slot ?? g.row;
  const gap: number = g.gap ?? 0;
  const step = slot + gap;
  const tops: number[] = [];
  for (let y = g.y; y < g.y + g.h - 1e-6; y += step) tops.push(y);
  const cols = Array.from({ length: g.cols }, (_, c) => g.x + c * g.colw);
  const tile: number | null = g.tile ?? null;
  return (
    <g className="lg-grid" strokeWidth={0.07} pointerEvents="none" data-step={g.row}>
      <g stroke="#5b87b5" strokeOpacity={0.45}>
        {tops.map((y) => (
          <g key={`y${y}`}>
            <line x1={g.x} y1={y} x2={g.x + g.w} y2={y} />
            <line x1={g.x} y1={y + slot} x2={g.x + g.w} y2={y + slot} />
          </g>
        ))}
        {[...cols, g.x + g.w].map((x) => (
          <line key={`c${x}`} x1={x} y1={g.y} x2={x} y2={g.y + g.h} />
        ))}
      </g>
      {gap > 0 && (
        <g fill="#e8590c" fillOpacity={0.08} stroke="#e8590c" strokeOpacity={0.55} strokeDasharray="0.5 0.4">
          {tops.slice(0, -1).map((y) => (
            <rect key={`gap${y}`} x={g.x} y={y + slot} width={g.w} height={gap}>
              <title>Abstand zwischen Einträgen</title>
            </rect>
          ))}
        </g>
      )}
      {tile && (
        <g stroke="#2b8a3e" strokeOpacity={0.5} fill="none">
          {(g.frames as { x: number; y: number; w: number; h: number }[] | undefined)?.map((r, i) => (
            <rect key={`f${i}`} x={r.x} y={r.y} width={r.w} height={r.h} />
          )) ?? cols.flatMap((x) =>
            tops.map((y) => <rect key={`t${x}-${y}`} x={x + g.axis - tile / 2} y={y + (slot - tile) / 2} width={tile} height={tile} />),
          )}
        </g>
      )}
      <g stroke="#5b87b5" strokeOpacity={0.45} strokeDasharray="0.6 0.6">
        {cols.map((x) => (
          <g key={`a${x}`}>
            <line x1={x + g.axis} y1={g.y} x2={x + g.axis} y2={g.y + g.h} />
            <line x1={x + g.text} y1={g.y} x2={x + g.text} y2={g.y + g.h} />
          </g>
        ))}
      </g>
    </g>
  );
}

/** Prims in drawing order, the ones of one entry (symbol, texts, hit area) together. */
function groupByEntry(prims: LegendPrim[]): { item: string | null; prims: LegendPrim[] }[] {
  const out: { item: string | null; prims: LegendPrim[] }[] = [];
  const byItem = new Map<string, { item: string | null; prims: LegendPrim[] }>();
  for (const p of prims) {
    const item: string | undefined =
      p.t === "symbol" || (p.t === "hit" && p.kind === "item") ? p.id : p.t === "text" || p.t === "line" || p.t === "half" ? p.item : undefined;
    if (!item) {
      out.push({ item: null, prims: [p] });
      continue;
    }
    let g = byItem.get(item);
    if (!g) {
      g = { item, prims: [] };
      byItem.set(item, g);
      out.push(g);
    }
    g.prims.push(p);
  }
  return out;
}

/** The cell a dragged entry will take, in the preview where the others already made room. */
function DropCell({ layout, id }: { layout: LegendLayout; id: string }) {
  const c = layout.prims.find((p) => p.t === "cell" && p.id === id);
  if (!c) return null;
  return (
    <rect x={c.x + 0.3} y={c.y + 0.3} width={c.w - 0.6} height={c.h - 0.6} rx={0.8} fill="rgba(11,107,203,0.12)"
      stroke="#0b6bcb" strokeWidth={0.5} pointerEvents="none" />
  );
}

/** Blue line where a dragged entry will land. */
function DropMarker({ placed, target, doc }: { placed: LegendLayout; target: DropTarget; doc: LegendDoc }) {
  const hits = placed.prims.filter((p) => p.t === "hit");
  let x = 0;
  let y = 0;
  let w = 0;
  const before = target.before ? hits.find((h) => h.kind === "item" && h.id === target.before) : null;
  if (before) {
    [x, y, w] = [before.x, before.y, before.w];
  } else {
    const items = doc.blocks.find((b) => b.id === target.block)?.items.filter((it) => !it.hidden) ?? [];
    const last = items.length ? hits.find((h) => h.kind === "item" && h.id === items[items.length - 1].id) : null;
    const section = hits.find((h) => h.kind === "section" && h.block === target.block);
    if (last) [x, y, w] = [last.x, last.y + last.h, last.w];
    else if (section) [x, y, w] = [section.x, section.y + section.h - 1, section.w];
    else return null;
  }
  return <line x1={x} y1={y} x2={x + w} y2={y} stroke="#0b6bcb" strokeWidth={0.6} pointerEvents="none" />;
}

/** Small symbol icon for the lists on the left: the same drawing as on the sheet. */
function SymIcon({ r, color = "#000000" }: { r?: SymbolRender; color?: string }) {
  if (!r?.svg || !r.box) return <span className="sym-icon empty" aria-hidden />;
  // the icon sits on white: draw it in the section colour (black outside a section),
  // never in the light text colour of the dark theme
  return (
    <svg className="sym-icon" viewBox={r.box.join(" ")} aria-hidden style={{ color, ["--sym-layer" as string]: tint(color, 0.45) }}
      dangerouslySetInnerHTML={{ __html: innerSvg(r.svg) }} />
  );
}

/** Source-colour repetitions belong to one logical apparatus. Semantic parts
 * get independent controls, so choosing red never removes its UP/AP partner. */
function ColorVariantChoice({ source, label, onChoose, overridden = false }: {
  source: LayerColorSource;
  label: string;
  onChoose: (colors: string[]) => void;
  overridden?: boolean;
}) {
  const colors = legendLayerColors(source);
  if (colors.length < 2) return null;
  const visible = legendVisibleLayerColors(source);
  const selected = overridden ? "override" : visible.length === colors.length ? "all" : visible.length === 1 ? visible[0] : "subset";
  const colorName = (index: number) => `Farbe ${index < 26 ? String.fromCharCode(65 + index) : index + 1}`;
  return <div className="field legend-color-variant-field">
    <span>Farbvarianten <InfoTip text="Alle zeigt die Originalfarben nebeneinander. Mit Nur Farbe A/B zeigst du eine Quellfarbe dieses Symbols. Die Auswahl wird in dieser Legende gespeichert und auch exportiert. Die anderen Originalfarben bleiben erhalten; weitere kombinierte Apparate werden nicht entfernt. Eine eigene Symbolfarbe wird bei dieser Auswahl zurückgesetzt." /></span>
    <div className="legend-color-options" role="group" aria-label={label}>
      {colors.length > 4 ? <select className="select" aria-label={label} value={selected} onChange={event => onChoose(event.target.value === "all" ? [] : [event.target.value])}>
        <option value="all">Alle Farben</option>
        {(selected === "override" || selected === "subset") && <option value={selected} disabled>{selected === "override" ? "Eigene Symbolfarbe aktiv" : `${visible.length} Farben gewählt`}</option>}
        {colors.map((color, index) => <option key={color} value={color}>Nur {colorName(index)} · {color.toUpperCase()}</option>)}
      </select> : <>
        <button type="button" aria-pressed={selected === "all"} onClick={() => onChoose([])}>Alle</button>
        {colors.map((color, index) => <button key={color} type="button" aria-pressed={selected === color} title={color.toUpperCase()} onClick={() => onChoose([color])}>
          <span className="legend-choice-swatch" style={{ background: color }} aria-hidden="true" />Nur {colorName(index)}
        </button>)}
      </>}
    </div>
    {overridden && <small className="hint">Eigene Symbolfarbe aktiv</small>}
  </div>;
}

/** Mix a colour with white (share 0 = colour, 1 = white). */
function tint(color: string, share: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return `#${[1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16))
    .map((c) => Math.round(c + (255 - c) * share).toString(16).padStart(2, "0"))
    .join("")}`;
}

function innerSvg(svg: string): string {
  const start = svg.indexOf(">") + 1;
  const end = svg.lastIndexOf("</svg>");
  return svg.slice(start, end > start ? end : undefined);
}

// -- property panels ------------------------------------------------------------------------

type FieldFn = (apply: (d: LegendDoc, value: string) => LegendDoc) => {
  onFocus: () => void;
  onChange: (e: { target: { value: string } }) => void;
  onBlur: () => void;
};

/** Number field: one change (one undo step) when leaving the field or pressing Enter. */
function NumberInput({
  value,
  step,
  placeholder,
  label,
  min,
  max,
  disabled,
  onCommit,
}: {
  value: number | null;
  step: number;
  placeholder?: string;
  label?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => setText(value == null ? "" : String(value)), [value]);
  const done = () => {
    const raw = Number(text.replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(raw)) {
      setText(value == null ? "" : String(value));
      return;
    }
    const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, raw));
    setText(String(v)); // show the value that applies, e.g. 210 after typing 250
    if (v !== value) onCommit(v);
  };
  return (
    <input
      className="input"
      inputMode="decimal"
      aria-label={label}
      value={text}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (!disabled) done(); }}
      onKeyDown={(e) => e.key === "Enter" && !disabled && done()}
    />
  );
}

function ItemProps({
  item,
  block,
  doc,
  render,
  stale,
  duplicate,
  onRotate,
  onMirror,
  templateTexts,
  field,
  change,
  notify,
  companyText,
  onDescription,
  companySymbol,
  onCompanySymbols,
  onMoveTo,
  onMove,
  onRemove,
  initialPart = 0,
}: {
  item: LegendItem;
  block: LegendBlock;
  doc: LegendDoc;
  render?: SymbolRender;
  stale: boolean;
  duplicate: boolean;
  onRotate: (step: number) => void;
  onMirror: () => void;
  templateTexts: string[];
  field: FieldFn;
  change: (d: LegendDoc) => void;
  notify: (text: string, error?: boolean) => void;
  companyText: string | null;
  onDescription: (familyKey: string, text: string) => void;
  companySymbol: CompanySymbolLook | null;
  onCompanySymbols: (symbols: Record<string, CompanySymbolLook>, familyKey: string, text: string) => void;
  onMoveTo: (blockId: string) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  initialPart?: number;
}) {
  const [suggest, setSuggest] = useState<{ text: string; source: string }[]>([]);
  const [tab, setTab] = useState(initialPart);
  const set = (patch: Partial<LegendItem>) => change(updateItem(doc, block.id, item.id, patch));

  async function saveCompanyText() {
    const text = item.text.trim();
    const key = companyKey(item);
    if (!key || !text) return;
    try {
      await api.setDescription(key, text);
      onDescription(key, text);
      notify("Als Firmentext gespeichert. Gilt beim Hinzufügen und bei neuen Vorschlägen in allen Projekten.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }

  const symbolParts = (item.parts ?? []).filter((x) => x.family_key);
  const sameLook = Boolean(companySymbol) && companySymbol!.symbol_factor === item.symbol_factor
    && companySymbol!.rotation === (item.rotation || 0) && companySymbol!.mirror === Boolean(item.mirror)
    && JSON.stringify(companySymbol!.parts.map((x) => x.family_key)) === JSON.stringify(symbolParts.map((x) => x.family_key));

  async function saveCompanySymbol() {
    if (!item.family_key) return;
    try {
      const r = await api.saveCompanySymbol({
        family_key: item.family_key, text: item.text.trim() || undefined, category: block.category_id || null,
        symbol_factor: item.symbol_factor, rotation: item.rotation || 0, mirror: Boolean(item.mirror),
        parts: symbolParts.map((x) => ({ family_key: x.family_key!, symbol_factor: x.symbol_factor, rotation: x.rotation || 0, mirror: Boolean(x.mirror) })),
      });
      onCompanySymbols(r.symbols, item.family_key, item.text.trim());
      notify("Als Firmensymbol gespeichert: Text, Abschnitt, Grösse, Drehung" + (symbolParts.length ? " und Kombination" : "")
        + " gelten in allen Projekten ab dem nächsten Vorschlag.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }

  useEffect(() => {
    let alive = true;
    if (item.kind !== "symbol") return;
    api
      .legendTexts(item.text, item.family_key ?? "")
      .then((r) => alive && setSuggest(r.items))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const listId = `lg-texts-${item.id}`;
  const title = { symbol: "Symbol", line: "Linie", note: "Hinweis", text: "Freier Text", gap: "Leere Zelle" }[item.kind];
  const parts = item.parts ?? [];
  const tabIndex = tab <= parts.length ? tab : 0;
  const tabs = parts.length ? (
    <div className="part-tabs" role="tablist" aria-label="Symbole dieses Eintrags">
      {[item.text, ...parts.map((x) => x.text)].map((t, k) => (
        <button key={k} role="tab" aria-selected={tabIndex === k} className={`part-tab ${tabIndex === k ? "active" : ""}`}
          onClick={() => setTab(k)} title={t || `Symbol ${k + 1}`}>
          {`Text ${k + 1} / Symbol ${k + 1}`}
        </button>
      ))}
    </div>
  ) : null;
  const splitBox = parts.length ? (
    <div className="row" style={{ gap: 6, margin: "6px 0 10px" }}>
      <span className="hint" style={{ flex: 1 }}>Kombiniert: «{entryText(item)}»</span>
      <button className="btn small" onClick={() => { setTab(0); change(splitItem(doc, block.id, item.id)); }}
        title="Jedes Symbol wieder als eigener Eintrag">
        Trennen
      </button>
    </div>
  ) : null;
  if (tabIndex > 0) {
    const k = tabIndex - 1;
    return (
      <>
        <h4>{title}</h4>
        {tabs}
        {splitBox}
        <PartProps part={parts[k]} index={k} item={item} block={block} doc={doc} field={field} change={change} />
      </>
    );
  }
  return (
    <>
      <h4>{title}</h4>
      {tabs}
      {splitBox}
      {item.kind === "text" && <details className="legend-help"><summary>ⓘ Freier Text</summary><div>{FREE_TEXT_HINT}</div></details>}
      {stale && <p className="warn-text">Dieser Apparat kommt in den gewählten Geschossen beziehungsweise aktuellen Importen nicht vor.</p>}
      {duplicate && <p className="warn-text">doppelt: Dieses Symbol steht schon weiter oben in der Legende.</p>}
      {item.hidden && (
        <div className="info-line company">
          Ausgeblendet: Der Allgemeinteil zeigt diesen Apparat schon. Der Eintrag ist nicht gelöscht.{" "}
          <button className="btn small" onClick={() => set({ hidden: false, keep: true })}>
            Wieder zeigen
          </button>
        </div>
      )}
      {item.kind === "symbol" && !parts.length && (
        <details className="legend-help"><summary>Symbole kombinieren</summary><div>Strg+Klick auf ein zweites Kästchen wählt beide Einträge. Die Symbole stehen nach dem Kombinieren vollständig nebeneinander, zum Beispiel «Decke / Wand».</div></details>
      )}
      <label className="field">
        <span>{item.kind === "text" ? "Text" : parts.length ? "Text 1" : "Beschreibung"}</span>
        <input className="input" data-legend-text={item.id} list={listId} value={item.text} {...field((d, v) => updateItem(d, block.id, item.id, { text: v }))} />
        <datalist id={listId}>
          {[...suggest.map((s) => s.text), ...templateTexts].filter((t, i, a) => a.indexOf(t) === i).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      {suggest.length > 0 && (
        <div className="suggest-list">
          <span className="hint">Vorschläge:</span>
          {suggest.slice(0, 4).map((s) => (
            <button key={s.text} className="chip-btn" onClick={() => set({ text: s.text })} title={s.source}>
              {s.text}
            </button>
          ))}
        </div>
      )}
      {companyKey(item) && (
        <div className={`company-text ${companyText !== null && companyText === item.text.trim() ? "is-company" : ""}`}>
          {companyText !== null && companyText === item.text.trim() ? (
            <span className="company-state">✓ Das ist der Firmentext</span>
          ) : companyText !== null ? (
            <>
              <span className="company-state">Firmentext: «{companyText}»</span>
              <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                <button className="btn small" onClick={() => set({ text: companyText })} title="Den Firmentext in diesen Eintrag übernehmen">
                  Firmentext übernehmen
                </button>
                <button className="btn small" onClick={saveCompanyText} title="Den Text dieses Eintrags als neuen Firmentext speichern, für alle Projekte">
                  Diesen Text als Firmentext
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="company-state muted">Text aus Schablone <InfoTip text="Ein Firmentext wird für zukünftige Vorschläge und neu hinzugefügte Einträge verwendet. Bestehende Projekte werden nicht automatisch überschrieben." /></span>
              <button className="btn small" onClick={saveCompanyText} title="Gilt beim Hinzufügen und bei neuen Vorschlägen in allen Projekten">
                Als Firmentext speichern
              </button>
            </>
          )}
        </div>
      )}
      <div className="form two">
        <label className="field">
          <span>Textgrösse (Faktor)</span>
          <NumberInput label="Textgrösse Faktor" value={item.text_scale ?? 1} step={0.1} onCommit={(v) => set({ text_scale: Math.max(0.5, Math.min(3, v)) })} />
        </label>
        {(item.kind === "symbol" || item.kind === "note" || item.kind === "line") && (
          <label className="field">
            <span>Symbolgrösse (Faktor)</span>
            <NumberInput label="Symbolgrösse Faktor" value={item.symbol_factor ?? 1} step={0.1} onCommit={(v) => set({ symbol_factor: Math.max(0.3, Math.min(4, v)) })} />
          </label>
        )}
        {item.kind === "symbol" && (
          <div className="field">
            <span>
              Drehung {item.rotation || 0}°{item.mirror ? " · gespiegelt" : ""}
            </span>
            <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
              <button className="btn small" onClick={() => onRotate(45)} title="Um 45 Grad drehen. Der Text bleibt waagrecht.">
                ↻ 45°
              </button>
              <button className="btn small" onClick={() => onRotate(90)} title="Um 90 Grad drehen. Der Text bleibt waagrecht.">
                ↻ 90°
              </button>
              <button className={`btn small ${item.mirror ? "primary" : ""}`} aria-pressed={Boolean(item.mirror)} onClick={onMirror} title="Links-rechts spiegeln">
                ⇋ Spiegeln
              </button>
            </div>
          </div>
        )}
      </div>
      <details className="legend-help"><summary>Grösse und Massstab</summary><div>Faktor 1 verwendet die gemeinsame Grösse. Faktor 1,2 vergrössert diesen Eintrag; seine Zeile wächst bei Bedarf mit.</div></details>
      {item.kind === "symbol" && <ColorVariantChoice source={item} label="Farbvarianten Symbol 1" overridden={Boolean(item.symbol_color)} onChoose={colors => set({ visible_layer_colors: colors, symbol_color: "" })} />}
      {(item.kind === "symbol" || item.kind === "line" || item.kind === "note") && (
        <div className="field">
          <span>Symbolfarbe</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="color"
              aria-label="Symbolfarbe"
              value={item.symbol_color || legendVisibleLayerColors(item)[0] || block.style.symbol || "#000000"}
              onChange={(e) => set({ symbol_color: e.target.value })}
            />
            <button
              className="btn small"
              onClick={() => set({ symbol_color: block.style.symbol })}
              title="Das ganze Symbol in der Farbe dieses Abschnitts zeichnen"
            >
              Abschnittsfarbe
            </button>
            {item.symbol_color && (
              <button className="btn small" onClick={() => set({ symbol_color: "" })} title="Zurück zur automatischen Farbe">
                Layerfarben
              </button>
            )}
          </div>
          {legendItemColors(item).length > 0 && <div className="legend-layer-variants" aria-label="Original-Layerfarben">
            <span className={legendItemColors(item).length > 1 ? "badge layer-variant-badge" : "hint"}>{legendItemColors(item).length} Layerfarbe{legendItemColors(item).length === 1 ? "" : "n"}</span>
            <span className="legend-layer-swatches">{legendItemColors(item).map(color => <span key={color} className={`legend-layer-swatch ${legendVisibleItemColors(item).includes(color) ? "" : "is-omitted"}`} style={{ background: color }} title={`${color}${legendVisibleItemColors(item).includes(color) ? "" : " · nicht dargestellt"}`} />)}</span>
          </div>}
          <details className="legend-help"><summary>Layerfarben und eigene Farbe</summary><div>Die Originalfarben bleiben gespeichert. Unter Farbvarianten wählst du für dieses Symbol alle Farben oder eine einzelne Farbe; die Auswahl gilt auch im Export. Kombinierte Apparate behalten ihre jeweils eigene Auswahl. Eine eigene Symbolfarbe überschreibt die Darstellung; «Layerfarben» stellt die gewählten Originalfarben wieder her. Der orange Hinweisrahmen wird nicht exportiert.</div></details>
        </div>
      )}
      {item.kind === "symbol" && item.family_key && (
        <div className={`company-text ${sameLook ? "is-company" : ""}`}>
          {sameLook ? (
            <span className="company-state">✓ Firmensymbol: so erscheint es in allen Projekten</span>
          ) : (
            <span className="company-state muted">
              {companySymbol ? "Firmensymbol gespeichert, diese Legende weicht davon ab." : "Noch kein Firmensymbol."}
            </span>
          )}
          {!sameLook && (
            <button className="btn small" onClick={saveCompanySymbol}
              title={`Text, Abschnitt «${block.title}», Grösse, Drehung, Spiegeln${symbolParts.length ? " und die kombinierten Symbole" : ""} für alle Projekte speichern. Die Farbe kommt weiter aus dem Plan.`}>
              Als Firmensymbol speichern
            </button>
          )}
        </div>
      )}
      {item.kind === "symbol" && item.family_key && (
        <CompanyCategoryField key={`${item.family_key}|${companySymbol?.at ?? ""}`} familyKey={item.family_key} notify={notify} />
      )}
      {item.kind === "symbol" && render?.engine && (
        <div className="form two">
          <label className="field">
            <span>Länge (mm, real)</span>
            <NumberInput value={item.length_mm} step={50} placeholder={String(render.length_mm ?? "")} onCommit={(v) => set({ length_mm: v > 0 ? v : null })} />
          </label>
          <label className="field">
            <span>Breite (mm, real)</span>
            <NumberInput value={item.width_mm} step={50} placeholder={String(render.width_mm ?? "")} onCommit={(v) => set({ width_mm: v > 0 ? v : null })} />
          </label>
        </div>
      )}
      {item.kind === "line" && (
        <div className="form two">
          <label className="field">
            <span>Linienart</span>
            <select className="select" value={item.line_style} onChange={(e) => set({ line_style: e.target.value as LineStyle })}>
              {(Object.keys(LINE_LABEL) as LineStyle[]).map((k) => (
                <option key={k} value={k}>
                  {LINE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Länge (mm)</span>
            <NumberInput value={item.line_length} step={1} onCommit={(v) => set({ line_length: Math.max(1, v) })} />
          </label>
        </div>
      )}
      <label className="field">
        <span>Abschnitt</span>
        <select className="select" value={block.id} onChange={(e) => onMoveTo(e.target.value)}>
          {doc.blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title || "(ohne Überschrift)"}
            </option>
          ))}
        </select>
      </label>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => onMove(-1)} title="Einen Platz nach vorne (Pfeil nach oben)">
          ↑ Nach vorne
        </button>
        <button className="btn small" onClick={() => onMove(1)} title="Einen Platz nach hinten (Pfeil nach unten)">
          ↓ Nach hinten
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn icon danger" onClick={onRemove} aria-label={item.kind === "text" ? "Text entfernen" : "Aus der Legende entfernen"} title={item.kind === "text" ? "Text entfernen" : "Aus der Legende entfernen"}>
          <TrashIcon />
        </button>
      </div>
    </>
  );
}

const COLOR_FIELDS: [keyof SectionStyle, string][] = [
  ["header", "Kopfleiste"],
  ["header_text", "Schrift Kopfleiste"],
  ["text", "Text"],
  ["symbol", "Linien und Hinweise"],
];

function BlockProps({
  block,
  doc,
  field,
  change,
  onMove,
  onRemove,
  catTitle,
  templateTexts,
}: {
  block: LegendBlock;
  doc: LegendDoc;
  field: FieldFn;
  change: (d: LegendDoc) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  catTitle: Record<string, string>;
  templateTexts: string[];
}) {
  const setStyle = (patch: Partial<SectionStyle>) => change(updateSectionStyle(doc, block.id, patch));
  return (
    <>
      <h4>Abschnitt <InfoTip text={`${block.category_id ? `Kategorie: ${catTitle[block.category_id] ?? block.category_id}. ` : ""}${block.layer ? `Ebene im Export: ${block.layer}. ` : ""}Änderungen gelten nur für diese Legende. Die Symbole behalten ihre ursprünglichen Planfarben.`} /></h4>
      <label className="field">
        <span>Überschrift</span>
        <input className="input" list="lg-headings" value={block.title} {...field((d, v) => updateBlock(d, block.id, { title: v }))} />
        <datalist id="lg-headings">
          {templateTexts.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <div className="color-grid">
        {COLOR_FIELDS.filter(([key]) => !doc.style.compact_flow || key !== "header_text").map(([key, label]) => (
          <label key={key} className="color-field">
            <input type="color" value={String(block.style[key])} onChange={(e) => setStyle({ [key]: e.target.value } as Partial<SectionStyle>)} />
            <span>{doc.style.compact_flow && key === "header" ? "Rubrikfarbe" : label}</span>
          </label>
        ))}
      </div>
      <details className="legend-help"><summary>ⓘ Rubrik und Originalfarben</summary><div>Die Rubrikfarbe markiert Überschrift und Trennlinie. Die Symbole behalten ihre eigenen Planfarben; ein roter Rubrikmarker bedeutet deshalb nicht, dass ein blauer Schalter umgefärbt wurde. Die folgende Aktion gleicht nur diese Rubrik an die häufigste Originalfarbe ihrer sichtbaren Symbole an. Bei gleich häufigen Farben bleibt die Rubrik unverändert.</div></details>
      <button className="btn small" onClick={() => {
        const selected = alignLegendSectionColors({ ...doc, blocks: [block] }).blocks[0];
        change({ ...doc, blocks: doc.blocks.map(item => item.id === block.id ? selected : item) });
      }}>Rubrikfarbe aus Symbolen</button>
      {!doc.style.compact_flow && <div className="color-grid">
        <label className="color-field">
          <input type="checkbox" checked={block.style.background_on} onChange={(e) => setStyle({ background_on: e.target.checked })} aria-label="Hintergrundfarbe an" />
          <input type="color" value={block.style.background} onChange={(e) => setStyle({ background: e.target.value })} aria-label="Hintergrundfarbe" />
          <span>Hintergrundfarbe</span>
        </label>
        <label className="color-field">
          <input type="checkbox" checked={block.style.border_on} onChange={(e) => setStyle({ border_on: e.target.checked })} aria-label="Umrandung an" />
          <input type="color" value={block.style.border} onChange={(e) => setStyle({ border: e.target.value })} aria-label="Farbe Umrandung" />
          <span>Umrandung</span>
        </label>
      </div>}
      <label className="field" style={{ marginTop: 6 }}>
        <span>Textgrösse Überschrift (Faktor)</span>
        <NumberInput value={block.title_scale ?? 1} step={0.1} onCommit={(v) => change(updateBlock(doc, block.id, { title_scale: Math.max(0.5, Math.min(3, v)) }))} />
      </label>
      {!doc.style.compact_flow && <label className="field" style={{ marginTop: 6 }}>
        <span>Innenabstand (mm)</span>
        <NumberInput value={block.style.padding} step={0.5} onCommit={(v) => setStyle({ padding: Math.max(0, Math.min(10, v)) })} />
      </label>}
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => onMove(-1)}>
          ↑ Nach oben
        </button>
        <button className="btn small" onClick={() => onMove(1)}>
          ↓ Nach unten
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn icon danger" onClick={onRemove} aria-label="Abschnitt entfernen" title="Abschnitt entfernen">
          <TrashIcon />
        </button>
      </div>
    </>
  );
}

function TitleProps({ doc, field, change }: { doc: LegendDoc; field: FieldFn; change: (d: LegendDoc) => void }) {
  const t = doc.title;
  const set = (patch: Partial<LegendDoc["title"]>) => change({ ...doc, title: { ...t, ...patch } });
  const mm = t.size_mm > 0 ? t.size_mm : 5;
  return (
    <>
      <h4>Titel <InfoTip text="Grösse, Farbe und Schriftart gelten nur für den Titel." /></h4>
      <label className="field">
        <span>Text</span>
        <input className="input" value={t.text} {...field((d, v) => ({ ...d, title: { ...d.title, text: v } }))} />
      </label>
      <label className="field">
        <span>Textgrösse (mm)</span>
        <NumberInput label="Textgrösse Titel" value={mm} step={0.25} onCommit={(v) => {
          const size = Math.max(1, Math.min(20, v));
          const base = doc.style.text_size || 1;
          set({ size_mm: size, scale: Math.max(0.5, Math.min(3, Math.round((size / base) * 100) / 100)) });
        }} />
      </label>
      <label className="field">
        <span>Schriftart</span>
        <select className="select" aria-label="Schriftart Titel" value={t.font || "Arial"} onChange={(e) => set({ font: e.target.value })}>
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
          <option value="Verdana">Verdana</option>
        </select>
      </label>
      <div className="color-grid">
        <label className="color-field">
          <input type="color" value={t.color || "#000000"} onChange={(e) => set({ color: e.target.value })} aria-label="Farbe Titel" />
          <span>Schrift</span>
        </label>
        <label className="color-field">
          <input type="checkbox" checked={Boolean(t.border_on)} onChange={(e) => set({ border_on: e.target.checked })} aria-label="Umrandung Titel an" />
          <input type="color" value={t.border || "#000000"} onChange={(e) => set({ border: e.target.value })} aria-label="Farbe Umrandung Titel" />
          <span>Umrandung</span>
        </label>
      </div>
    </>
  );
}

function generalSectionOf(doc: LegendDoc): GeneralSection {
  return doc.general_section ?? { title: "Allgemein", header: "#007f91", header_text: "#ffffff", text: "#000000", title_scale: 1 };
}

function GeneralProps({
  doc,
  general,
  company,
  change,
}: {
  doc: LegendDoc;
  general: (GeneralInfo & { svg: string }) | null;
  company: LegendInfo["company"];
  change: (d: LegendDoc) => void;
}) {
  const section = generalSectionOf(doc);
  const set = (patch: Partial<GeneralSection>) => change({ ...doc, general_section: { ...section, ...patch } });
  return (
    <>
      <h4>
        Allgemein
        <InfoTip text={"Der Allgemeinteil beginnt mit einer Überschrift mit Farbakzent. Die Farbcodes stehen kompakt direkt darunter. Eine Zeile anklicken, um Text und Grösse zu ändern. Die Zeichnung selbst bleibt die Firmenvorlage."} />
      </h4>
      <label className="field">
        <span>Titel</span>
        <input className="input" aria-label="Kategorientitel Allgemeinteil" value={section.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="color-grid">
        <label className="color-field">
          <input type="color" value={section.header || "#007f91"} onChange={event => set({ header: event.target.value })} aria-label="Akzentfarbe Allgemeinteil" />
          <span>Akzent</span>
        </label>
        <label className="color-field">
          <input type="color" value={section.text || (section.header_text !== "#ffffff" ? section.header_text : "#000000")} onChange={(e) => set({ text: e.target.value })} aria-label="Schriftfarbe Überschrift Allgemeinteil" />
          <span>Schrift</span>
        </label>
      </div>
      <label className="field">
        <span>Textgrösse Überschrift (Faktor)</span>
        <NumberInput value={section.title_scale} step={0.1} onCommit={(v) => set({ title_scale: Math.max(0.5, Math.min(3, v)) })} />
      </label>
      <details className="legend-help"><summary>ⓘ Quelle und Berechtigung</summary><div><dl className="kv">
        <dt>Quelle</dt>
        <dd style={{ wordBreak: "break-all" }}>{general?.source || "–"}</dd>
        <dt>Admins</dt>
        <dd>
          {company.is_admin && company.admins.length > 0 && <span className="admin-badge on">Du bist Admin</span>}
          {company.admins.length ? company.admins.map((name) => (
            <span key={name} className="admin-chip">★ {name}{name.toLocaleLowerCase("de-CH") === company.user.toLocaleLowerCase("de-CH") ? " (du)" : ""}</span>
          )) : "noch keine"}
        </dd>
      </dl></div></details>
    </>
  );
}

function GeneralRowProps({
  row,
  admin,
  sourceLook,
  onCompanyLook,
  onSave,
  notify,
}: {
  row: { id: string; key?: string; text: string; heading: boolean; text_scale?: number; symbol_factor?: number; rotation?: number; text_place?: "top" | "middle" | "bottom"; line?: boolean; picture?: "line" | "swatch" | "symbol" } | null;
  admin: boolean;
  sourceLook: boolean;
  onCompanyLook: () => void;
  onSave: (patch: { text?: string; text_scale?: number; symbol_factor?: number; rotation?: number; text_place?: "top" | "middle" | "bottom" }) => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [text, setText] = useState(row?.text ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(row?.text ?? ""); }, [row?.id, row?.text]);
  if (!row) return <p className="hint">Zeile nicht gefunden.</p>;
  async function save(patch: { text?: string; text_scale?: number; symbol_factor?: number; rotation?: number; text_place?: "top" | "middle" | "bottom" }) {
    setBusy(true);
    try {
      await onSave(patch);
      notify("Zeile gespeichert. Gilt in allen Legenden.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h4>{row.heading ? "Zwischenüberschrift" : "Zeile im Allgemeinteil"}</h4>
      <details className="legend-help"><summary>ⓘ Darstellung und Geltungsbereich</summary><div>
        {row.heading
          ? "Zwischenüberschrift ohne Symbol, zum Beispiel «Farbcodes». Die Lage in der Rasterzeile stellst du unten ein."
          : row.picture === "swatch"
            ? "Ein Farbcode wird als gleich grosses Farbfeld gezeichnet. Der Text steht daneben."
            : row.line
              ? "Eine Linie bleibt immer gleich lang, damit Strich, Punkt und Farbe lesbar bleiben. Die Symbolgrösse ändert sie nicht."
              : "Das Symbol wird vollständig in die Kachel gesetzt, ohne Führungslinie und ohne Beschriftung aus der Vorlage. Der Text bleibt waagrecht."}
        {admin ? " Die Änderung gilt in allen Projekten." : " Nur Admins können das ändern."}
      </div></details>
      <label className="field">
        <span>Text</span>
        <input className="input" aria-label="Text der Allgemeinteil-Zeile" value={text} disabled={!admin || busy} onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (admin && text.trim() && text !== row.text) save({ text }); }} />
      </label>
      {sourceLook && <div className="legend-source-look"><p className="hint">Diese Legende verwendet die Vorlagenwerte: Faktor 1 und keine zusätzliche Drehung. Texte und Zuordnungen bleiben erhalten.</p>
        <button className="btn small" onClick={onCompanyLook}>Gespeicherte Darstellung verwenden</button></div>}
      <fieldset disabled={sourceLook} style={{ border: 0, margin: 0, padding: 0 }}>
      <div className="form two">
        <label className="field">
          <span>Textgrösse (Faktor)</span>
          <NumberInput label="Textgrösse Faktor Allgemeinteil" value={sourceLook ? 1 : row.text_scale ?? 1} step={0.1} disabled={!admin}
            onCommit={(v) => save({ text_scale: Math.max(0.5, Math.min(3, v)) })} />
        </label>
        {!row.heading && !row.line && row.picture !== "swatch" && (
          <label className="field">
            <span>Symbolgrösse (Faktor)</span>
            <NumberInput label="Symbolgrösse Faktor Allgemeinteil" value={sourceLook ? 1 : row.symbol_factor ?? 1} step={0.1} disabled={!admin}
              onCommit={(v) => save({ symbol_factor: Math.max(0.5, Math.min(2, v)) })} />
          </label>
        )}
      </div>
      {row.heading && (
        <label className="field">
          <span>Lage in der Zeile</span>
          <select className="select" aria-label="Lage der Zwischenüberschrift" value={row.text_place || "bottom"} disabled={!admin || busy}
            onChange={(e) => save({ text_place: e.target.value as "top" | "middle" | "bottom" })}>
            <option value="top">Oben</option>
            <option value="middle">Mittig</option>
            <option value="bottom">Unten</option>
          </select>
        </label>
      )}
      {!row.heading && !row.line && row.picture !== "swatch" && (
        <div className="field">
          <span>Drehung {sourceLook ? 0 : row.rotation || 0}°</span>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            <button className="btn small" disabled={!admin || busy} onClick={() => save({ rotation: ((row.rotation || 0) + 45) % 360 })} title="Um 45 Grad drehen. Der Text bleibt waagrecht.">
              ↻ 45°
            </button>
            <button className="btn small" disabled={!admin || busy} onClick={() => save({ rotation: ((row.rotation || 0) + 90) % 360 })} title="Um 90 Grad drehen. Der Text bleibt waagrecht.">
              ↻ 90°
            </button>
            {(row.rotation || 0) !== 0 && (
              <button className="btn small" disabled={!admin || busy} onClick={() => save({ rotation: 0 })} title="Nur die zusätzliche Drehung aufheben. Die Geometrie aus der Firmenvorlage bleibt erhalten.">
                Vorlagendrehung
              </button>
            )}
          </div>
        </div>
      )}
      </fieldset>
    </>
  );
}

function DocProps({
  doc,
  info,
  field,
  setStyle,
  onCompact,
  onA4,
  projectId,
  notify,
  exportBlock,
  setExportBlock,
  exportGeneral,
  setExportGeneral,
  hasGeneral,
  exporting,
  onExport,
}: {
  doc: LegendDoc;
  info: LegendInfo;
  field: FieldFn;
  setStyle: (patch: Partial<LegendDoc["style"]>) => void;
  onCompact: () => void;
  onA4: () => void;
  projectId: string;
  notify: (text: string, error?: boolean) => void;
  exportBlock: string;
  setExportBlock: (v: string) => void;
  exportGeneral: boolean;
  setExportGeneral: (v: boolean) => void;
  hasGeneral: boolean;
  exporting: boolean;
  onExport: (format: "dxf" | "dwg" | "pdf", block: string, withGeneral: boolean) => void;
}) {
  const s = doc.style;
  const company = info.company;
  const fitted = s.symbol_fit === "corridor";
  const effectiveRow = s.compact_flow && s.grid !== "custom" ? 5 : s.row;
  const tileHeight = Math.min(s.text_size * 3.6 * s.symbol_scale, s.grid === "standard" && !s.compact_flow ? Infinity : Math.max(2.4, effectiveRow - .4));
  const tileMm = String(Math.round(tileHeight * .9 * 10) / 10).replace(".", ",");
  const sizeTip = (s.symbol_size ?? "tile") === "real"
    ? "Jedes Symbol im gemeinsamen Massstab, Einfügepunkt auf der Achse. Ein grosses Symbol belegt mehr Zeilen."
    : fitted ? `Bis ${tileMm} mm Höhe und rund 13 mm Breite. Lange Leuchten und Leitungen nutzen den breiten Symbolkorridor; Proportionen und gespeicherte Drehrichtung bleiben erhalten. Grössenfaktoren vergrössern nur bis zur Feldgrenze.`
    : `Quadratische Kachel mit bis ${tileMm} mm sichtbarer Symbolhöhe. Lange schmale Zeichnungen werden durch die Quadratbreite begrenzt.`;
  return (
    <>
      <h4>Legende <InfoTip text="Eintrag oder Kopfleiste anklicken. Ziehen oder ↑ ↓ verschiebt." /></h4>
      <label className="field">
        <span>Titel</span>
        <input className="input" value={doc.title.text} {...field((d, v) => ({ ...d, title: { ...d.title, text: v } }))} />
      </label>
      <div className="form two">
        <label className="field">
          <span>Layout <InfoTip text="Dichte wie Entwurf: drei Apparatespalten mit 2,8 mm Schrift. A4 kompakt: vier Spalten mit 2,6 mm Schrift und kleineren Rändern. Beide verwenden breite Symbolfelder statt Quadratbegrenzung. Der Allgemeinteil nutzt die Geometrie der Vorlage ohne zusätzliche gespeicherte Faktoren oder Drehungen; diese bleiben für die frühere Darstellung erhalten. Inhalte, Quellfarben und Zuordnungen bleiben erhalten. Rückgängig stellt alle vorherigen Werte wieder her. Die Höhe folgt dem Inhalt." /></span>
          <select className="select" aria-label="Legendenlayout" value={s.compact_flow ? s.columns === 4 ? "a4" : "compact" : "classic"} onChange={event => event.target.value === "compact" ? onCompact() : event.target.value === "a4" ? onA4() : setStyle({ compact_flow: false })}>
            <option value="compact">Dichte wie Entwurf</option>
            <option value="a4">A4 kompakt</option>
            <option value="classic">Klassische Abschnitte</option>
          </select>
        </label>
        <label className="field">
          <span>Schriftgrösse (mm)</span>
          <NumberInput label="Schriftgrösse" value={s.text_size} step={0.25} onCommit={(v) => setStyle({ text_size: Math.max(1, Math.min(10, v)) })} />
        </label>
        <label className="field">
          <span>Symbolmassstab</span>
          <NumberInput label="Symbolmassstab" value={s.symbol_scale} step={0.1} onCommit={(v) => setStyle({ symbol_scale: Math.max(0.2, Math.min(5, v)) })} />
        </label>
        <label className="field">
          <span>Abschnitte (mm)</span>
          <NumberInput label="Abstand zwischen Abschnitten" value={s.section_gap ?? 0} step={0.5} onCommit={(v) => setStyle({ section_gap: Math.max(0, Math.min(50, v)) })} />
        </label>
        <label className="field">
          <span>Symbolgrösse <InfoTip text={sizeTip} /></span>
          <select className="select" aria-label="Symbolgrösse" value={s.symbol_size === "real" ? "real" : fitted ? s.symbol_weight === "optical" ? "optical" : "fit" : "tile"} onChange={(e) => setStyle({ symbol_size: e.target.value === "real" ? "real" : "tile", symbol_fit: e.target.value === "fit" || e.target.value === "optical" ? "corridor" : "square", symbol_weight: e.target.value === "optical" ? "optical" : "fit" })}>
            <option value="optical">Optisch angleichen</option>
            <option value="fit">Breites Symbolfeld</option>
            <option value="tile">Quadratische Kacheln</option>
            <option value="real">Originalmassstab</option>
          </select>
        </label>
        {(s.symbol_size ?? "tile") === "tile" && !fitted && (
          <label className="toggle field" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={s.normalize_size !== false}
              onChange={(e) => setStyle({ normalize_size: e.target.checked })} />
            Gleiche Fläche <InfoTip text="Jedes Symbol bekommt dieselbe Fläche, mit einem kleinen freien Rand. Ein Kreis wirkt so nicht grösser als ein langer Balken. Aus: die längere Seite bestimmt die Grösse." />
          </label>
        )}
        <label className="field">
          <span>Einträge (mm)</span>
          <NumberInput label="Abstand zwischen Einträgen" value={s.entry_gap ?? 0} step={0.5} onCommit={(v) => setStyle({ entry_gap: Math.max(0, Math.min(20, v)) })} />
        </label>
        <label className="field">
          <span>Textzeilen <InfoTip text="«Automatisch» bricht langen Text um, die Zeile wird höher. 1 bis 3 Zeilen halten alle Einträge gleich hoch." /></span>
          <select className="select" aria-label="Textzeilen" value={String(s.text_lines ?? 0)} onChange={(e) => setStyle({ text_lines: Number(e.target.value) })}>
            <option value="0">Automatisch</option>
            <option value="1">1 Zeile</option>
            <option value="2">2 Zeilen</option>
            <option value="3">3 Zeilen</option>
          </select>
        </label>
        <label className="field">
          <span>
            Blattbreite (mm)
            <InfoTip text={`Zeichnungsbreite inklusive Innenrand. Das PDF ergänzt aussen 5 mm je Seite: 200 mm ergeben 210 mm PDF-Breite. Firmen-Standard: Schrift ${String(company.text_size).replace(".", ",")} mm, Massstab ${String(company.symbol_scale).replace(".", ",")}.`} />
          </span>
          <NumberInput label="Blattbreite" value={s.width} step={5} min={80} max={210} onCommit={(v) => setStyle({ width: v })} />
        </label>
        <label className="field">
          <span>Innenrand (mm)</span>
          <NumberInput label="Innenrand" value={s.margin ?? 5} step={0.5} min={2} max={10} onCommit={value => setStyle({ margin: Math.max(2, Math.min(10, value)) })} />
        </label>
      </div>
      {hasGeneral && <label className="toggle"><input type="checkbox" checked={Boolean(s.general_source_look)} onChange={event => setStyle({ general_source_look: event.target.checked })} />Allgemeinteil mit Vorlagenwerten <InfoTip text="Nur diese Legende: ursprüngliche Symbolausrichtung, Faktor 1 und gemeinsame Schriftgrösse. Gespeicherte zusätzliche Drehungen und Vergrösserungen bleiben in der Firmenkonfiguration erhalten und werden nach Ausschalten wieder verwendet. Die Quelldatei wird nicht verändert." /></label>}
      <div className="row">
        <label className="toggle" style={{ color: "var(--fg)" }}>
          <input type="checkbox" checked={Boolean(s.hatch_off)} onChange={(e) => setStyle({ hatch_off: e.target.checked })} />
          Weiche Schraffur aus
        </label>
        <InfoTip text="Schraffur und helle Fläche hinter Linien. Gilt für alle Symbole in Vorschau, DXF und PDF. Umrisse bleiben." />
      </div>
      <div className="row">
        <label className="toggle" style={{ color: "var(--fg)" }}>
          <input type="checkbox" checked={Boolean(s.fill_off)} onChange={(e) => setStyle({ fill_off: e.target.checked })} />
          Volle Flächen aus
        </label>
        <InfoTip text="Ganz gefüllte Teile, z. B. Anschlusspunkt oder die halbe Fläche bei AP. Gilt für alle Symbole. Umrisse bleiben." />
      </div>
      <button
        className="btn small"
        disabled={!company.is_admin}
        title={company.is_admin ? "Schriftgrösse und Symbolmassstab als Firmen-Standard für neue Projekte speichern" : `Nur Admins (${company.admins.join(", ") || "noch keine"})`}
        onClick={async () => {
          try {
            const r = await api.rememberLegend(projectId, doc);
            info.company.text_size = r.text_size;
            info.company.symbol_scale = r.symbol_scale;
            notify("Für neue Projekte gemerkt. Bestehende Projekte bleiben unverändert.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        Für neue Projekte merken
      </button>

      <div className="color-grid">
        <label className="color-field">
          <input type="checkbox" checked={Boolean(s.frame_on)} onChange={(e) => setStyle({ frame_on: e.target.checked })} aria-label="Umrandung der Legende an" />
          <input type="color" value={s.frame || "#000000"} onChange={(e) => setStyle({ frame: e.target.value })} aria-label="Farbe Umrandung der Legende" />
          <span>Umrandung</span>
          <InfoTip text="Rahmen der ganzen Legende. Für den Titel in der Liste «Titel» anklicken." />
        </label>
      </div>

      <div className="section">
        Export
        <InfoTip text={"Speichert zuerst die Legende.\nDateiname aus Bezeichnung und Abschnitt.\nPDF ist dieselbe Zeichnung, 1:1 in mm, 5 mm Rand.\nDXF R2013, Truecolor, Symbole als Blöcke. Das Blatt bleibt weiss."} />
      </div>
      <label className="field">
        <span>Was exportieren</span>
        <select className="select" value={exportBlock} onChange={(e) => setExportBlock(e.target.value)}>
          <option value="">Ganze Legende</option>
          {doc.blocks.map((b) => (
            <option key={b.id} value={b.id}>
              Nur {b.title || "(ohne Überschrift)"}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label className="toggle" style={{ color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={exportGeneral && hasGeneral}
            onChange={(e) => {
              if (!hasGeneral) {
                notify("Es ist keine Servervorlage für den Allgemeinteil eingestellt. Der Export läuft ohne ihn.", true);
                return;
              }
              setExportGeneral(e.target.checked);
            }}
          />
          Allgemeinteil zeigen
        </label>
        <InfoTip text="Gilt für diese Legende: Vorschau, DXF, DWG und PDF. Aus z. B. für eine Legende nur mit UKV. Verknüpfte DXF- oder DWG-Datei unter dem Titel. Hat sie eine Textspalte, nutzt sie Schriftgrösse, Symbolgrösse, Abstand und Spalten dieser Legende. Die Zeichnung bleibt gesperrt. N4D wird nicht gelesen." />
      </div>
      <label className="field">
        <span>Liniendicke im PDF <InfoTip text="Original: jede Linie so dick wie in der Zeichnung. Proportional: ein verkleinertes Symbol bekommt dünnere Linien, ein vergrössertes dickere (0,09 bis 0,5 mm). DXF und DWG behalten die Original-Liniendicke." /></span>
        <select className="select" aria-label="Liniendicke im PDF" value={s.pdf_lines ?? "original"}
          onChange={(e) => setStyle({ pdf_lines: e.target.value as "original" | "proportional" })}>
          <option value="original">Original-Liniendicke</option>
          <option value="proportional">Proportionale Skalierung der Liniendicke</option>
        </select>
      </label>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" disabled={exporting} onClick={() => onExport("dxf", exportBlock, exportGeneral && hasGeneral)}>
          DXF
        </button>
        <button className="btn small" disabled={exporting} onClick={() => onExport("dwg", exportBlock, exportGeneral && hasGeneral)}>
          DWG
        </button>
        <button className="btn small" disabled={exporting} onClick={() => onExport("pdf", exportBlock, exportGeneral && hasGeneral)}>
          PDF
        </button>
      </div>
      {!info.oda && (
        <p className="hint">
          DWG braucht den ODA File Converter.{" "}
          <a href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noreferrer">Herunterladen</a>
        </p>
      )}
      <button className="btn small" type="button" onClick={() => exportDiagnostic(projectId, notify)}>Prüfbericht</button>
    </>
  );
}

function formatStamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}. ${m[4]}:${m[5]}` : "";
}

/** Category of a symbol family for the whole company (as in the symbol library). */
function CompanyCategoryField({ familyKey, notify }: { familyKey: string; notify: (text: string, error?: boolean) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [state, setState] = useState<{ categories: string[]; source: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.categories(), api.familyCategories(familyKey)])
      .then(([c, f]) => {
        if (!alive) return;
        setCats(c.items);
        setState(f);
      })
      .catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
  }, [familyKey]);

  if (!state) return null;
  const manual = state.source === "manuell";
  const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
  const value = manual ? state.categories[0] ?? "" : "";
  const auto = state.categories.map((id) => byId[id]?.title ?? id).join(", ");

  async function choose(id: string) {
    setBusy(true);
    try {
      const r = await api.setFamilyCategories(familyKey, id ? [id] : null);
      setState(r);
      notify(id ? `Kategorie «${byId[id]?.title ?? id}» gespeichert (gilt für die ganze Firma)` : "Kategorie wieder automatisch");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="field">
      <span>Kategorie firmenweit</span>
      <select className="select" value={value} disabled={busy} onChange={(e) => choose(e.target.value)}
        title="Ordnet dieses Symbol für die ganze Firma einer Kategorie zu, wie in der Symbolbibliothek">
        <option value="">Automatisch{!manual && auto ? ` (${auto})` : ""}</option>
        {cats.map((c) => (
          <option key={c.id} value={c.id}>{c.parent ? `${byId[c.parent]?.title ?? ""} › ` : ""}{c.title}</option>
        ))}
      </select>
      <InfoTip text="Die firmenweite Kategorie wird beim nächsten Vorschlag verwendet. Bestehende Legenden werden nicht automatisch geändert." />
    </label>
  );
}

/** Two entries chosen: combine the second into the first («Text 1 / Text 2», symbols side by side). */
function CombineBox({ doc, first, second, onCombine, onCancel }: {
  doc: LegendDoc;
  first: LegendItem;
  second: { block: string; item: string };
  onCombine: () => void;
  onCancel: () => void;
}) {
  const other = doc.blocks.find((b) => b.id === second.block)?.items.find((x) => x.id === second.item);
  if (!other) return null;
  const ok = first.kind === "symbol" && other.kind === "symbol" && (first.parts?.length ?? 0) + 1 + (other.parts?.length ?? 0) <= 3;
  return (
    <div className="combine-box" role="region" aria-label="Zwei Einträge gewählt">
      <b>2 Einträge gewählt</b>
      <p className="hint">«{entryText(first)}» und «{entryText(other)}» werden ein Eintrag: Symbole nebeneinander, Texte mit « / ».</p>
      {!ok && <p className="warn-text">Kombinieren geht nur mit Symbolen, höchstens vier pro Eintrag.</p>}
      <div className="row" style={{ gap: 6 }}>
        <button className="btn small primary" disabled={!ok} onClick={onCombine}>Kombinieren</button>
        <button className="btn small" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  );
}

/** Text and symbol of a further part of a combined entry (tab «Text 2 / Symbol 2» ...). */
function PartProps({ part, index, item, block, doc, field, change }: {
  part: LegendPart;
  index: number;
  item: LegendItem;
  block: LegendBlock;
  doc: LegendDoc;
  field: FieldFn;
  change: (d: LegendDoc) => void;
}) {
  const set = (patch: Partial<LegendPart>) => change(updatePart(doc, block.id, item.id, index, patch));
  const n = index + 2;
  return (
    <>
      <label className="field">
        <span>Text {n}</span>
        <input className="input" value={part.text} {...field((d, v) => updatePart(d, block.id, item.id, index, { text: v }))} />
      </label>
      <ColorVariantChoice source={part} label={`Farbvarianten Symbol ${n}`} overridden={Boolean(item.symbol_color)} onChoose={colors => {
        const next = updatePart(doc, block.id, item.id, index, { visible_layer_colors: colors });
        change(updateItem(next, block.id, item.id, { symbol_color: "" }));
      }} />
      <div className="form two">
        <label className="field">
          <span>Symbol {n}: Grösse (Faktor)</span>
          <NumberInput label={`Grösse Symbol ${n}`} value={part.symbol_factor} step={0.1}
            onCommit={(v) => set({ symbol_factor: Math.max(0.3, Math.min(4, v)) })} />
        </label>
        <div className="field">
          <span>Symbol {n}: Lage</span>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn small" onClick={() => set({ rotation: ((part.rotation || 0) + 90) % 360 })} title="Um 90 Grad drehen">↻ 90°</button>
            <button className={`btn small ${part.mirror ? "primary" : ""}`} aria-pressed={Boolean(part.mirror)}
              onClick={() => set({ mirror: !part.mirror })} title="Links-rechts spiegeln">⇋ Spiegeln</button>
          </div>
        </div>
      </div>
      <button className="btn small" onClick={() => change(detachPart(doc, block.id, item.id, index))}
        title="Nur dieses Symbol wird wieder ein eigener Eintrag">
        Symbol {n} herauslösen
      </button>
    </>
  );
}
