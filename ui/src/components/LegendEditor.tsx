import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { downloadBlob } from "../shared/download";
import { api, Category, FamilyItem, GeneralInfo, LegendInfo, LegendLayout, LegendPrim, ProjectDetail, StencilEntry, SymbolRender } from "../api";
import InfoTip from "./InfoTip";
import { addBlock, addItem, blockForCategory, commit, combineItems, coveredRows, describe, entryText, duplicateItems, hideCovered, History, historyOf, inLegend, insertItem, LegendBlock, LegendDoc, LegendItem, missingRows, moveBlockInOrder, moveItemInOrder, moveItemTo, moveItemToBlock, companyKey, makeItem, placeInCell, push, redo, removeBlock, removeItem, replace, rotateItem, Selection, staleItems, symbolRequestKey, undo, updateItem } from "../legend";
import { Icon } from "./Icons";
import { SaveSession } from "../saveSession";
import { ArrowLeft, ChevronDown, Hand, Maximize2, Minimize2, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { a4CompactLegendDocument, alignLegendSectionColors, compactLegendDocument, legendItemColors, legendVisibleItemColors, legendVisibleLayerColors } from "../legendViewport";
import { useLegendViewport } from "../useLegendViewport";
import LegendScopePanel from "./LegendScopePanel";
import LegendTextPanel from "./LegendTextPanel";
import LegendVariantPanel from "./LegendVariantPanel";
import LegendPalettePanel from "./LegendPalettePanel";
import LegendPresentationPanel from "./LegendPresentationPanel";
import LegendDefaultsPanel from "./LegendDefaultsPanel";
import { stageToolHandoff } from "../toolbox/toolHandoff";
import { legendSourceSelection } from "../legendSourceSelection";
import { DragPayload, DropTarget, DROP_ID, groupByEntry, formatStamp } from "./legend-editor/editorShared.ts";
import { Prim, GridLines, DropCell, DropMarker } from "./legend-editor/SheetPrimitives";
import { SymIcon } from "./legend-editor/SymbolBits";
import { ItemProps, CombineBox } from "./legend-editor/ItemProps";
import { BlockProps, TitleProps } from "./legend-editor/BlockProps";
import { GeneralProps, GeneralRowProps } from "./legend-editor/GeneralProps";
import { DocProps } from "./legend-editor/DocProps";
import { useEditorPrefs } from "./legend-editor/useEditorPrefs.ts";
import { useEntryGlide } from "./legend-editor/useEntryGlide.ts";
import { useWindowedFocus } from "./legend-editor/useWindowedFocus.ts";
import { useLegendStencil } from "./legend-editor/useLegendStencil.ts";
import { useFamilySearch } from "./legend-editor/useFamilySearch.ts";
import { useLegendSave } from "./legend-editor/useLegendSave.ts";
import { useLegendLayout } from "./legend-editor/useLegendLayout.ts";
import { LegendToolbar } from "./legend-editor/LegendToolbar";
import "./LegendSection.css";
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

export default function LegendEditor({ projectId, data, categories, notify, legendId = null, onProjects, onOpenTool }: Props) {
  const [hist, setHist] = useState<History<LegendDoc> | null>(null);
  const [info, setInfo] = useState<LegendInfo | null>(null);
  const [general, setGeneral] = useState<(GeneralInfo & { svg: string; prims: LegendPrim[] }) | null>(null);
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
  const doc = hist?.present ?? null;
  const { placed, setPlaced, layoutBusy } = useLegendLayout(projectId, doc, generalRev, notify);
  const [symbols, setSymbols] = useState<Record<string, SymbolRender>>({});
  const [busy, setBusy] = useState(false);
  const { search, setSearch, results } = useFamilySearch();
  const [exportBlock, setExportBlock] = useState("");

  const { showGrid, toggleGrid, panes, startPaneDrag, resetPane, bar, saveBar, toggleBar } = useEditorPrefs();
  const [detached, setDetached] = useState(false);
  const [windowed, setWindowed] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [grayscale, setGrayscale] = useState(false);
  const [originalEdit, setOriginalEdit] = useState("");
  // sections opened in the list on the left (one line per section until opened)
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(() => new Set());
  const toggleOpen = (id: string) => setOpenBlocks((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
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
  const fieldBefore = useRef<LegendDoc | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewLayout = dropAt?.cell !== undefined && preview ? preview.layout : placed;
  const viewport = useLegendViewport(canvasRef, paperRef, viewLayout?.width ?? 200, viewLayout?.height ?? 100, Boolean(info && hist));
  const { zoom } = viewport;

  useWindowedFocus(editorRef, windowed);

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
  const { stencil, stencilTab, setStencilTab, openStencilEntries } = useLegendStencil(projectId);

  const { saveState, savedInfo, setSavedInfo, saveNow, saveLegend } = useLegendSave(saveSession, doc, notify);

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

  const layoutNow = dropAt?.cell !== undefined && preview ? preview.layout : placed;
  useEntryGlide(paperRef, layoutNow);

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
      downloadBlob(blob, name);
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
        </div>
      </div>}
      {generalBox}
      <LegendToolbar bar={bar} toggleBar={toggleBar} saveBar={saveBar} showGrid={showGrid} toggleGrid={toggleGrid}
        outlineOpen={outlineOpen} onToggleOutline={() => setOutlineOpen(value => !value)}
        busy={busy} exporting={exporting} exportBlock={exportBlock}
        canUndo={Boolean(hist?.past.length)} canRedo={Boolean(hist?.future.length)}
        onUndo={() => setHist((h) => (h ? undo(h) : h))} onRedo={() => setHist((h) => (h ? redo(h) : h))} onProposal={proposal}
        onAddKind={addKind} onAddBlock={() => {
          const r = addBlock(doc, "Neuer Abschnitt");
          change(r.doc);
          setSel({ type: "block", block: r.id });
        }}
        style={style} grids={info.grids} setStyle={setStyle}
        generalKind={general?.kind} exportGeneral={exportGeneral} setExportGeneral={setExportGeneral}
        applyCompact={applyCompact} applyA4={applyA4} alignSectionColors={alignSectionColors}
        detached={detached} onToggleDetached={() => setDetached((v) => !v)}
        saveState={saveState} savedInfo={savedInfo}
        onExportDxf={() => exportFile("dxf", exportBlock, exportGeneral && Boolean(general?.kind))}
        menuContainer={() => editorRef.current} />

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

// -- property panels ------------------------------------------------------------------------

