import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, Copy, Download, FileUp, Info, ListChecks, Plus, Redo2, Save, Server, Undo2, X } from 'lucide-react';
import type { ToolProps } from '../../toolbox/modules';
import ToolHeader from '../../toolbox/ToolHeader';
import { stageToolHandoff, type HandoffTarget } from '../../toolbox/toolHandoff';
import { useProjectHub } from '../projektzentrale/projectHubState';
import { useDialogFocus } from '../../shared/useDialogFocus';
import RackCanvas from './RackCanvas';
import RackLibrary, { FreePartDialog, isFreeProfile, RackProfileDialog } from './RackLibrary';
import { responsibleParties } from './responsibility';
import RackInspector from './RackInspector';
import RackPorts from './RackPorts';
import { addPlacement, analyzeRacks, copyRack, createEmptyDocument, createExampleDocument, duplicatePlacements, movePlacements, portRows, removePlacements, validateDocument } from './model';
import { bomCSV, initialHistory, MAX_DOCUMENT_BYTES, parseRackFile, portsCSV, pushDocument, RACK_DRAFT_KEY, safeFilename, travelHistory } from './documentStore';
import { downloadRackFile, exportRack } from './rackApi';
import RackSheet, { rackSheetMarkup, sheetLogo } from './RackSheet';
import logoRaw from '../../assets/edeco-logo.svg?raw';
import type { DeviceProfile, MountSide, MutationResult, PortRow, Rack, RackDocument, RackIssue } from './types';
import './rack-planner.css';

type Tab = 'properties' | 'ports' | 'checks' | 'bom';
type Dialog = 'new-rack' | 'document' | 'export' | null;
const SHEET_LOGO = sheetLogo(logoRaw);
const number = (value: number) => value.toLocaleString('de-CH', { maximumFractionDigits: 1 });
function initialDraft() {
  try {
    const raw = localStorage.getItem(RACK_DRAFT_KEY);
    return { document: raw ? parseRackFile(raw) : createEmptyDocument(), error: '', raw: '' };
  } catch (error) {
    let raw = '';
    try { raw = localStorage.getItem(RACK_DRAFT_KEY) ?? ''; } catch { /* Saving reports unavailable storage separately. */ }
    return { document: createEmptyDocument(), error: error instanceof Error ? error.message : 'Der lokale Entwurf konnte nicht gelesen werden.', raw };
  }
}
function Overlay({ title, close, busy = false, children }: { title: string; close: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, close, busy);
  return <div className="rd-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="rd-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <header><h2>{title}</h2><button type="button" aria-label={`${title} schliessen`} disabled={busy} onClick={close}><X size={21} /></button></header>{children}
    </section>
  </div>;
}
/** Outer sizes named in the Steiger catalogue 2026. Usable depth is not stated there and stays empty. */
const RACK_SIZES = [
  { id: '967461', units: 42, widthMm: 800, heightMm: 2000, depthMm: 1000, name: 'Netzwerkschrank' },
  { id: '967460', units: 42, widthMm: 800, heightMm: 2000, depthMm: 800, name: 'Netzwerkschrank' },
  { id: '967454', units: 24, widthMm: 600, heightMm: 1130, depthMm: 600, name: 'Wandgehäuse' },
  { id: '967453', units: 21, widthMm: 600, heightMm: 997, depthMm: 600, name: 'Wandgehäuse' },
  { id: '967452', units: 15, widthMm: 600, heightMm: 730, depthMm: 600, name: 'Wandgehäuse' },
  { id: '967451', units: 12, widthMm: 600, heightMm: 597, depthMm: 600, name: 'Wandgehäuse' },
  { id: '967450', units: 9, widthMm: 600, heightMm: 464, depthMm: 400, name: 'Wandgehäuse' },
] as const;
function NewRackDialog({ close, add, error }: { close: () => void; add: (rack: Rack) => void; error: string }) {
  const [sizeId, setSizeId] = useState<(typeof RACK_SIZES)[number]['id']>('967461'), [label, setLabel] = useState('Rack 0.1');
  const size = RACK_SIZES.find(item => item.id === sizeId) ?? RACK_SIZES[0];
  return <Overlay title="Neues Rack" close={close}><form onSubmit={event => {
    event.preventDefault(); add({ id: crypto.randomUUID(), label: label.trim(), units: size.units,
      widthMm: size.widthMm, heightMm: size.heightMm, depthMm: size.depthMm,
      usableDepthMm: null, frontDoorClearanceMm: null, rearDoorClearanceMm: null, weightLimitKg: null, powerBudgetW: null, room: '', notes: '' });
  }}><label className="rd-field">Kennung<input autoFocus aria-label="Neue Rack-Kennung" required maxLength={120} value={label} onChange={event => setLabel(event.target.value)} /></label>
    <div className="rd-preset-options" role="group" aria-label="Rack-Grösse">{RACK_SIZES.map(value => <button type="button" key={value.id} aria-pressed={sizeId === value.id} onClick={() => setSizeId(value.id)}><Server size={20} /><strong>{value.units} HE</strong><span>{value.name} · {value.id}<br />{value.widthMm} × {value.heightMm} × {value.depthMm} mm</span></button>)}</div>
    <p className="rd-muted">Aussenmasse aus dem Steiger-Katalog 2026, Artikel {size.id}.{size.id === '967461' ? ' Die HE-Zahl steht bei diesem Artikel nicht im Namen; 42 HE entsprechen dem gleich hohen Schrank 967460.' : ''} Die nutzbare Tiefe steht dort nicht und bleibt leer, bis sie aus dem Herstellerplan kommt.</p>{error && <p className="rd-danger" role="alert">{error}</p>}
    <footer><button type="button" className="btn" onClick={close}>Abbrechen</button><button type="submit" className="btn primary">Rack anlegen</button></footer>
  </form></Overlay>;
}
function DocumentDialog({ document, close, save, error }: { document: RackDocument; close: () => void; save: (document: RackDocument) => void; error: string }) {
  const [draft, setDraft] = useState(document);
  return <Overlay title="Planangaben" close={close}><form onSubmit={event => { event.preventDefault(); save(draft); }}><div className="rd-form-grid">
    {(['name', 'projectNumber', 'room', 'author', 'index', 'date'] as const).map((key, index) => <label className="rd-field" key={key}>{['Planname', 'Projektnummer', 'Raum', 'Verfasser', 'Index', 'Datum'][index]}<input aria-label={['Planname', 'Projektnummer', 'Raum', 'Verfasser', 'Index', 'Datum'][index]} required={key === 'name'} maxLength={200} value={draft[key] ?? ''} onChange={event => setDraft(old => ({ ...old, [key]: event.target.value }))} /></label>)}
  </div>{error && <p className="rd-danger" role="alert">{error}</p>}<footer><button type="button" className="btn" onClick={close}>Abbrechen</button><button type="submit" className="btn primary">Übernehmen</button></footer></form></Overlay>;
}

export default function RackPlanner({ onHome, onOpenTool }: ToolProps) {
  const [loaded] = useState(initialDraft), [history, setHistory] = useState(() => initialHistory(loaded.document));
  const document = history.present, documentRef = useRef(document); documentRef.current = document;
  const [restoreError, setRestoreError] = useState(loaded.error), [storageError, setStorageError] = useState('');
  const [rackId, setRackId] = useState(() => document.racks[0]?.id ?? ''), [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusPlacement, setFocusPlacement] = useState<string | null>(null);
  const [view, setView] = useState<'front' | 'rear'>('front'), [tab, setTab] = useState<Tab>('properties');
  const [dialog, setDialog] = useState<Dialog>(null), [editProfile, setEditProfile] = useState<DeviceProfile | null>(null);
  const [dragProfile, setDragProfile] = useState<string | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [rejected, setRejected] = useState<RackIssue[]>([]), [busy, setBusy] = useState('');
  const [exportAll, setExportAll] = useState(false), [exportViews, setExportViews] = useState<'both' | 'front' | 'rear'>('both');
  const [pdf, setPdf] = useState<{ file: File; document: RackDocument; scope: string } | null>(null);
  const input = useRef<HTMLInputElement>(null), abort = useRef<AbortController | null>(null), clipboard = useRef<string[]>([]);
  const { active, error: projectError } = useProjectHub();
  const analysis = useMemo(() => analyzeRacks(document), [document]);
  const rack = document.racks.find(item => item.id === rackId) ?? document.racks[0] ?? null;
  const currentAnalysis = analysis.racks.find(item => item.rackId === rack?.id);
  const selection = document.placements.find(item => item.id === selectedIds[0] && item.rackId === rack?.id) ?? null;
  const profile = document.profiles.find(item => item.id === selection?.profileId) ?? null;
  const rackIssues = analysis.issues.filter(issue => issue.rackId === rack?.id);
  const errors = rackIssues.filter(issue => issue.severity === 'error'), open = rackIssues.filter(issue => issue.severity !== 'error');
  const exportScope = JSON.stringify({ racks: exportAll ? document.racks.map(r => r.id) : rack ? [rack.id] : [], views: exportViews });
  const currentPdf = pdf?.document === document && pdf.scope === exportScope ? pdf.file : null;
  const sourcePorts = document.placements.filter(p => p.rackId === rack?.id && p.status !== 'removed')
    .filter(p => { const type = document.profiles.find(item => item.id === p.profileId); return type?.kind === 'patch' && type.medium === 'RJ45'; });
  const passivePorts = sourcePorts.reduce((sum, item) => sum + (document.profiles.find(p => p.id === item.profileId)?.portCount ?? 0), 0);

  function persist(current = documentRef.current) {
    if (restoreError) return false;
    try { localStorage.setItem(RACK_DRAFT_KEY, JSON.stringify(current)); setStorageError(''); return true; }
    catch { setStorageError('Lokales Speichern ist fehlgeschlagen. Bitte den Entwurf mit «JSON speichern» sichern.'); return false; }
  }
  useEffect(() => { persist(document); }, [document, restoreError]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!storageError && !restoreError) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [storageError, restoreError]);
  function leave(action: () => void) {
    if (busy || editProfile || dialog) return;
    if (!persist() && !window.confirm('Der Rack-Entwurf ist nicht lokal gespeichert. Trotzdem verlassen? Zuerst kannst du ihn als JSON sichern.')) return;
    action();
  }
  function commit(next: RackDocument) {
    const validation = validateDocument(next);
    if (!validation.valid) { setError(validation.errors.slice(0, 3).join(' ')); return false; }
    setHistory(old => pushDocument(old, next)); setError(''); setRejected([]); setNotice(''); return true;
  }
  function apply(result: MutationResult) {
    if (!result.accepted) { setRejected(result.issues); setError(result.issues[0]?.message ?? 'Die Platzierung ist nicht möglich.'); return false; }
    if (!commit(result.document)) return false;
    setSelectedIds(result.placementIds); return true;
  }
  function chooseRack(id: string) { setRackId(id); setSelectedIds([]); setFocusPlacement(null); setRejected([]); setError(''); }
  function replace(next: RackDocument, reason: string) {
    if (!window.confirm(`${reason} Der aktuelle Entwurf wird ersetzt. Bei Bedarf zuerst als JSON speichern.`)) return false;
    setHistory(initialHistory(next)); chooseRack(next.racks[0]?.id ?? ''); setNotice(reason.startsWith('Beispiel') ? 'Beispiel geladen. Geräteangaben mit den Herstellerdaten ergänzen.' : 'Rack-Datei geladen.'); setPdf(null); clipboard.current = []; return true;
  }
  function add(profileId: string, startUnit?: number, side?: MountSide, base: RackDocument = document): boolean {
    if (!rack) { setDialog('new-rack'); return false; }
    const definition = base.profiles.find(item => item.id === profileId);
    if (!definition) return false;
    const mount = side ?? (definition.units === 0 ? 'zero-right' : view);
    if (startUnit !== undefined || definition.units === 0) return apply(addPlacement(base, { rackId: rack.id, profileId, startUnit: startUnit ?? 1, side: mount }));
    for (let unit = rack.units - definition.units + 1; unit >= 1; unit--) {
      const result = addPlacement(base, { rackId: rack.id, profileId, startUnit: unit, side: mount });
      if (result.accepted) return apply(result);
    }
    setError(`Für «${definition.name}» ist auf der ${view === 'front' ? 'Vorderseite' : 'Rückseite'} kein passender freier Platz vorhanden.`);
    return false;
  }
  /** A free part gets its own profile; it is placed like any other device. */
  function addFree(profile: DeviceProfile) {
    const base = { ...document, profiles: [...document.profiles, profile] };
    return add(profile.id, undefined, undefined, base);
  }
  function duplicate() { if (selectedIds.length) apply(duplicatePlacements(document, selectedIds)); }
  function remove() {
    if (!selectedIds.length) return;
    if (document.ports.some(row => selectedIds.includes(row.placementId) && (row.label || row.target || row.outlet || row.room || row.state !== 'unknown')) && !window.confirm('Geräte samt ausgefüllter Portliste entfernen? Rückgängig bleibt möglich.')) return;
    if (commit(removePlacements(document, selectedIds))) setSelectedIds([]);
  }
  function paste() {
    const ids = clipboard.current.filter(id => document.placements.some(p => p.id === id && p.rackId === rack?.id));
    if (!ids.length) { setError('Kopierte Geräte sind in diesem Rack nicht mehr vorhanden. Für ein anderes Rack «Rack kopieren» verwenden.'); return; }
    apply(duplicatePlacements(document, ids));
  }
  function issueTarget(issue: RackIssue) {
    chooseRack(issue.rackId); setTab('properties');
    let field = issue.field;
    const rackFields = ['heightMm', 'widthMm', 'usableDepthMm', 'frontDoorClearanceMm', 'rearDoorClearanceMm', 'weightLimitKg', 'powerBudgetW'];
    let device = document.placements.find(p => issue.placementIds.includes(p.id));
    if (!device && (field === 'weightKg' || field === 'powerW')) device = document.placements.find(p => p.rackId === issue.rackId && p.status !== 'removed' && document.profiles.some(profile => profile.id === p.profileId && profile[field as 'weightKg' | 'powerW'] === null));
    if (field && rackFields.includes(field)) setSelectedIds([]);
    else if (device) {
      setSelectedIds([device.id]); setFocusPlacement(device.id);
      if (device.side === 'front' || device.side === 'rear') setView(device.side);
      if (field && ['depthMm', 'inwardCableMm', 'outwardCableMm', 'weightKg', 'powerW', 'loadLimitKg', 'units'].includes(field) || issue.code === 'opposite-depth-open') {
        setEditProfile(document.profiles.find(p => p.id === device.profileId) ?? null);
        field ??= 'depthMm';
      }
    }
    if (field) window.setTimeout(() => {
      const holder = window.document.querySelector<HTMLElement>(`[data-rack-field="${field!.replace(/[^a-zA-Z0-9-]/g, '')}"]`);
      const target = holder?.querySelector<HTMLElement>('input,select,textarea');
      target?.focus(); target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
  }
  function saveJSON() {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    downloadRackFile(blob, `${safeFilename(document.name)}.rack.json`); setNotice('Rack-Datei heruntergeladen. Sie enthält Belegung, Portliste und eigene Profile.');
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) { setError('Rack-Dateien dürfen höchstens 20 MB gross sein.'); return; }
    try { const next = parseRackFile(await file.text()); replace(next, 'Rack-Datei öffnen?'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Rack-Datei konnte nicht gelesen werden.'); }
  }
  function saveProfile(next: DeviceProfile) {
    const old = document.profiles.find(item => item.id === next.id);
    const placements = document.placements.filter(p => p.profileId === next.id);
    const losses = document.ports.filter(p => placements.some(item => item.id === p.placementId) && p.number > next.portCount);
    if (losses.length && !window.confirm(`Die kleinere Portanzahl entfernt ${losses.length} Portzeilen aus allen Geräten dieses Profils. Übernehmen?`)) return false;
    const ports = document.ports.filter(p => !placements.some(item => item.id === p.placementId));
    for (const placement of placements) for (let i = 1; i <= next.portCount; i++) ports.push(document.ports.find(p => p.placementId === placement.id && p.number === i) ?? { placementId: placement.id, number: i, label: '', target: '', outlet: '', room: '', state: 'unknown' });
    if (!commit({ ...document, profiles: old ? document.profiles.map(p => p.id === next.id ? next : p) : [...document.profiles, next], ports })) return false;
    setEditProfile(null); return true;
  }
  function changePort(row: PortRow) { commit({ ...document, ports: [...document.ports.filter(p => !(p.placementId === row.placementId && p.number === row.number)), row] }); }
  function csv(kind: 'ports' | 'bom') {
    try { downloadRackFile(new Blob([kind === 'ports' ? portsCSV(document) : bomCSV(document)], { type: 'text/csv;charset=utf-8' }), `${safeFilename(document.name)}-${kind === 'ports' ? 'Portliste' : 'Stueckliste'}.csv`); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Die CSV-Datei konnte nicht erstellt werden.'); }
  }
  async function runExport(format: 'pdf' | 'svg' | 'dxf') {
    if (!rack || busy) return;
    const snapshot = document; setBusy(`${format.toUpperCase()} wird erstellt …`); setError(''); abort.current = new AbortController();
    try {
      const rackIds = exportAll ? snapshot.racks.map(item => item.id) : [rack.id], views: ('front' | 'rear')[] = exportViews === 'both' ? ['front', 'rear'] : [exportViews];
      // PDF and SVG are made from the same sheet markup as the preview below.
      const sheets = format === 'dxf' ? undefined : rackIds.flatMap(rackId => views.map(view => ({ rackId, view,
        svg: rackSheetMarkup({ document: snapshot, rackId, view, logo: SHEET_LOGO, filename: `${safeFilename(snapshot.name)}.${format}` }) })));
      const file = await exportRack(snapshot, rackIds, views, format, abort.current.signal, sheets);
      if (snapshot !== documentRef.current) { setError('Der Plan wurde während des Exports geändert. Bitte erneut exportieren.'); return; }
      downloadRackFile(file, file.name); if (format === 'pdf') setPdf({ file, document: snapshot, scope: exportScope });
      setNotice(`${format.toUpperCase()} heruntergeladen · ${exportAll ? 'alle Racks' : rack.label} · ${exportViews === 'both' ? 'Vorder- und Rückseite' : exportViews === 'front' ? 'Vorderseite' : 'Rückseite'}.`);
    } catch (caught) { if (!(caught instanceof DOMException && caught.name === 'AbortError')) setError(caught instanceof Error ? caught.message : 'Der Export ist fehlgeschlagen.'); }
    finally { setBusy(''); abort.current = null; }
  }
  function send(target: HandoffTarget) {
    if (!currentPdf || !onOpenTool) return;
    if (!persist()) { setError('Vor der Übergabe bitte den Entwurf als JSON sichern.'); return; }
    try { stageToolHandoff({ target, source: 'Rack-Dispo', files: [currentPdf], projectId: document.projectId, projectLabel: document.projectNumber }); setDialog(null); onOpenTool(target); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Die Übergabe ist fehlgeschlagen.'); }
  }

  return <div className="rack-planner" onKeyDown={event => {
    if (busy || dialog || editProfile || (event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); setHistory(old => travelHistory(old, event.shiftKey ? 'redo' : 'undo')); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveJSON(); }
  }}>
    <ToolHeader title="Rack-Dispo" currentToolId="rack-dispo" onHome={() => leave(onHome)} onOpenTool={onOpenTool ? id => leave(() => onOpenTool(id)) : undefined} disabled={Boolean(busy || dialog || editProfile)} />
    <section className="rd-planbar" aria-label="Rack-Plan verwalten"><div><button className="rd-document-name" onClick={() => setDialog('document')} title="Planangaben bearbeiten"><Server size={22} /><span>{document.name}<small>{document.projectNumber ? `Projekt ${document.projectNumber} · ` : ''}{document.racks.length} {document.racks.length === 1 ? 'Rack' : 'Racks'}</small></span><ChevronDown size={15} /></button></div>
      <span className="rd-save-status" role="status">{storageError || restoreError ? 'Speicherung prüfen' : 'Auf diesem PC gespeichert'}</span>
      <button className="btn" onClick={() => setHistory(old => travelHistory(old, 'undo'))} disabled={!history.past.length || Boolean(busy)} aria-label="Rückgängig"><Undo2 size={16} /></button>
      <button className="btn" onClick={() => setHistory(old => travelHistory(old, 'redo'))} disabled={!history.future.length || Boolean(busy)} aria-label="Wiederholen"><Redo2 size={16} /></button>
      <button className="btn" onClick={() => input.current?.click()} disabled={Boolean(busy)}><FileUp size={16} />JSON öffnen</button>
      <button className="btn" onClick={saveJSON} disabled={Boolean(busy)}><Save size={16} />JSON speichern</button>
      <button className="btn primary" onClick={() => setDialog('export')} disabled={!rack || Boolean(busy)}><Download size={16} />Exportieren</button>
      <input type="file" accept=".json,.rack.json,application/json" hidden ref={input} data-rack-import onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
    </section>
    {restoreError && <div className="rd-message rd-message-error" role="alert"><strong>Gespeicherter Entwurf konnte nicht gelesen werden.</strong><span>{restoreError} Die bestehende Datei bleibt erhalten.</span>{loaded.raw && <button onClick={() => downloadRackFile(new Blob([loaded.raw], { type: 'application/json' }), 'Rack-Entwurf-Wiederherstellung.json')}>Vorhandenen Entwurf sichern</button>}<button onClick={() => { if (window.confirm('Den vorhandenen lokalen Entwurf durch den aktuell sichtbaren ersetzen?')) setRestoreError(''); }}>Mit diesem Entwurf fortfahren</button></div>}
    {storageError && <div className="rd-message rd-message-error" role="alert">{storageError}</div>}
    {(error || rejected.length > 0) && <div className="rd-message rd-message-error" role="alert"><CircleAlert size={18} /><div><strong>{error}</strong>{rejected.slice(0, 3).map(issue => <p key={issue.id}>{issue.explanation}<button onClick={() => issueTarget(issue)}>Betroffenes Gerät anzeigen</button></p>)}</div><button aria-label="Meldung schliessen" onClick={() => { setError(''); setRejected([]); }}><X size={18} /></button></div>}
    {notice && <div className="rd-message" role="status"><CheckCircle2 size={17} />{notice}<button aria-label="Hinweis schliessen" onClick={() => setNotice('')}><X size={17} /></button></div>}
    <div className="rd-workspace" inert={Boolean(busy) || undefined}>
      <aside className="rd-library-pane"><RackLibrary profiles={document.profiles} onAdd={id => { add(id); }} onAddFree={addFree} onDragProfile={setDragProfile} />
        <details className="rd-help"><summary><Info size={15} />Bedienung & Grundlagen</summary><p>Geräte ins Rack ziehen oder per Klick hinzufügen. HE zählen von unten. Pfeiltasten verschieben um 1 HE. Umschalt + Klick wählt mehrere Geräte. Strg/Cmd + C/V kopiert innerhalb des Racks, zuerst direkt darüber und sonst direkt darunter.</p><p>19″ = 482,6 mm Montagebreite · 1 HE = 44,45 mm. Gehäusemasse und freie Montagetiefe sind eigene Angaben.</p><p>Neutrale Geräteprofile sind Platzhalter. Abmessungen, Gewicht und Leistung mit den Herstellerdaten ergänzen. Mechanische Modellprüfung, keine Installationsfreigabe.</p><button className="btn" onClick={() => replace(createExampleDocument(), 'Beispiel laden?')}>Beispiel laden</button></details>
      </aside>
      <main className="rd-main-pane">
        <div className="rd-rackbar"><div className="rd-rack-tabs" role="tablist" aria-label="Racks">{document.racks.map(item => <button key={item.id} role="tab" aria-selected={rack?.id === item.id} onClick={() => chooseRack(item.id)}>{item.label}<small>{item.units} HE</small></button>)}</div><button className="btn" onClick={() => setDialog('new-rack')} disabled={document.racks.length >= 50}><Plus size={16} />Neues Rack</button></div>
        {rack ? <><div className="rd-canvas-top"><div className="rd-side-switch" role="group" aria-label="Rack-Ansicht"><button aria-pressed={view === 'front'} onClick={() => setView('front')}>Vorderseite</button><button aria-pressed={view === 'rear'} onClick={() => setView('rear')}>Rückseite</button></div><span>{rack.widthMm} × {rack.heightMm} × {rack.depthMm} mm · B × H × T</span><button className="btn" aria-label="Rack kopieren" onClick={() => { const next = copyRack(document, rack.id); if (commit(next)) chooseRack(next.racks.at(-1)!.id); }}><Copy size={15} /></button></div>
          <div className="rd-canvas-wrap"><RackCanvas document={document} rackId={rack.id} view={view} selectedIds={selectedIds} dragProfileId={dragProfile} issues={rackIssues} onSelect={(id, add) => { setFocusPlacement(null); setSelectedIds(old => !id ? [] : add ? old.includes(id) ? old.filter(value => value !== id) : [...old, id] : [id]); }} onPlace={add} onMove={(ids, delta) => apply(movePlacements(document, ids, delta))} onError={issues => { setRejected(issues); setError(issues[0]?.message ?? 'Die Platzierung ist nicht möglich.'); }} onDelete={remove} onCopy={() => { clipboard.current = selectedIds; setNotice(`${selectedIds.length} Geräte zum Kopieren markiert.`); }} onPaste={paste} focusPlacementId={focusPlacement} /></div>
          <footer className="rd-metrics" aria-label="Rack-Auswertung"><span><strong>{currentAnalysis?.objects ?? 0}</strong> Geräte</span><span><strong>{currentAnalysis?.usedUnits ?? 0}</strong> HE belegt</span><span><strong>{currentAnalysis?.reservedUnits ?? 0}</strong> HE Reserve</span><span><strong>{currentAnalysis?.freeUnits ?? rack.units}</strong> HE frei</span><span title="Passive RJ45-Patchpanels, ohne Switch- und LWL-Ports"><strong>{passivePorts}</strong> RJ45-Patchports</span><button onClick={() => setTab('checks')} className={errors.length ? 'rd-danger' : 'rd-muted'}><ListChecks size={16} />{errors.length} Konflikte · {open.length} offen</button></footer>
        </> : <section className="rd-empty"><Server size={54} strokeWidth={1.3} /><h1>Dein Rack. Klar disponiert.</h1><p>Rack anlegen, Geräte einrasten, Portliste pflegen.</p><button className="btn primary" onClick={() => setDialog('new-rack')}><Plus size={16} />Neues Rack</button><button className="btn" onClick={() => replace(createExampleDocument(), 'Beispiel laden?')}>Beispiel laden</button></section>}
      </main>
      <aside className="rd-inspector-pane"><div className="rd-panel-tabs" role="tablist" aria-label="Rack-Details">{([['properties', 'Eigenschaften'], ['ports', 'Portliste'], ['checks', 'Prüfung'], ['bom', 'Liste']] as [Tab, string][]).map(([id, label]) => <button key={id} role="tab" aria-label={label} aria-selected={tab === id} onClick={() => setTab(id)}>{label}{id === 'checks' && errors.length > 0 && <b>{errors.length}</b>}</button>)}</div>
        <div className="rd-panel-body" key={`${tab}-${selection?.id ?? rack?.id}`}>
          {tab === 'properties' && <><RackInspector rack={rack} placement={selection} profile={profile} profiles={document.profiles} placements={document.placements.filter(p => p.rackId === rack?.id)} onRackChange={next => commit({ ...document, racks: document.racks.map(item => item.id === next.id ? next : item) })} onPlacementChange={next => commit({ ...document, placements: document.placements.map(item => item.id === next.id ? next : item) })} onEditProfile={id => setEditProfile(document.profiles.find(p => p.id === id) ?? null)} parties={responsibleParties(document)} onDuplicate={duplicate} onRemove={remove} />
            {!selection && rack && <><details className="rd-help"><summary>Projektbezug</summary>{active ? <><p>Aktiv: {active.number} · {active.name}</p><button className="btn" onClick={() => { commit({ ...document, projectId: active.id, projectNumber: active.number }); setNotice('Projektbezug für diesen Rack-Plan übernommen.'); }}>Projekt übernehmen</button></> : <p>{projectError || 'In der Projektzentrale ist kein aktives Projekt gewählt.'}</p>}<p>Ein Projektwechsel im Toolhub ändert diesen Plan erst nach «Projekt übernehmen».</p></details><button className="btn rd-delete-rack" disabled={document.racks.length <= 1} title={document.racks.length <= 1 ? 'Mindestens ein Rack bleibt im Plan.' : undefined} onClick={() => {
              if (!window.confirm(`«${rack.label}» samt Geräten und Portlisten entfernen? Rückgängig bleibt möglich.`)) return;
              const ids = document.placements.filter(item => item.rackId === rack.id).map(item => item.id);
              commit({ ...document, racks: document.racks.filter(item => item.id !== rack.id), placements: document.placements.filter(item => !ids.includes(item.id)), ports: document.ports.filter(item => !ids.includes(item.placementId)) }); chooseRack(document.racks.find(item => item.id !== rack.id)?.id ?? '');
            }}>Rack entfernen</button></>}
          </>}
          {tab === 'ports' && <><RackPorts placement={selection} profile={profile} rows={selection ? portRows(document, selection.id) : []} onChange={changePort} onExport={() => csv('ports')} /><button className="btn rd-wide" onClick={() => csv('ports')} disabled={!document.placements.some(p => document.profiles.some(profile => profile.id === p.profileId && profile.portCount > 0))}><Download size={16} />Gesamte Portliste · CSV</button></>}
          {tab === 'checks' && <section className="rd-checks"><h2>Mechanische Vorprüfung</h2><p className="rd-muted">{errors.length} Konflikte · {open.length} Angaben oder Nachweise offen</p>{rackIssues.map(issue => <details key={issue.id} className={`rd-issue rd-issue-${issue.severity}`} data-rack-issue={issue.code}><summary><CircleAlert size={16} /><strong>{issue.message}</strong></summary><p>{issue.explanation}</p>{issue.actual !== undefined && <p>Ist: {number(issue.actual)}{issue.limit !== undefined ? ` · Grenze: ${number(issue.limit)}` : ''}</p>}<button className="btn" onClick={() => issueTarget(issue)}>Zur Eingabe</button></details>)}{rack && !rackIssues.length && <p><CheckCircle2 size={18} />Eingegebene mechanische Bedingungen erfüllt.</p>}
            {currentAnalysis && <div className="rd-known-totals"><h3>Gewicht & Leistung</h3><p><strong>{number(currentAnalysis.weight.known)} kg</strong> bekannt{currentAnalysis.weight.missing ? ` · ${currentAnalysis.weight.missing} Angaben fehlen` : ''}</p><p><strong>{number(currentAnalysis.power.known)} W</strong> bekannt{currentAnalysis.power.missing ? ` · ${currentAnalysis.power.missing} Angaben fehlen` : ''}</p><small>Leistungsbudget in W. USV-Scheinleistung in VA, Zuleitung, Wärmeabfuhr und Potenzialausgleich sind damit nicht nachgewiesen.</small></div>}
            <details className="rd-help"><summary>Prüfumfang</summary><p>HE-Überlappung, Gehäuse und Montagebereich, bekannte Tiefen mit Kabelraum, Türfreiheit, dokumentierte Gewichts- und Leistungsbudgets. Unbekannte Werte bleiben offen.</p><p>Die Zentrierung der Montageschienen in der Zeichnung ist schematisch. Für Fertigung und Installation gelten die freigegebenen Herstellerunterlagen.</p></details></section>}
          {tab === 'bom' && <section className="rd-bom"><h2>Stückliste</h2><p className="rd-muted">Alle Racks · geplante und bestehende Geräte. Entfallene Geräte und Freihaltereserven sind ausgeschlossen.</p><button className="btn rd-wide" onClick={() => csv('bom')}><Download size={16} />Stückliste · CSV</button>{document.racks.map(item => <div key={item.id}><h3>{item.label}</h3>{document.profiles.map(p => { const count = document.placements.filter(v => v.rackId === item.id && v.profileId === p.id && v.status !== 'removed' && p.kind !== 'reserve').length; return count ? <p key={p.id}><strong>{count} ×</strong> {p.name}<small>{[p.manufacturer, p.article].filter(Boolean).join(' · ') || 'Artikel noch offen'}</small></p> : null; })}</div>)}
            {document.placements.some(p => p.status === 'removed') && <details className="rd-help"><summary>Entfallene Geräte</summary><p>Weiter dokumentiert, ohne Belegung und Mengen. Zum Reaktivieren auswählen und den Planungsstand ändern.</p>{document.placements.filter(p => p.status === 'removed').map(p => <button className="btn rd-wide" key={p.id} onClick={() => { chooseRack(p.rackId); setSelectedIds([p.id]); setTab('properties'); }}>{document.racks.find(r => r.id === p.rackId)?.label} · {p.label}</button>)}</details>}
          </section>}
        </div>
      </aside>
    </div>
    {dialog === 'new-rack' && <NewRackDialog error={error} close={() => setDialog(null)} add={next => { if (commit({ ...document, racks: [...document.racks, next] })) { chooseRack(next.id); setDialog(null); } }} />}
    {dialog === 'document' && <DocumentDialog error={error} document={document} close={() => setDialog(null)} save={next => { if (commit(next)) setDialog(null); }} />}
    {editProfile && (isFreeProfile(editProfile) ? <FreePartDialog initial={editProfile} onSave={saveProfile} onClose={() => setEditProfile(null)} /> : <RackProfileDialog profile={editProfile} onSave={saveProfile} onClose={() => setEditProfile(null)} />)}
    {dialog === 'export' && <Overlay title="Rack exportieren" close={() => setDialog(null)} busy={Boolean(busy)}><div className="rd-export-options"><label><input type="checkbox" checked={exportAll} disabled={Boolean(busy)} onChange={event => setExportAll(event.target.checked)} />Alle Racks ({document.racks.length})</label><label className="rd-field">Ansichten<select aria-label="Export-Ansichten" value={exportViews} disabled={Boolean(busy)} onChange={event => setExportViews(event.target.value as typeof exportViews)}><option value="both">Vorder- und Rückseite</option><option value="front">Vorderseite</option><option value="rear">Rückseite</option></select></label></div>
      <div className="rd-export-actions">{(['pdf', 'svg', 'dxf'] as const).map(format => <button key={format} className="btn primary" disabled={Boolean(busy)} onClick={() => void runExport(format)}><Download size={17} />{format.toUpperCase()} exportieren</button>)}</div><p className="rd-muted">PDF und SVG entsprechen genau der Planvorschau unten · DXF als CAD-Zeichnung 1:1 in mm. Offene Angaben stehen im Anhang.</p>
      {rack && <figure className="rd-sheet-preview" aria-label="Planvorschau wie im Export"><RackSheet document={document} rackId={rack.id} view={exportViews === 'rear' ? 'rear' : 'front'} logo={SHEET_LOGO} filename={`${safeFilename(document.name)}.pdf`} /><figcaption>Planvorschau · {rack.label} · {exportViews === 'rear' ? 'Rückansicht' : 'Vorderansicht'} · identisch mit PDF und SVG</figcaption></figure>}
      {busy && <div className="rd-progress" role="status"><span />{busy}</div>}{error && <p className="rd-danger" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {currentPdf && onOpenTool && <div className="rd-export-handoff"><strong>Fertiges PDF weiterbearbeiten</strong><button className="btn" disabled={Boolean(busy)} onClick={() => send('pdf-werkzeuge')}>An PDF-Werkstatt</button><button className="btn" disabled={Boolean(busy)} onClick={() => send('dateien-umbenennen')}>An Dateien umbenennen</button><small>Lokale Übergabe. Am Ziel ausdrücklich übernehmen.</small></div>}
    </Overlay>}
  </div>;
}
