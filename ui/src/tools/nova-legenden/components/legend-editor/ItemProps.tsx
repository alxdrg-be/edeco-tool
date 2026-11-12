import { useEffect, useState } from "react";
import { api, Category, CompanySymbolLook, SymbolRender } from "../../api";
import InfoTip from "../../../../shared/InfoTip";
import { entryText, LegendBlock, LegendDoc, LegendItem, LineStyle, companyKey, splitItem, detachPart, LegendPart, updatePart, updateItem } from "../../legend";
import { TrashIcon } from "../Icons";
import { legendItemColors, legendVisibleItemColors, legendVisibleLayerColors } from "../../legendViewport";
import { LINE_LABEL, FREE_TEXT_HINT, FieldFn } from "./editorShared.ts";
import { ColorVariantChoice, NumberInput } from "./SymbolBits";

export function ItemProps({
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

/** Category of a symbol family for the whole company (as in the symbol library). */
export function CompanyCategoryField({ familyKey, notify }: { familyKey: string; notify: (text: string, error?: boolean) => void }) {
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
export function CombineBox({ doc, first, second, onCombine, onCancel }: {
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
export function PartProps({ part, index, item, block, doc, field, change }: {
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
