import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowLeft, Box, Cable, CircleAlert, Cpu, Database, Download, FileUp, Info, LoaderCircle, Maximize2, Plus, Redo2, Rows3, Save, Search, ShieldCheck, SquareDashed, ToggleLeft, Undo2, X, Zap } from 'lucide-react';
import type { ToolProps } from '../../toolbox/modules.ts';
import ToolHeader from '../../toolbox/ToolHeader.tsx';
import { stageToolHandoff } from '../../toolbox/toolHandoff.ts';
import { downloadBlob, downloadText } from '../../shared/download.ts';
import { useDialogFocus } from '../../shared/useDialogFocus.ts';
import { useProjectHub } from '../projektzentrale/projectHubState.ts';
import VerteilerCanvas, { DRAG_TYPE } from './VerteilerCanvas.tsx';
import VerteilerInspector from './VerteilerInspector.tsx';
import VerteilerChecks from './VerteilerChecks.tsx';
import LibrarySettings from './LibrarySettings.tsx';
import { analyzeDocument, exportDocument, getCatalog, getDefault, listDocuments, loadDocument, previewDocument, saveDocument } from './verteilerApi.ts';
import type { ExportFormat } from './verteilerApi.ts';
import { contentKey, DRAFT_KEY, initialHistory, MAX_DOCUMENT_BYTES, mergeSourceSnapshots, newPlacement, parseDocumentJson, profileSize, pushHistory, readDraft, snapToRail, travelHistory, withProfileSnapshot, writeDraft } from './documentStore.ts';
import type { History } from './documentStore.ts';
import type { Analysis, CabinetView, Catalog, DeviceKind, DeviceProfile, DistributionDocument, DocumentSummary, Issue, Placement } from './types.ts';
import './verteiler-dispo.css';

const KIND_LABELS: Record<DeviceKind, string> = { switch: 'Hauptschalter', rcd: 'RCD / FI', mcb: 'LS-Schalter', knx: 'KNX', terminal: 'Klemmen', busbar: 'Sammelschienen', custom: 'Freie Bauteile', reserve: 'Reserve' };
const KIND_ICONS = { switch: ToggleLeft, rcd: ShieldCheck, mcb: Zap, knx: Cpu, terminal: Rows3, busbar: Cable, custom: Box, reserve: SquareDashed };
const message = (error: unknown) => error instanceof Error ? error.message : 'Die Aktion konnte nicht abgeschlossen werden.';
function Modal({ title, close, children, busy = false }: { title: string; close: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); useDialogFocus(ref, close, busy);
  return <div className="vd-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) close(); }}><section ref={ref} className="vd-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
    <header><h2>{title}</h2><button className="btn vd-close" type="button" onClick={close} disabled={busy} aria-label={`${title} schliessen`}><X size={21} /></button></header>{children}
  </section></div>;
}
function readInitialDraft() {
  try { return { raw: localStorage.getItem(DRAFT_KEY) ?? '', error: '' }; }
  catch { return { raw: '', error: 'Der Browserentwurf kann nicht gelesen werden. Bitte gespeicherte Dokumente öffnen.' }; }
}
export default function VerteilerDispo({ onHome, onOpenTool }: ToolProps) {
  const [initial] = useState(readInitialDraft), [catalog, setCatalog] = useState<Catalog | null>(null);
  const [history, setHistory] = useState<History | null>(null), [loaded, setLoaded] = useState(false);
  const document = history?.present ?? null, current = useRef<DistributionDocument | null>(null); current.current = document;
  const [view, setView] = useState<CabinetView>('front'), [svg, setSvg] = useState(''), [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState<string[]>([]), [focusId, setFocusId] = useState<string | null>(null), [focusField, setFocusField] = useState('');
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [tab, setTab] = useState<'properties' | 'checks'>('properties'), [search, setSearch] = useState(''), [dragProfile, setDragProfile] = useState<string | null>(null);
  const [error, setError] = useState(initial.error), [notice, setNotice] = useState(''), [busy, setBusy] = useState(''), [rendering, setRendering] = useState(false), [expanded, setExpanded] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Wird geladen …'), [storageError, setStorageError] = useState(''), [draftBlocked, setDraftBlocked] = useState(false);
  const [dialog, setDialog] = useState<'new' | 'open' | 'export' | null>(null), [savedDocuments, setSavedDocuments] = useState<DocumentSummary[]>([]);
  const [template, setTemplate] = useState('uv-basic'), [newVnb, setNewVnb] = useState('none');
  const [paper, setPaper] = useState<'A4' | 'A3'>('A4'), [exportView, setExportView] = useState<'both' | CabinetView>('both');
  const [custom, setCustom] = useState(false), [customName, setCustomName] = useState('Eigenes Bauteil'), [customKind, setCustomKind] = useState<DeviceKind>('custom');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [pdf, setPdf] = useState<{ file: File; key: string } | null>(null);
  const baseRevision = useRef(0), savedKey = useRef(''), savePromise = useRef<Promise<boolean> | null>(null), saveError = useRef(false);
  const mounted = useRef(true), input = useRef<HTMLInputElement>(null), sequence = useRef(0), importSequence = useRef(0);
  const { active, error: projectError } = useProjectHub();
  const profiles = useMemo(() => {
    const entries = new Map((catalog?.profiles ?? []).map(p => [p.id, p]));
    for (const p of document?.profiles ?? []) entries.set(p.id, p);
    const words = search.toLocaleLowerCase('de-CH').split(/\s+/u).filter(Boolean);
    return [...entries.values()].filter(p => words.every(word => `${p.name} ${p.manufacturer} ${p.article} ${KIND_LABELS[p.kind]}`.toLocaleLowerCase('de-CH').includes(word)));
  }, [catalog, document, search]);

  useEffect(() => {
    mounted.current = true; let cancelled = false;
    void (async () => {
      try {
        const [sourceCatalog, blank] = await Promise.all([getCatalog(), getDefault('uv-basic', 'none')]);
        if (cancelled) return;
        setCatalog(sourceCatalog);
        let next = blank, revision = 0, key = '';
        if (initial.raw) {
          try { const draft = readDraft(initial.raw); await analyzeDocument(draft.document); next = draft.document; revision = draft.baseRevision; key = draft.savedKey; setNotice('Lokaler Entwurf wiederhergestellt. Der gespeicherte Quellenstand bleibt erhalten.'); }
          catch (caught) { setDraftBlocked(true); setError(`Lokaler Entwurf bleibt erhalten: ${message(caught)}`); }
        }
        if (cancelled) return;
        baseRevision.current = revision; savedKey.current = key;
        setHistory(initialHistory(next)); setLoaded(true); setSaveStatus(key === contentKey(next) ? `Gespeichert · Revision ${revision}` : 'Entwurf wiederhergestellt / neu');
      } catch (caught) { if (!cancelled) setError(message(caught)); }
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  function commit(next: DistributionDocument) {
    setHistory(old => old ? pushHistory(old, next) : initialHistory(next)); setError(''); setPdf(null); saveError.current = false;
  }
  function setCurrent(next: DistributionDocument, revision: number, key: string) {
    baseRevision.current = revision; savedKey.current = key; saveError.current = false;
    current.current = next; setHistory(initialHistory(next)); setSelected([]); setFocusId(null); setAnalysis(null); setSvg(''); setPdf(null); setError('');
    setSaveStatus(revision ? `Gespeichert · Revision ${revision}` : 'Neuer Entwurf');
  }
  async function saveCurrent(): Promise<boolean> {
    if (savePromise.current) return savePromise.current;
    const snapshot = current.current;
    if (!snapshot || draftBlocked) return false;
    if (contentKey(snapshot) === savedKey.current) return true;
    const key = contentKey(snapshot), request = { ...snapshot, revision: baseRevision.current };
    setSaveStatus('Speichern …');
    const pending = (async () => {
      try {
        const saved = await saveDocument(request, baseRevision.current);
        if (mounted.current && current.current?.id === snapshot.id) {
          baseRevision.current = saved.revision; savedKey.current = key; saveError.current = false;
          setHistory(old => old && old.present.id === snapshot.id ? { ...old, present: { ...old.present, revision: saved.revision } } : old);
          setSaveStatus(contentKey(current.current) === key ? `Gespeichert · Revision ${saved.revision}` : 'Weitere Änderungen warten auf Speicherung');
          try { localStorage.setItem(DRAFT_KEY, writeDraft({ document: { ...current.current, revision: saved.revision }, baseRevision: saved.revision, savedKey: key })); setStorageError(''); }
          catch { setStorageError('Der Browserentwurf konnte nicht gesichert werden. Der bestätigte Datenbankstand bleibt erhalten.'); }
        }
        return true;
      } catch (caught) {
        if (mounted.current && current.current?.id === snapshot.id) { saveError.current = true; setSaveStatus('Nicht gespeichert'); setError(message(caught)); }
        return false;
      } finally { savePromise.current = null; }
    })();
    savePromise.current = pending; return pending;
  }
  useEffect(() => {
    if (!document || !loaded || draftBlocked) return;
    try { localStorage.setItem(DRAFT_KEY, writeDraft({ document, baseRevision: baseRevision.current, savedKey: savedKey.current })); setStorageError(''); }
    catch { setStorageError('Der Browserentwurf konnte nicht gesichert werden. Bitte JSON herunterladen.'); }
    if (contentKey(document) === savedKey.current || saveError.current) return;
    setSaveStatus('Änderungen · Autosave wartet');
    const timer = window.setTimeout(() => { void saveCurrent(); }, 1100);
    return () => window.clearTimeout(timer);
  }, [document, loaded, draftBlocked]);
  useEffect(() => {
    if (!document) return;
    const id = ++sequence.current, controller = new AbortController(); setRendering(true);
    const timer = window.setTimeout(() => {
      void Promise.all([analyzeDocument(document, controller.signal), previewDocument(document, view, controller.signal)]).then(([nextAnalysis, preview]) => {
        if (sequence.current === id) { setAnalysis(nextAnalysis); setSvg(preview.svg); }
      }).catch(caught => { if (!controller.signal.aborted && sequence.current === id) setError(message(caught)); }).finally(() => { if (sequence.current === id) setRendering(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [document, view]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (current.current && (storageError || draftBlocked || contentKey(current.current) !== savedKey.current)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [storageError, draftBlocked]);

  async function ensureSaved(): Promise<boolean> {
    if (!await saveCurrent()) return false;
    if (!current.current || contentKey(current.current) === savedKey.current) return true;
    return await saveCurrent() && Boolean(current.current && contentKey(current.current) === savedKey.current);
  }
  async function leave(action: () => void) { if (!busy && !custom && !dialog && !libraryOpen && await ensureSaved()) action(); }
  function select(id: string | null, multiple = false) {
    setFocusField(''); setFocusId(null); setFocusTarget(null);
    setSelected(old => id ? multiple ? old.includes(id) ? old.filter(value => value !== id) : [...old, id] : old.includes(id) ? old : [id] : []);
  }
  function add(profileId: string, x?: number, y?: number, supplied?: DeviceProfile) {
    if (!document) return;
    const profile = supplied ?? document.profiles.find(p => p.id === profileId) ?? catalog?.profiles.find(p => p.id === profileId); if (!profile) return;
    try {
      const snapshot = withProfileSnapshot(document, profile, catalog?.sources ?? []), base = snapshot.document;
      const placement = newPlacement(base, snapshot.profile, crypto.randomUUID(), x, y);
      commit({ ...base, cabinet: { ...base.cabinet, placements: [...base.cabinet.placements, placement] } }); setSelected([placement.id]); setTab('properties');
    } catch (caught) { setError(message(caught)); }
  }
  function move(ids: string[], dx: number, dy: number) {
    if (!document) return;
    commit({ ...document, cabinet: { ...document.cabinet, placements: document.cabinet.placements.map(p => {
      if (!ids.includes(p.id)) return p;
      const profile = document.profiles.find(item => item.id === p.profile_id); if (!profile) return p;
      const rect = profileSize(profile, p.rotation), snap = snapToRail(document, { ...profile, width_mm: rect.width, height_mm: rect.height }, p.x_mm + dx, p.y_mm + dy);
      return { ...p, x_mm: snap.x_mm, y_mm: snap.y_mm, z_mm: profile.mounting === 'din' ? snap.z_mm : p.z_mm,
        rail_id: snap.rail?.id ?? null, field_id: snap.rail?.field_id ?? p.field_id };
    }) } });
  }
  function remove() { if (document && selected.length) { commit({ ...document, cabinet: { ...document.cabinet, placements: document.cabinet.placements.map(p => selected.includes(p.id) ? { ...p, status: 'removed' } : p) } }); setSelected([]); } }
  function copy() {
    if (!document || !selected.length) return;
    const copies = document.cabinet.placements.filter(p => selected.includes(p.id) && p.status !== 'removed').map(p => ({ ...p, id: crypto.randomUUID(), label: `${p.label} · Kopie`, x_mm: p.x_mm + 36, source_circuit_id: null }));
    commit({ ...document, cabinet: { ...document.cabinet, placements: [...document.cabinet.placements, ...copies] } }); setSelected(copies.map(p => p.id));
  }
  function updatePlacement(patch: Partial<Placement>) {
    if (document && selected[0]) commit({ ...document, cabinet: { ...document.cabinet, placements: document.cabinet.placements.map(p => p.id === selected[0] ? { ...p, ...patch } : p) } });
  }
  function updateProfile(patch: Partial<DeviceProfile>) {
    if (!document) return;
    const placement = document.cabinet.placements.find(p => p.id === selected[0]), old = document.profiles.find(p => p.id === placement?.profile_id); if (!placement || !old) return;
    const shared = document.cabinet.placements.filter(p => p.profile_id === old.id).length > 1 || old.geometry_status === 'documented';
    const updated = { ...old, ...patch, id: shared ? crypto.randomUUID() : old.id, geometry_status: 'generic' as const };
    commit({ ...document, profiles: shared ? [...document.profiles, updated] : document.profiles.map(p => p.id === old.id ? updated : p),
      cabinet: { ...document.cabinet, placements: document.cabinet.placements.map(p => p.id === placement.id ? { ...p, profile_id: updated.id } : p) } });
  }
  function visitIssue(issue: Issue) {
    const placement = document?.cabinet.placements.find(p => p.id === issue.target_id);
    setSelected(placement ? [placement.id] : []); setFocusTarget(issue.target_id); setFocusId(placement?.id ?? null); setFocusField(`${issue.field}#${Date.now()}`); setTab('properties');
    if (placement) setView('internal');
    if (issue.field === 'vnb_id' || issue.field === 'cabinet.vnb_id') window.document.querySelector<HTMLSelectElement>('select[aria-label="Netzbetreiber"]')?.focus();
  }
  async function newDocument() {
    setBusy('Vorlage laden …');
    try { if (!await ensureSaved()) return; const next = await getDefault(template, newVnb); setCurrent(next, 0, ''); setDialog(null); setNotice('Neue Vorlage geladen. Hersteller- und VNB-Nachweise im Prüfbericht ergänzen.'); }
    catch (caught) { setError(message(caught)); } finally { setBusy(''); }
  }
  async function openDocument(id: string) {
    setBusy('Verteiler öffnen …');
    try { if (!await ensureSaved()) return; const next = await loadDocument(id); setCurrent(next.document, next.revision, contentKey(next.document)); setDialog(null); }
    catch (caught) { setError(message(caught)); } finally { setBusy(''); }
  }
  async function importFile(file: File) {
    const id = ++importSequence.current; setBusy('JSON prüfen …');
    try {
      if (file.size > MAX_DOCUMENT_BYTES) throw new Error('Verteiler-Dateien dürfen höchstens 12 MiB gross sein.');
      const next = parseDocumentJson(await file.text()); await analyzeDocument(next);
      if (id !== importSequence.current || !await ensureSaved()) return;
      setCurrent({ ...next, id: crypto.randomUUID(), revision: 0 }, 0, ''); setNotice('JSON als neue Kopie übernommen. Vorhandene gespeicherte Verteiler wurden nicht überschrieben.');
    } catch (caught) { setError(message(caught)); } finally { if (id === importSequence.current) setBusy(''); }
  }
  function adoptVnb(value: string) {
    if (!document || !catalog) return;
    const profile = catalog.vnb_profiles.find(p => p.id === value);
    const merged = mergeSourceSnapshots(document.sources, catalog.sources.filter(s => profile?.source_ids.includes(s.id)));
    commit({ ...document, vnb_id: profile?.id ?? 'none', vnb_profile_version: profile?.edition ?? '', sources: merged.sources });
  }
  async function runExport(format: ExportFormat) {
    if (!document || busy) return;
    const snapshot = document; setBusy(`${format.toUpperCase()} wird erstellt …`); setError('');
    try {
      const file = await exportDocument(snapshot, format, exportView === 'both' ? ['front', 'internal'] : [exportView], paper);
      downloadBlob(file, file.name); if (format === 'pdf') setPdf({ file, key: contentKey(snapshot) });
      setNotice(`${file.name} erstellt und zum Speichern übergeben.`); setDialog(null);
    } catch (caught) { setError(message(caught)); } finally { setBusy(''); }
  }
  async function sendPdf(target: 'pdf-werkzeuge' | 'dateien-umbenennen') {
    if (!currentPdf || !onOpenTool || busy || !await ensureSaved()) return;
    try { stageToolHandoff({ target, source: 'Verteiler-Dispo', files: [currentPdf], projectId: document?.project_id ?? undefined, projectLabel: document?.project_number }); setDialog(null); onOpenTool(target); }
    catch (caught) { setError(message(caught)); }
  }
  function createCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), value = (key: string) => Number(String(form.get(key)).replace(',', '.'));
    const depthText = String(form.get('depth') ?? '').trim();
    const profile: DeviceProfile = { id: crypto.randomUUID(), name: customName.trim(), kind: customKind, manufacturer: 'Eigene Vorgabe', article: '',
      width_mm: value('width'), height_mm: value('height'), depth_mm: depthText ? value('depth') : null, te: null, mounting: String(form.get('mounting')) as DeviceProfile['mounting'],
      power_loss_w: null, rated_current_a: null, clearance_mm: 0, source_ids: [], geometry_status: 'generic', terminal_kind: '', busbar_section_width_mm: null, busbar_section_thickness_mm: null };
    if (!profile.name || !Number.isFinite(profile.width_mm) || profile.width_mm <= 0 || !Number.isFinite(profile.height_mm) || profile.height_mm <= 0 || (profile.depth_mm !== null && (!Number.isFinite(profile.depth_mm) || profile.depth_mm < 0))) { setError('Bitte gültige Bauteilmasse eintragen.'); return; }
    add(profile.id, undefined, undefined, profile); setCustom(false);
  }
  const errors = analysis?.issues.filter(i => i.severity === 'error').length ?? 0, open = analysis?.issues.filter(i => i.severity === 'open' || i.severity === 'warning').length ?? 0;
  const currentPdf = pdf && document && pdf.key === contentKey(document) ? pdf.file : null;
  return <div className={`verteiler-dispo ${expanded ? 'vd-expanded' : ''}`}>
    <ToolHeader title="Verteiler-Dispo" currentToolId="verteiler-dispo" onHome={() => void leave(onHome)} onOpenTool={id => void leave(() => onOpenTool?.(id))} disabled={Boolean(busy)} />
    <input ref={input} type="file" accept=".json,application/json" aria-label="Verteiler-JSON importieren" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file); }} />
    <main className="vd-main">
      <header className="vd-toolbar"><div><span className="vd-eyebrow">ELEKTROPLANUNG</span><h1>Verteiler-Dispo</h1><p>{document?.name ?? 'Lokalen Plan laden'}{document ? ` · ${document.cabinet.kind} · ${document.cabinet.width_mm} × ${document.cabinet.height_mm} × ${document.cabinet.depth_mm} mm` : ''}</p></div>
        <div className="vd-actions"><button className="btn" type="button" disabled={!loaded || Boolean(busy)} onClick={() => setDialog('new')}><Plus size={16} /> Neu</button>
          <button className="btn" type="button" disabled={!document || Boolean(busy)} onClick={() => setLibraryOpen(true)}><Database size={16} /> Firmenvorlagen</button>
          <button className="btn" type="button" disabled={!loaded || Boolean(busy)} onClick={() => { setDialog('open'); void listDocuments().then(setSavedDocuments).catch(e => setError(message(e))); }}>Öffnen</button>
          <button className="btn" type="button" disabled={!loaded || Boolean(busy)} onClick={() => input.current?.click()}><FileUp size={16} /> JSON</button>
          <button className="btn" aria-label="Rückgängig" type="button" disabled={!history?.past.length || Boolean(busy)} onClick={() => { setHistory(h => h ? travelHistory(h, false) : h); saveError.current = false; }}><Undo2 size={17} /></button>
          <button className="btn" aria-label="Wiederholen" type="button" disabled={!history?.future.length || Boolean(busy)} onClick={() => { setHistory(h => h ? travelHistory(h, true) : h); saveError.current = false; }}><Redo2 size={17} /></button>
          <button className="btn" type="button" disabled={!loaded || Boolean(busy) || draftBlocked} onClick={() => { saveError.current = false; void saveCurrent(); }}><Save size={16} /> Speichern</button>
          <button className="btn primary" type="button" disabled={!document || Boolean(busy)} onClick={() => setDialog('export')}><Download size={16} /> Export</button></div>
      </header>
      {(error || storageError || projectError) && <div className="vd-banner vd-banner-error" role="alert"><CircleAlert size={18} /><span>{error || storageError || projectError}</span><button type="button" aria-label="Hinweis schliessen" onClick={() => setError('')}><X size={19} /></button></div>}
      {draftBlocked && <div className="vd-banner"><span>Der ursprüngliche Browserentwurf wird nicht überschrieben.</span><button className="btn" type="button" onClick={() => downloadText('Verteiler-Wiederherstellung.json', initial.raw)}>Rohdatei sichern</button><button className="btn" type="button" onClick={() => { if (window.confirm('Den unlesbaren Browserentwurf verwerfen? Zuerst kannst du die Rohdatei sichern.')) { setDraftBlocked(false); setError(''); } }}>Defekten Entwurf verwerfen</button></div>}
      {notice && <div className="vd-banner vd-banner-notice" role="status"><span>{notice}</span><button type="button" aria-label="Mitteilung schliessen" onClick={() => setNotice('')}><X size={19} /></button></div>}
      {busy && <div className="vd-busy" role="status"><LoaderCircle size={17} className="vd-spin" /> {busy}</div>}
      {!document || !catalog ? <div className="vd-loading"><LoaderCircle className="vd-spin" size={26} /><p>{error ? 'Die Verteiler-Dispo konnte nicht vollständig geladen werden.' : 'Vorlagen und lokalen Entwurf laden …'}</p></div> : <>
        <section className="vd-viewbar"><div className="vd-segment" role="group" aria-label="Darstellung"><button type="button" aria-pressed={view === 'front'} onClick={() => setView('front')}>Mit Abdeckungen</button><button type="button" aria-pressed={view === 'internal'} onClick={() => setView('internal')}>Einbauansicht</button></div>
          <label>Netzbetreiber <select aria-label="Netzbetreiber" data-field="vnb_id" value={document.vnb_id} onChange={event => adoptVnb(event.target.value)}><option value="none">Ohne VNB-Zuordnung</option>{catalog.vnb_profiles.map(v => <option key={v.id} value={v.id}>{v.name} · {v.edition}</option>)}</select></label>
          <button className="btn vd-project" type="button" disabled={!active} onClick={() => { if (active) { commit({ ...document, project_id: active.id, project_number: active.number, project_name: active.name }); setNotice('Aktives Projekt ausdrücklich übernommen.'); } }} title={active ? `${active.number} · ${active.name}` : 'Kein aktives Projekt ausgewählt'}>{active ? `Projekt ${active.number} übernehmen` : 'Kein aktives Projekt'}</button>
          <button className="btn vd-expand" type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}><Maximize2 size={16} />{expanded ? 'Normalansicht' : 'Arbeitsfläche gross'}</button>
        </section>
        <div className="vd-workspace"><aside className="vd-library" aria-label="Bauteilbibliothek"><header><h2>Bauteile</h2><button className="btn" type="button" aria-label="Freies Bauteil anlegen" onClick={() => setCustom(true)}><Plus size={17} /></button></header>
          <label className="vd-search"><Search size={15} /><input placeholder="Artikel oder Bauteil suchen …" aria-label="Bauteil suchen" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="vd-library-list">{(Object.keys(KIND_LABELS) as DeviceKind[]).map(kind => {
            const entries = profiles.filter(p => p.kind === kind), PartIcon = KIND_ICONS[kind]; return entries.length ? <section key={kind}><h3>{KIND_LABELS[kind]}</h3>{entries.map(profile => <button type="button" className="vd-library-part" key={profile.id} aria-label={`${profile.name} hinzufügen`} draggable disabled={Boolean(busy)} onDragStart={event => { setDragProfile(profile.id); event.dataTransfer.setData(DRAG_TYPE, profile.id); event.dataTransfer.setData('text/plain', profile.id); event.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={() => setDragProfile(null)} onClick={() => add(profile.id)}>
              <span className={`vd-device-icon vd-kind-${profile.kind}`} aria-hidden="true"><PartIcon size={17} /></span><span><strong>{profile.name}</strong><small>{profile.manufacturer}{profile.article ? ` · ${profile.article}` : ''}</small><small>{profile.te !== null ? `${profile.te} TE · ` : ''}{profile.width_mm} × {profile.height_mm} mm{profile.geometry_status === 'generic' ? ' · eigene Geometrie' : ''}</small></span><Plus size={13} /></button>)}</section> : null;
          })}{!profiles.length && <p className="vd-muted">Keine Bauteile zur Suche.</p>}</div>
          <details className="vd-library-help"><summary><Info size={14} /> Bedienung</summary><p>Klicken oder in den Plan ziehen. Pfeiltasten verschieben; oben/unten wählt die benachbarte Schiene. Strg+D kopiert. Herstellerdaten und Nachweise im Prüfbericht prüfen.</p></details>
        </aside>
          <section className="vd-drawing"><div className="vd-drawing-heading"><strong>{view === 'front' ? 'Frontansicht · mit Abdeckungen' : 'Einbauansicht · ohne Abdeckungen'}</strong><small>{document.cabinet.placements.filter(p => p.status !== 'removed').length} Apparate · CAD in mm</small></div>
            <VerteilerCanvas document={document} availableProfiles={profiles} svg={svg} selected={selected} issues={analysis?.issues ?? []} focusId={focusId} focusToken={focusField} dragProfile={dragProfile} busy={Boolean(busy)} onSelect={select} onPlace={add} onMove={move} onDelete={remove} onCopy={copy} />
            <div className="vd-object-select"><label>Bauteil auswählen<select aria-label="Platziertes Bauteil auswählen" value={selected[0] ?? ''} onChange={event => { setSelected(event.target.value ? [event.target.value] : []); setTab('properties'); }}><option value="">Plan und Gehäuse</option>{document.cabinet.placements.map(p => <option key={p.id} value={p.id}>{p.label}{p.status === 'removed' ? ' · entfallen' : ''}</option>)}</select></label><button className="btn" type="button" disabled={!selected.length} onClick={() => setSelected([])}><ArrowLeft size={14} /> Gehäuse</button></div>
          </section>
          <aside className="vd-properties" aria-label="Eigenschaften und Prüfbericht"><nav className="vd-tabs"><button type="button" aria-pressed={tab === 'properties'} onClick={() => setTab('properties')}>Eigenschaften</button><button type="button" aria-pressed={tab === 'checks'} onClick={() => setTab('checks')}>Prüfbericht <span>{analysis?.issues.length ?? '…'}</span></button></nav>
            {tab === 'properties' ? <fieldset className="vd-inspector-lock" disabled={Boolean(busy)}><VerteilerInspector document={document} selectedId={selected[0] ?? null} focusField={focusField} focusTarget={focusTarget} commit={commit} updatePlacement={updatePlacement} updateProfile={updateProfile} onCopy={copy} onDelete={remove} /></fieldset> : <VerteilerChecks analysis={analysis} sources={document.sources} selectedId={selected[0] ?? null} onVisit={visitIssue} />}
          </aside>
        </div>
        <footer className="vd-status"><span role="status" className={saveStatus.startsWith('Nicht') ? 'vd-error' : ''}>{saveStatus}</span><span>{rendering ? 'Prüfung aktualisiert …' : `${errors} Konflikte · ${open} Nachweise/Hinweise`}</span><span>{analysis ? `${analysis.occupied_te.toLocaleString('de-CH')} TE belegt · ${analysis.free_te.toLocaleString('de-CH')} TE frei` : ''}</span><span>{analysis ? `${analysis.known_loss_w.toLocaleString('de-CH')} W bekannte Verluste${analysis.missing_loss_count ? ` · ${analysis.missing_loss_count} Angaben offen` : ''}` : ''}</span></footer>
      </>}
    </main>
    {libraryOpen && document && <LibrarySettings document={document} onClose={() => setLibraryOpen(false)} onChanged={async () => { setCatalog(await getCatalog()); setNotice('Firmenbibliothek aktualisiert. Der offene Verteiler behält seinen bisherigen Vorlagenstand.'); }} />}
    {dialog === 'new' && <Modal title="Neuer Verteiler" busy={Boolean(busy)} close={() => setDialog(null)}><label className="vd-field"><span>Aufbauvorlage</span><select aria-label="Aufbauvorlage" value={template} onChange={event => setTemplate(event.target.value)}>{catalog?.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p className="vd-muted">{catalog?.templates.find(t => t.id === template)?.description}</p><label className="vd-field"><span>VNB / Versorgungsgebiet</span><select aria-label="Neuer Netzbetreiber" value={newVnb} onChange={event => setNewVnb(event.target.value)}><option value="none">Später zuordnen</option>{catalog?.vnb_profiles.map(v => <option key={v.id} value={v.id}>{v.name} · {v.edition}</option>)}</select></label><p className="vd-muted">Die Vorlage ist eine Planungsgrundlage. Aktuelle Werkvorschriften, Herstellerkompatibilität und Nachweise bleiben sichtbar zu prüfen.</p><footer><button className="btn" disabled={Boolean(busy)} onClick={() => setDialog(null)}>Abbrechen</button><button className="btn primary" disabled={Boolean(busy)} onClick={() => void newDocument()}>Verteiler anlegen</button></footer></Modal>}
    {dialog === 'open' && <Modal title="Gespeicherte Verteiler" busy={Boolean(busy)} close={() => setDialog(null)}><div className="vd-document-list">{savedDocuments.length ? savedDocuments.map(item => <button className="btn" type="button" disabled={Boolean(busy)} key={item.id} onClick={() => void openDocument(item.id)}><strong>{item.name}</strong><span>{item.project_number || 'Ohne Projekt'} · Revision {item.revision}</span><small>{new Date(item.updated_at).toLocaleString('de-CH')}</small></button>) : <p>Noch keine gespeicherten Verteiler.</p>}</div><button className="btn" type="button" disabled={!document || Boolean(busy)} onClick={() => { if (!document) return; setCurrent({ ...document, id: crypto.randomUUID(), name: `${document.name} · Kopie`, revision: 0 }, 0, ''); setDialog(null); }}>Offenen Entwurf als neue Kopie speichern</button></Modal>}
    {dialog === 'export' && <Modal title="Verteiler exportieren" busy={Boolean(busy)} close={() => setDialog(null)}><div className="vd-two"><label className="vd-field"><span>Ansichten</span><select value={exportView} onChange={event => setExportView(event.target.value as typeof exportView)}><option value="both">Front und Einbau</option><option value="front">Mit Abdeckungen</option><option value="internal">Einbauansicht</option></select></label><label className="vd-field"><span>Papierformat</span><select value={paper} onChange={event => setPaper(event.target.value as typeof paper)}><option value="A4">A4</option><option value="A3">A3</option></select></label></div><p className="vd-muted">Massstab und Plankopf aus demselben Zeichnungsstand. Offene Nachweise werden mit ausgegeben.</p><div className="vd-export-grid">{([['pdf', 'PDF mit Plankopf'], ['svg', 'SVG-Zeichnung'], ['dxf', 'DXF in Millimetern'], ['bom-csv', 'Stückliste CSV'], ['terminals-csv', 'Klemmenliste CSV'], ['json', 'Dispo-JSON']] as [ExportFormat, string][]).map(([format, label]) => <button className="btn" type="button" disabled={Boolean(busy)} key={format} onClick={() => void runExport(format)}><Download size={16} /> {label}</button>)}</div>
      {currentPdf && onOpenTool && <details className="vd-details"><summary>Fertiges PDF weitergeben</summary>{(['pdf-werkzeuge', 'dateien-umbenennen'] as const).map(target => <button key={target} type="button" className="btn" onClick={() => void sendPdf(target)}>{target === 'pdf-werkzeuge' ? 'PDF-Werkstatt' : 'Dateien umbenennen'} ↗</button>)}</details>}
    </Modal>}
    {custom && <Modal title="Eigenes Bauteil" busy={Boolean(busy)} close={() => setCustom(false)}><form onSubmit={createCustom}><label className="vd-field"><span>Name</span><input required maxLength={120} value={customName} onChange={event => setCustomName(event.target.value)} /></label><label className="vd-field"><span>Gruppe</span><select value={customKind} onChange={event => setCustomKind(event.target.value as DeviceKind)}>{Object.entries(KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><div className="vd-two"><label className="vd-field"><span>Breite (mm)</span><input name="width" type="number" min="0.1" step="any" required defaultValue="18" /></label><label className="vd-field"><span>Höhe (mm)</span><input name="height" type="number" min="0.1" step="any" required defaultValue="80" /></label></div><label className="vd-field"><span>Tiefe (mm), unbekannt = leer</span><input name="depth" type="number" min="0" step="any" /></label><label className="vd-field"><span>Montage</span><select name="mounting"><option value="free">Freier Block</option><option value="din">Hutschiene</option><option value="plate">Montageplatte</option></select></label><p className="vd-muted">Eigene Geometrie bleibt ohne Herstellernachweis gekennzeichnet.</p><footer><button className="btn" type="button" onClick={() => setCustom(false)}>Abbrechen</button><button className="btn primary" type="submit">Bauteil hinzufügen</button></footer></form></Modal>}
  </div>;
}
