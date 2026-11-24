import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, Download, Info, RefreshCw, Save, X } from 'lucide-react';
import { useDialogFocus } from '../../shared/useDialogFocus';
import { downloadText } from '../../shared/download';
import { readJson } from '../../shared/http';
import { usePresentation } from '../../toolbox/PresentationSettings';
import type { DistributionDocument } from './types.ts';

interface LibraryStatus {
  revision: string; path: string; configured: boolean; sha256: string; loaded_at: string;
  cached_path: string; offline: boolean; using_cache: boolean; needs_reload: boolean;
  error: string; profiles_count: number; templates_count: number;
}
interface Props { document: DistributionDocument; onChanged: () => void | Promise<void>; onClose: () => void }
const API = '/api/tools/verteiler-dispo/library';

async function requestStatus(path = '', body?: object, method = 'POST', signal?: AbortSignal): Promise<LibraryStatus> {
  return readJson<LibraryStatus>(await fetch(API + path, body === undefined ? { signal } : {
    method, signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), 'Die Firmenvorlagen konnten nicht geladen werden.');
}

function templatePack(document: DistributionDocument): string {
  const copy = structuredClone(document);
  Object.assign(copy, { revision: 0, project_id: null, project_number: '', project_name: '',
    location: '', author: '', drawing_number: '', schematic_ref: '', index: '' });
  copy.cabinet.placements = copy.cabinet.placements.map(placement => ({ ...placement, source_circuit_id: null }));
  return JSON.stringify({ schema_version: 1, documents: [copy] }, null, 2) + '\n';
}

export default function LibrarySettings({ document: current, onChanged, onClose }: Props) {
  const { policy } = usePresentation();
  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useDialogFocus(dialog, onClose, Boolean(busy));
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void requestStatus('', undefined, 'GET', controller.signal).then(value => {
      if (mounted.current) { setStatus(value); setPath(value.path); }
    }).catch(caught => {
      if (mounted.current && (caught as Error).name !== 'AbortError') setError((caught as Error).message);
    });
    return () => { mounted.current = false; controller.abort(); };
  }, []);

  async function action(kind: 'save' | 'reload') {
    if (!policy?.can_manage || !status || busy) return;
    setBusy(kind); setError(''); setMessage('');
    try {
      const next = kind === 'save'
        ? await requestStatus('', { path, base_revision: status.revision }, 'PUT')
        : await requestStatus('/reload', {});
      if (!mounted.current) return;
      setStatus(next); setPath(next.path);
      if (!next.error) {
        setMessage(kind === 'save' ? 'Pfad gespeichert. Änderungen mit „Vorlagen laden“ übernehmen.' : 'Firmenvorlagen lokal übernommen. Bestehende Verteiler bleiben unverändert.');
        await onChanged();
      }
    } catch (caught) {
      if (mounted.current) setError((caught as Error).message || 'Die Firmenvorlagen konnten nicht übernommen werden.');
    } finally { if (mounted.current) setBusy(''); }
  }

  function exportTemplate() {
    const stem = current.name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 90) || 'Verteiler';
    downloadText(`Firmenvorlage-${stem}.json`, templatePack(current), 'application/json;charset=utf-8');
  }

  return createPortal(<div className="modal-back" onMouseDown={event => {
    if (!busy && event.currentTarget === event.target) onClose();
  }}>
    <div ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby="vd-library-title" tabIndex={-1}
      style={{ width: 'min(720px, calc(100vw - 32px))', maxHeight: '88vh', overflow: 'auto', padding: 22 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
        <h2 id="vd-library-title" style={{ margin: 0, fontSize: 19, display: 'flex', gap: 9, alignItems: 'center' }}><Database size={20} /> Firmenvorlagen</h2>
        <button type="button" className="btn icon" aria-label="Firmenvorlagen schliessen" disabled={Boolean(busy)} onClick={onClose}><X size={20} /></button>
      </header>

      <label className="vd-field"><span>Bibliothek auf dem Firmenserver</span>
        <input aria-label="Firmenbibliothek-Pfad" value={path} maxLength={1500} spellCheck={false}
          placeholder="\\Server\Planung\Vorlagen\Verteiler.json" disabled={!policy?.can_manage || Boolean(busy)}
          onChange={event => { setPath(event.target.value); setMessage(''); }} />
      </label>
      <div className="vd-actions" style={{ justifyContent: 'flex-start', margin: '12px 0' }}>
        <button type="button" className="btn" disabled={!status || !policy?.can_manage || Boolean(busy)} onClick={() => void action('save')}><Save size={15} /> {busy === 'save' ? 'Wird gespeichert …' : 'Pfad speichern'}</button>
        <button type="button" className="btn" disabled={!status?.configured || !policy?.can_manage || Boolean(busy)} onClick={() => void action('reload')}><RefreshCw size={15} /> {busy === 'reload' ? 'Vorlagen werden geprüft …' : 'Vorlagen laden'}</button>
      </div>
      {!policy?.can_manage && <p className="vd-muted">{policy ? 'Pfad und Bibliotheksübernahme verwalten die hinterlegten Administratoren.' : 'Anmeldung wird geladen …'}</p>}
      {busy && <p role="status" className="vd-muted">{busy === 'reload' ? 'Datei lesen, prüfen und als lokalen Vorlagenstand sichern …' : 'Lokalen Bibliothekspfad speichern …'}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {status?.error && <p role="alert" className="error">{status.error}</p>}
      {message && <p role="status" className="vd-muted">{message}</p>}

      {status && <section style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 13, margin: '14px 0' }}>
        <strong>{status.using_cache ? (status.offline ? 'Server nicht erreichbar · lokaler Stand verfügbar' : 'Lokaler Vorlagenstand verfügbar') : 'Noch kein Firmenstand übernommen'}</strong>
        <p className="vd-muted">{status.templates_count} Verteilervorlagen · {status.profiles_count} zusätzliche Apparate</p>
        {status.loaded_at && <p className="vd-muted">Geladen: {new Date(status.loaded_at).toLocaleString('de-CH')}</p>}
        {status.needs_reload && <p className="vd-muted">Der geänderte Pfad wurde noch nicht übernommen. Der bisherige lokale Stand bleibt aktiv.</p>}
        {status.using_cache && <details className="vd-details"><summary>Quelle und Prüfsumme</summary>
          <p style={{ overflowWrap: 'anywhere' }}>{status.cached_path}</p>
          <p className="vd-muted" style={{ overflowWrap: 'anywhere' }}>SHA-256: {status.sha256}</p>
          <p className="vd-muted">Die Prüfsumme identifiziert die Datei. Sie bestätigt keine elektrische oder normative Freigabe.</p>
        </details>}
      </section>}

      <button type="button" className="btn" onClick={exportTemplate}><Download size={15} /> Aktuellen Aufbau als Firmenvorlage exportieren</button>
      <p className="vd-muted">Projektfelder und Stromkreiszuordnungen werden entfernt. Aufbau, Quellen, Beschriftungen und freie Notizen bleiben enthalten.</p>
      <details className="vd-details"><summary><Info size={14} /> Einrichtung und Dateiformat</summary>
        <ol style={{ lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Den gewünschten Aufbau exportieren und Beschriftungen beziehungsweise Notizen prüfen.</li>
          <li>Die JSON-Datei im Vorlagenordner eures Firmenservers ablegen.</li>
          <li>Den vollständigen Dateipfad eintragen und speichern.</li>
          <li>„Vorlagen laden“ wählen. Die Vorlage steht anschliessend in der Vorlagenauswahl bereit.</li>
        </ol>
        <p className="vd-muted">Dateiversion 1, maximal 2 MiB. Die Bibliothek kann mehrere vollständige Dokumente unter „documents“ sowie zusätzliche „sources“ und „profiles“ enthalten. Eigene Quellen- und Profil-IDs beginnen mit „firma:“. Vorhandene Herstellerprofile werden nicht überschrieben.</p>
        <p className="vd-muted">Der Toolhub liest die Serverdatei ausschliesslich. Der letzte gültige Stand bleibt lokal verfügbar; vorhandene Projektverteiler werden beim Laden einer Bibliothek nicht verändert.</p>
      </details>
    </div>
  </div>, window.document.body);
}
