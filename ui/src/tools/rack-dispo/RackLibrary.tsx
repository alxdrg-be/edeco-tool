import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Cable, Check, Earth, GripVertical, Layers, Plus, Search, Server, SlidersHorizontal, Type, X, Zap } from 'lucide-react';
import type { DeviceProfile, ProfileKind, PortMedium } from './types';
import { createPanelProfile, panelDrawingFill, parsePlanningNumber, profileGroup, profileKindLabels, profileSubtitle } from './rackPanelModel';
import { RackColorField } from './RackFields';
import './rack-panels.css';

export interface RackLibraryProps {
  profiles: DeviceProfile[];
  onAdd: (profileId: string) => void;
  /** Free part: own text, HE and ports; creates a profile for this one device. */
  onAddFree: (profile: DeviceProfile) => boolean | void;
  onDragProfile?: (profileId: string | null) => void;
}

function ProfileIcon({ kind }: { kind: ProfileKind }) {
  const Icon = kind === 'patch' || kind === 'fiber' ? Cable : kind === 'switch' ? Server : kind === 'pdu' || kind === 'ups' ? Zap : kind === 'earth' ? Earth : kind === 'custom' ? Type : Layers;
  return <Icon size={16} aria-hidden="true" />;
}

/** Free parts belong to one device. They are created and changed there, not in the library. */
export function isFreeProfile(profile: DeviceProfile): boolean { return profile.metadata?.free === true; }

export function createFreeProfile(text: string, units: number, portCount: number, drawingFill: string): DeviceProfile {
  return {
    id: `free-${crypto.randomUUID()}`, name: text.trim(), kind: 'custom', units, depthMm: null, inwardCableMm: null, outwardCableMm: null,
    weightKg: null, powerW: null, loadLimitKg: null, portCount, medium: portCount > 0 ? 'RJ45' : 'none', manufacturer: '', article: '',
    source: 'Freies Bauteil · Text und Höhe aus der Planung', verified: false, metadata: { free: true, drawingFill },
  };
}

export default function RackLibrary({ profiles, onAdd, onAddFree, onDragProfile }: RackLibraryProps) {
  const [search, setSearch] = useState('');
  const [free, setFree] = useState(false);
  const filtered = useMemo(() => {
    const term = search.toLocaleLowerCase('de-CH').trim();
    return profiles.filter(profile => !isFreeProfile(profile) && `${profile.name} ${profileKindLabels[profile.kind]} ${profile.manufacturer} ${profile.article} ${profile.portCount || ''} ${profile.medium} ${profile.units} HE`.toLocaleLowerCase('de-CH').includes(term));
  }, [profiles, search]);
  return <section className="rd-library rd-panel" aria-label="Gerätebibliothek">
    <div className="rd-panel-heading"><h2>Bauteile</h2></div>
    <label className="rd-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Bauteil suchen" placeholder="Bauteil suchen …" value={search} onChange={event => setSearch(event.target.value)} /></label>
    <button type="button" className="rd-free-part" onClick={() => setFree(true)}><Type size={16} aria-hidden="true" /><span><strong>Freies Bauteil</strong><small>Eigener Text, HE und Ports</small></span><Plus size={16} aria-hidden="true" /></button>
    <div className="rd-library-groups">
      {(['Panels', 'Aktiv', 'Strom', 'Zubehör'] as const).map(group => {
        const items = filtered.filter(profile => profileGroup(profile) === group);
        if (!items.length) return null;
        return <details className="rd-library-group" key={group} open>
          <summary>{group}<span>{items.length}</span></summary>
          <div>{items.map(profile => <div className="rd-library-item" data-rack-profile={profile.id} key={profile.id}>
            <div className="rd-library-device" draggable tabIndex={0} title={`${profile.name} · ${profileSubtitle(profile)} · ziehen oder mit + einsetzen`} aria-label={`${profile.name}, ${profileSubtitle(profile)}. Mit Eingabetaste einsetzen.`}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onAdd(profile.id); } }}
              onDragStart={event => {
                const payload = JSON.stringify({ profileId: profile.id });
                event.dataTransfer.setData('application/x-edeco-rack-profile', payload);
                event.dataTransfer.setData('text/plain', payload);
                event.dataTransfer.effectAllowed = 'copy'; onDragProfile?.(profile.id);
              }} onDragEnd={() => onDragProfile?.(null)}>
              <span className="rd-device-icon"><ProfileIcon kind={profile.kind} /></span>
              <span className="rd-device-title"><strong>{profile.name}</strong></span>
              <GripVertical size={13} className="rd-drag-grip" aria-hidden="true" />
            </div>
            <button type="button" className="rd-icon-button rd-add-profile" onClick={() => onAdd(profile.id)} aria-label={`${profile.name} einsetzen`} title="Bauteil einsetzen"><Plus size={15} /></button>
          </div>)}</div>
        </details>;
      })}
      {!filtered.length && <div className="rd-empty"><Search size={24} /><p>Kein passendes Bauteil. Mit «Freies Bauteil» eigenen Text setzen.</p></div>}
    </div>
    <details className="rd-help"><summary>Bauteile &amp; Herstellerdaten</summary><p>Die Bauteile sind neutrale Zeichnungsvorlagen. Sie werden in der Dispo nicht verändert. Für eigene Beschriftungen und Sonderhöhen das freie Bauteil verwenden.</p><p>Tiefe, Gewicht und Leistung eines Geräts ergänzt du beim gewählten Gerät unter «Gerätedaten ergänzen», wenn eine Prüfung sie braucht.</p></details>
    {free && <FreePartDialog onClose={() => setFree(false)} onSave={profile => { const saved = onAddFree(profile); if (saved !== false) setFree(false); }} />}
  </section>;
}

export function FreePartDialog({ initial, onSave, onClose }: { initial?: DeviceProfile; onSave: (profile: DeviceProfile) => void; onClose: () => void }) {
  const titleId = useId(), dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(initial?.name ?? ''), [units, setUnits] = useState(String(initial?.units ?? 1)), [ports, setPorts] = useState(String(initial?.portCount ?? 0));
  const [fill, setFill] = useState(panelDrawingFill(initial?.metadata?.drawingFill, '#ffffff')), [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const height = parsePlanningNumber(units, { min: 0, max: 60, integer: true, nullable: false }), count = parsePlanningNumber(ports, { min: 0, max: 288, integer: true, nullable: false });
    if (!text.trim()) { setError('Bitte einen Text eingeben.'); return; }
    if (!height.valid || height.value === null) { setError(`Höhe: ${height.valid ? 'Bitte einen Wert eingeben.' : height.message}`); return; }
    if (!count.valid || count.value === null) { setError(`Ports: ${count.valid ? 'Bitte einen Wert eingeben.' : count.message}`); return; }
    const next = createFreeProfile(text, height.value, count.value, fill);
    onSave(initial ? { ...initial, name: next.name, units: next.units, portCount: next.portCount, medium: next.medium, metadata: { ...initial.metadata, free: true, drawingFill: fill } } : next);
  }
  return <dialog ref={dialog} className="rd-profile-dialog rd-free-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <form onSubmit={submit}>
      <header><div><span className="rd-eyebrow">Nur für dieses Gerät</span><h2 id={titleId}>{initial ? 'Freies Bauteil ändern' : 'Freies Bauteil'}</h2></div><button type="button" className="rd-icon-button rd-close-button" aria-label="Freies Bauteil schliessen" onClick={onClose}><X size={21} /></button></header>
      <div className="rd-dialog-body">
        <div className="rd-form-grid">
          <label className="rd-field rd-wide" data-rack-field="free-text">Text im Plan<input value={text} maxLength={160} autoFocus onChange={event => { setText(event.target.value); setError(''); }} placeholder="z. B. Server BHBHV05 oder Swisscom TV Reserve" /></label>
          <label className="rd-field" data-rack-field="free-units">Höhe (HE)<input inputMode="numeric" value={units} onChange={event => { setUnits(event.target.value); setError(''); }} /></label>
          <label className="rd-field" data-rack-field="free-ports">Ports<input inputMode="numeric" value={ports} onChange={event => { setPorts(event.target.value); setError(''); }} /></label>
          <RackColorField label="Farbe im Plan" value={fill} onChange={setFill} />
        </div>
        <p className="rd-muted">0 HE setzt das Bauteil als Zubehör seitlich. Text, Höhe und Ports gelten nur für dieses Gerät.</p>
        {error && <p role="alert" className="rd-form-error">{error}</p>}
      </div>
      <footer><button type="button" className="rd-button" onClick={onClose}>Abbrechen</button><button type="submit" className="rd-button rd-primary"><Check size={16} />{initial ? 'Übernehmen' : 'Einsetzen'}</button></footer>
    </form>
  </dialog>;
}

type ProfileMeasurement = 'units' | 'portCount' | 'depthMm' | 'inwardCableMm' | 'outwardCableMm' | 'weightKg' | 'powerW' | 'loadLimitKg';
const profileMeasurements: { key: ProfileMeasurement; label: string; max: number; integer?: boolean; required?: boolean }[] = [
  { key: 'units', label: 'Bauhöhe (HE)', max: 60, integer: true, required: true },
  { key: 'portCount', label: 'Anschlüsse / Ports', max: 288, integer: true, required: true },
  { key: 'depthMm', label: 'Gerätetiefe (mm)', max: 5000 },
  { key: 'inwardCableMm', label: 'Kabelraum nach innen (mm)', max: 5000 },
  { key: 'outwardCableMm', label: 'Kabelraum zur Tür (mm)', max: 5000 },
  { key: 'weightKg', label: 'Eigengewicht (kg)', max: 10000 },
  { key: 'powerW', label: 'Aufnahmeleistung (W)', max: 1000000 },
  { key: 'loadLimitKg', label: 'Fachboden-Traglast (kg)', max: 10000 },
];

export function RackProfileDialog({ profile, onSave, onClose }: {
  profile: DeviceProfile | null; onSave: (profile: DeviceProfile) => boolean | void; onClose: () => void;
}) {
  const [initial] = useState(() => profile ?? createPanelProfile());
  const [kind, setKind] = useState<ProfileKind>(initial.kind);
  const [medium, setMedium] = useState<PortMedium>(initial.medium);
  const [verified, setVerified] = useState(initial.verified);
  const [drawingFill, setDrawingFill] = useState(() => panelDrawingFill(initial.metadata?.drawingFill, '#ffffff'));
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    const name = text('name');
    if (!name) { setError('Bitte eine Bezeichnung angeben.'); return; }
    const numbers = {} as Record<ProfileMeasurement, number | null>;
    for (const measurement of profileMeasurements) {
      const parsed = parsePlanningNumber(text(measurement.key), { min: 0, max: measurement.max, integer: measurement.integer, nullable: !measurement.required });
      if (!parsed.valid) { setError(`${measurement.label}: ${parsed.message}`); return; }
      numbers[measurement.key] = parsed.value;
    }
    if (numbers.portCount && medium === 'none') { setError('Für Anschlüsse bitte RJ45 oder LWL wählen. Bei einem Gerät ohne Anschlüsse 0 angeben.'); return; }
    if (verified && (!text('source') || !text('manufacturer'))) { setError('Für belegte Herstellerdaten bitte Hersteller sowie Quelle und Datenstand angeben.'); return; }
    const saved = onSave({ ...initial, ...numbers, units: numbers.units!, portCount: numbers.portCount!, name, kind, medium,
      manufacturer: text('manufacturer'), article: text('article'), source: text('source'), verified,
      metadata: { ...initial.metadata, drawingFill } });
    if (saved === false) setError('Profil wurde nicht übernommen. Bestehende Portzuordnungen und Eingaben prüfen.');
  }
  return <dialog ref={dialog} className="rd-profile-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <form onSubmit={submit}>
      <header><div><span className="rd-eyebrow">Eigene Gerätebibliothek</span><h2 id={titleId}>{profile ? 'Geräteprofil bearbeiten' : 'Neue Vorlage'}</h2></div><button type="button" className="rd-icon-button rd-close-button" aria-label="Profil schliessen" onClick={onClose}><X size={21} /></button></header>
      <div className="rd-dialog-body">
        <div className="rd-form-grid">
          <label className="rd-field rd-wide">Bezeichnung<input name="name" defaultValue={initial.name} required maxLength={160} autoFocus /></label>
          <label className="rd-field">Bauteiltyp<select name="kind" value={kind} onChange={event => setKind(event.target.value as ProfileKind)}>{Object.entries(profileKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="rd-field">Anschlussart<select name="medium" value={medium} onChange={event => setMedium(event.target.value as PortMedium)}><option value="none">Keine Anschlüsse</option><option value="RJ45">RJ45 · Kupfer</option><option value="LWL">LWL · Glasfaser</option></select></label>
          {profileMeasurements.map(measurement => <label className="rd-field" data-rack-field={measurement.key} key={measurement.key}>{measurement.label}<input name={measurement.key} inputMode={measurement.integer ? 'numeric' : 'decimal'} defaultValue={initial[measurement.key] ?? ''} placeholder={measurement.required ? undefined : 'Unbekannt'} required={measurement.required} maxLength={20} /></label>)}
          <RackColorField label="Darstellungsfarbe" value={drawingFill} onChange={setDrawingFill} />
        </div>
        <details className="rd-help"><summary>Massbezug &amp; 0-HE-Zubehör</summary><p>0 HE ist für seitliches oder rückseitiges Zubehör. Gerätetiefe wird ab der jeweiligen Montageebene nach innen gemessen. Kabelraum nach innen kommt dazu; Kabelraum zur Tür wird gegen den Türabstand geprüft. Unbekannt ist kein Nullmass.</p><p>Leistung bedeutet eigene Wirkleistungsaufnahme des Geräts in W. Bei einer USV weder die Nenn-Ausgangsleistung noch bereits summierte Verbraucherlasten eintragen, damit Lasten nicht doppelt gezählt werden. VA wird nicht in W umgerechnet.</p><p>Fachboden-Traglast ist die zulässige Nutzlast ohne sein Eigengewicht. Die HE-Zahl bestimmt keine Portanzahl.</p></details>
        <h3 className="rd-form-section"><SlidersHorizontal size={16} />Manuelle Herstellerangaben</h3>
        <div className="rd-form-grid">
          <label className="rd-field">Hersteller<input name="manufacturer" defaultValue={initial.manufacturer} maxLength={160} /></label>
          <label className="rd-field">Artikelnummer<input name="article" defaultValue={initial.article} maxLength={160} /></label>
          <label className="rd-field rd-wide">Quelle / Herstellerstand<textarea name="source" defaultValue={initial.source} placeholder="Datenblatt, URL und Ausgabedatum …" rows={2} maxLength={2000} /></label>
        </div>
        <label className="rd-checkbox"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />Herstellerdaten anhand dieser Quelle manuell geprüft</label>
        <p className="rd-muted">Die Gerätedaten gelten für alle Geräte dieses Bauteils im Entwurf. Für eine abweichende Beschriftung das freie Bauteil verwenden.</p>
        {error && <p role="alert" className="rd-form-error">{error}</p>}
      </div>
      <footer><button type="button" className="rd-button" onClick={onClose}>Abbrechen</button><button type="submit" className="rd-button rd-primary"><Check size={16} />Profil übernehmen</button></footer>
    </form>
  </dialog>;
}
