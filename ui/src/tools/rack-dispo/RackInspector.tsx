import { Copy, Info, Pencil, Server, Trash2 } from 'lucide-react';
import type { DeviceProfile, MountSide, Placement, PlacementStatus, Rack, WorkState } from './types';
import { RackColorField, RackNumberField, RackTextField } from './RackFields';
import { panelDrawingFill, profileSubtitle } from './rackPanelModel';
import './rack-panels.css';

export interface RackInspectorProps {
  rack: Rack | null;
  placement: Placement | null;
  profile: DeviceProfile | null;
  profiles: DeviceProfile[];
  placements: Placement[];
  onRackChange: (rack: Rack) => void;
  onPlacementChange: (placement: Placement) => void;
  onEditProfile: (profileId: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const sideLabels: Record<MountSide, string> = { front: 'Vorne', rear: 'Hinten', 'zero-left': '0 HE · links', 'zero-right': '0 HE · rechts', 'zero-rear': '0 HE · hinten' };
const workLabels: Record<WorkState, string> = { open: 'Offen', ordered: 'Bestellt', delivered: 'Geliefert', done: 'Erledigt', 'not-required': 'Nicht erforderlich' };
const valueLabel = (value: number | null, unit: string) => value === null ? 'Offen' : `${value.toLocaleString('de-CH')} ${unit}`;

function RackProperties({ rack, onChange }: { rack: Rack; onChange: (rack: Rack) => void }) {
  const number = (field: 'units' | 'widthMm' | 'heightMm' | 'depthMm' | 'usableDepthMm' | 'frontDoorClearanceMm' | 'rearDoorClearanceMm' | 'weightLimitKg' | 'powerBudgetW', label: string, unit: string, required = false, help?: string) =>
    <RackNumberField field={field} label={label} unit={unit} value={rack[field]} min={required ? 1 : 0} max={field === 'units' ? 60 : field === 'powerBudgetW' ? 1000000 : 10000} integer={field === 'units'} nullable={!required} help={help} onCommit={value => onChange({ ...rack, [field]: value })} />;
  return <div className="rd-inspector-form" key={rack.id}>
    <RackTextField label="Rack-Kennung" field="label" value={rack.label} maxLength={160} onCommit={label => onChange({ ...rack, label })} />
    <RackTextField label="Raum" field="room" value={rack.room} maxLength={160} onCommit={room => onChange({ ...rack, room })} />
    <RackColorField label="Zeichnungsfarbe" value={panelDrawingFill(rack.metadata?.drawingFill, '#cccccc')} onChange={drawingFill => onChange({ ...rack, metadata: { ...rack.metadata, drawingFill } })} />
    <div className="rd-form-grid">{number('units', 'Rackhöhe', 'HE', true)}{number('widthMm', 'Gehäusebreite', 'mm', true)}{number('heightMm', 'Gehäusehöhe', 'mm', true)}{number('depthMm', 'Gehäusetiefe', 'mm', true)}</div>
    <h3 className="rd-form-section">Montage &amp; Freiräume</h3>
    {number('usableDepthMm', 'Abstand Montageebenen', 'mm', false, 'Abstand der vorderen und hinteren Montageebene. Die Gehäusetiefe allein genügt für eine Tiefenprüfung nicht.')}
    <div className="rd-form-grid">{number('frontDoorClearanceMm', 'Vordere Tür bis Montageebene', 'mm')}{number('rearDoorClearanceMm', 'Hintere Tür bis Montageebene', 'mm')}</div>
    <details className="rd-help"><summary>Gehäuse und 19-Zoll-Montage</summary><p>1 HE = 44,45 mm. 19 Zoll = 482,6 mm Geräte-Montagebreite. Gehäusemasse und nutzbare Montageabstände sind eigene Angaben. Ohne belegte Innenmasse bleibt die Tiefenprüfung offen.</p></details>
    <h3 className="rd-form-section">Planungsgrenzen</h3>
    <div className="rd-form-grid">{number('weightLimitKg', 'Zulässige Racklast', 'kg')}{number('powerBudgetW', 'Geplantes Leistungsbudget', 'W')}</div>
    <details className="rd-help"><summary>Versorgung &amp; Nachweise</summary><p>Das Leistungsbudget ist ein manueller Planungswert in W. Es ersetzt keinen Nachweis zu USV, Absicherung, Selektivität, Wärmeabfuhr oder Potenzialausgleich. USV-Angaben in VA werden nicht automatisch in W umgerechnet.</p></details>
    <RackTextField label="Notizen zum Rack" field="notes" value={rack.notes} multiline onCommit={notes => onChange({ ...rack, notes })} />
  </div>;
}

function PlacementProperties({ rack, placement, profile, profiles, placements, onChange, onEditProfile }: {
  rack: Rack; placement: Placement; profile: DeviceProfile; profiles: DeviceProfile[]; placements: Placement[];
  onChange: (placement: Placement) => void; onEditProfile: (profileId: string) => void;
}) {
  const field = (name: 'startUnit' | 'zeroStartMm' | 'zeroHeightMm' | 'zeroInwardOffsetMm', label: string, unit: string, required = false) => <RackNumberField field={name} label={label} unit={unit} value={placement[name]} min={name === 'startUnit' ? 1 : 0} max={name === 'startUnit' ? 60 : 10000} integer={name === 'startUnit'} nullable={!required} onCommit={value => onChange({ ...placement, [name]: value })} />;
  const zero = placement.side.startsWith('zero-');
  const sides: MountSide[] = profile.units === 0 ? ['zero-left', 'zero-right', 'zero-rear'] : ['front', 'rear'];
  if (!sides.includes(placement.side)) sides.unshift(placement.side);
  const shelves = placements.filter(other => other.rackId === rack.id && other.id !== placement.id && other.status !== 'removed' && profiles.find(candidate => candidate.id === other.profileId)?.kind === 'shelf');
  const supports = shelves.some(shelf => shelf.id === placement.supportedById);
  return <div className="rd-inspector-form" key={placement.id}>
    <RackTextField label="Gerätebezeichnung" field="label" value={placement.label} maxLength={160} onCommit={label => onChange({ ...placement, label })} />
    <div className="rd-profile-reference"><span><strong>{profile.name}</strong><small>{profileSubtitle(profile)}</small></span><button type="button" className="rd-icon-button" title="Geräteprofil bearbeiten" aria-label="Geräteprofil bearbeiten" onClick={() => onEditProfile(profile.id)}><Pencil size={16} /></button></div>
    <div className="rd-form-grid">
      <label className="rd-field" data-rack-field="side">Montageseite<select value={placement.side} onChange={event => onChange({ ...placement, side: event.target.value as MountSide })}>{sides.map(side => <option key={side} value={side}>{sideLabels[side]}</option>)}</select></label>
      {!zero ? field('startUnit', 'Unterste HE', 'HE', true) : <div className="rd-field"><span>Belegung</span><strong className="rd-static-value">0 HE · Zubehör</strong></div>}
    </div>
    {zero && <><h3 className="rd-form-section">Räumliche Position des 0-HE-Zubehörs</h3>{field('zeroStartMm', 'Unterkante über HE-Raster unten', 'mm')}{field('zeroHeightMm', 'Vertikale Bauhöhe', 'mm')}{field('zeroInwardOffsetMm', 'Tiefe ab vorderer Montageebene', 'mm')}<details className="rd-help"><summary>Warum diese Masse?</summary><p>Die Höhenposition beginnt an der Unterkante des HE-Rasters. Die Tiefenposition wird ab der vorderen Montageebene nach hinten gemessen.</p><p>Eine seitliche oder rückseitige Steckdosenleiste belegt keine Front-HE. Ihre tatsächliche Lage kann trotzdem mit Geräten oder Kabeln kollidieren. Unbekannte Lage- oder Tiefenwerte bleiben als offene Prüfung markiert.</p></details></>}
    <label className="rd-field" data-rack-field="status">Planungsstand<select value={placement.status} onChange={event => onChange({ ...placement, status: event.target.value as PlacementStatus })}><option value="planned">Geplant</option><option value="existing">Bestehend</option><option value="removed">Entfallen</option></select></label>
    {placement.status === 'removed' && <p className="rd-muted">Entfallen: bleibt dokumentiert und zählt nicht zur aktuellen Belegung oder Stückliste.</p>}
    <div className="rd-form-grid">
      <label className="rd-field" data-rack-field="delivery">Lieferung<select value={placement.delivery} onChange={event => onChange({ ...placement, delivery: event.target.value as WorkState })}>{Object.entries(workLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="rd-field" data-rack-field="montage">Montage<select value={placement.montage} onChange={event => onChange({ ...placement, montage: event.target.value as WorkState })}>{Object.entries(workLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <label className="rd-field" data-rack-field="supportedById">Auf Fachboden<select value={placement.supportedById ?? ''} onChange={event => onChange({ ...placement, supportedById: event.target.value || null })}><option value="">Keine Zuordnung</option>{placement.supportedById && !supports && <option value={placement.supportedById}>Gespeicherte Zuordnung prüfen</option>}{shelves.map(shelf => <option value={shelf.id} key={shelf.id}>{shelf.label} · {sideLabels[shelf.side]}{shelf.side === 'front' || shelf.side === 'rear' ? ` · HE ${shelf.startUnit}` : ''}</option>)}</select></label>
    <dl className="rd-specs"><div><dt>Tiefe</dt><dd>{valueLabel(profile.depthMm, 'mm')}</dd></div><div><dt>Eigengewicht</dt><dd>{valueLabel(profile.weightKg, 'kg')}</dd></div><div><dt>Aufnahmeleistung</dt><dd>{valueLabel(profile.powerW, 'W')}</dd></div><div><dt>Hersteller</dt><dd>{profile.manufacturer || 'Offen'}</dd></div>{profile.article && <div><dt>Artikel</dt><dd>{profile.article}</dd></div>}</dl>
    {profile.kind === 'earth' && <details className="rd-help" open><summary>Anschluss des Potenzialausgleichs</summary><p>Das Bauteil dokumentiert die Anschlussstelle. Anschlussführung, Querschnitt und Durchgängigkeit müssen separat geplant und nachgewiesen werden.</p></details>}
    <RackTextField label="Notizen / Zuständigkeit" field="notes" value={placement.notes} multiline onCommit={notes => onChange({ ...placement, notes })} />
    <details className="rd-help"><summary>Quelle &amp; Datenstand</summary><p>{profile.source || 'Kein Datenblatt hinterlegt.'}</p><p>{profile.verified ? 'Herstellerdaten wurden manuell als geprüft gekennzeichnet.' : 'Generische oder manuelle Angaben. Herstellerdaten noch nicht belegt.'}</p></details>
  </div>;
}

export default function RackInspector(props: RackInspectorProps) {
  const { rack, placement, profile } = props;
  return <section className="rd-inspector rd-panel" aria-label="Rack-Eigenschaften">
    <div className="rd-panel-heading"><h2>{placement ? 'Gerät' : 'Rack'} · Eigenschaften</h2><Info size={16} aria-hidden="true" /></div>
    {!rack ? <div className="rd-empty"><Server size={28} /><p>Rack oder Bauteil auswählen.</p></div> : <>
      <div className="rd-selection-location"><strong>{rack.label}</strong><span>{placement ? `${sideLabels[placement.side]}${placement.side === 'front' || placement.side === 'rear' ? ` · HE ${placement.startUnit}${profile && profile.units > 1 ? `–${placement.startUnit + profile.units - 1}` : ''}` : ''}` : `${rack.units} HE · ${rack.room || 'Raum offen'}`}</span></div>
      <div className="rd-inspector-scroll">
        {placement && profile ? <PlacementProperties key={placement.id} rack={rack} placement={placement} profile={profile} profiles={props.profiles} placements={props.placements} onChange={props.onPlacementChange} onEditProfile={props.onEditProfile} /> : placement ? <p className="rd-form-error" role="alert">Das zugehörige Geräteprofil fehlt.</p> : <RackProperties key={rack.id} rack={rack} onChange={props.onRackChange} />}
      </div>
      {placement && <footer className="rd-inspector-actions"><button type="button" className="rd-button" onClick={props.onDuplicate}><Copy size={15} />Kopieren</button><button type="button" className="rd-button rd-danger" onClick={props.onRemove}><Trash2 size={15} />Entfernen</button></footer>}
    </>}
  </section>;
}
