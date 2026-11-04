import { ArrowDownToLine, Cable, Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DeviceProfile, Placement, PortRow, PortState } from './types';
import { RackTextField } from './RackFields';
import './rack-panels.css';

export interface RackPortsProps {
  placement: Placement | null;
  profile: DeviceProfile | null;
  rows: PortRow[];
  onChange: (row: PortRow) => void;
  onExport: () => void;
}
const portStateLabels: Record<PortState, string> = { unknown: 'Unbekannt', 'not-built': 'Nicht ausgebaut', built: 'Ausgebaut', occupied: 'Belegt' };

function RackPortEditor({ placement, profile, rows, onChange, onExport }: RackPortsProps & { placement: Placement; profile: DeviceProfile }) {
  const [selected, setSelected] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PortState | 'all'>('all');
  const all = useMemo(() => {
    const stored = new Map(rows.filter(row => row.placementId === placement.id).map(row => [row.number, row]));
    return Array.from({ length: profile.portCount }, (_, index): PortRow => stored.get(index + 1) ?? {
      placementId: placement.id, number: index + 1, label: '', target: '', outlet: '', room: '', state: 'unknown',
    });
  }, [rows, placement.id, profile.portCount]);
  const filtered = all.filter(row => (status === 'all' || row.state === status) && `${row.number} ${row.label} ${row.target} ${row.outlet} ${row.room}`.toLocaleLowerCase('de-CH').includes(search.trim().toLocaleLowerCase('de-CH')));
  const row = all.find(candidate => candidate.number === selected) ?? all[0];
  const built = all.filter(row => row.state === 'built' || row.state === 'occupied').length;
  const occupied = all.filter(row => row.state === 'occupied').length;
  return <>
    <div className="rd-ports-toolbar"><div className="rd-port-counts"><span><strong>{profile.portCount}</strong> {profile.medium === 'LWL' ? 'LWL-Anschlüsse' : profile.medium === 'RJ45' ? 'RJ45-Ports' : 'Anschlüsse'}</span><span><strong>{built}</strong> ausgebaut</span><span><strong>{occupied}</strong> belegt</span></div><button type="button" className="rd-button" onClick={onExport}><ArrowDownToLine size={15} />CSV exportieren</button></div>
    <div className="rd-port-filters"><label className="rd-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Port, Ziel oder Raum …" aria-label="Portliste durchsuchen" /></label><label className="rd-port-filter">Status<select value={status} onChange={event => setStatus(event.target.value as PortState | 'all')}><option value="all">Alle</option>{Object.entries(portStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <div className="rd-port-workspace">
      <div className="rd-port-table-wrap"><table className="rd-port-table"><caption className="rd-sr-only">{placement.label || profile.name} · Portbelegung</caption><thead><tr><th>Port</th><th>Beschriftung</th><th>Ziel</th><th>Dose</th><th>Raum</th><th>Status</th></tr></thead><tbody>{filtered.map(item => <tr key={item.number} data-rack-port={item.number} className={item.number === row?.number ? 'is-selected' : ''} onClick={() => setSelected(item.number)}><th scope="row"><button type="button" aria-label={`Port ${item.number} bearbeiten`} aria-pressed={item.number === row?.number} onClick={() => setSelected(item.number)} onKeyDown={event => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const index = filtered.findIndex(candidate => candidate.number === item.number) + (event.key === 'ArrowDown' ? 1 : -1);
        const next = filtered[index];
        if (next) { setSelected(next.number); (event.currentTarget.closest('table')?.querySelector(`[data-rack-port="${next.number}"] button`) as HTMLButtonElement | null)?.focus(); }
      }}>{item.number.toString().padStart(2, '0')}</button></th><td>{item.label || '—'}</td><td>{item.target || '—'}</td><td>{item.outlet || '—'}</td><td>{item.room || '—'}</td><td><span className={`rd-port-state is-${item.state}`}>{item.state === 'occupied' && <Check size={11} aria-hidden="true" />}{portStateLabels[item.state]}</span></td></tr>)}</tbody></table>{!filtered.length && <p className="rd-empty">Keine passenden Anschlüsse.</p>}</div>
      {row && <section className="rd-port-detail" aria-label={`Port ${row.number} bearbeiten`}>
        <header><h3>Port {row.number.toString().padStart(2, '0')}</h3><div className="rd-inline-buttons"><button type="button" className="rd-icon-button" aria-label="Vorheriger Port" disabled={row.number <= 1} onClick={() => setSelected(row.number - 1)}><ChevronLeft size={18} /></button><button type="button" className="rd-icon-button" aria-label="Nächster Port" disabled={row.number >= profile.portCount} onClick={() => setSelected(row.number + 1)}><ChevronRight size={18} /></button></div></header>
        <div key={row.number} className="rd-inspector-form">
          <RackTextField label={`Port ${row.number} Beschriftung`} field="port-label" value={row.label} maxLength={160} onCommit={label => onChange({ ...row, label })} />
          <RackTextField label={`Port ${row.number} Ziel`} field="port-target" value={row.target} maxLength={160} onCommit={target => onChange({ ...row, target })} />
          <div className="rd-form-grid"><RackTextField label={`Port ${row.number} Dose`} field="port-outlet" value={row.outlet} maxLength={160} onCommit={outlet => onChange({ ...row, outlet })} /><RackTextField label={`Port ${row.number} Raum`} field="port-room" value={row.room} maxLength={160} onCommit={room => onChange({ ...row, room })} /></div>
          <label className="rd-field">Port {row.number} Status<select aria-label={`Port ${row.number} Status`} value={row.state} onChange={event => onChange({ ...row, state: event.target.value as PortState })}>{Object.entries(portStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <p className="rd-muted">Ausgebaut bezeichnet die vorhandene Installation. Belegt bezeichnet einen tatsächlich verwendeten Anschluss.</p>
      </section>}
    </div>
    <details className="rd-help"><summary>Zählweise &amp; Anschlussart</summary><p>Belegte Anschlüsse zählen auch als ausgebaut. Unbekannte Zustände sind keine freien Anschlüsse. Patchpanel-Kapazität und Switchports sind getrennte Geräteangaben.</p>{profile.medium === 'LWL' && <p>Bei LWL muss die Profildefinition festlegen, ob Adapter, Steckplätze oder Fasern gemeint sind. Angaben wie 12/24 werden nicht als RJ45-Ports umgedeutet.</p>}</details>
  </>;
}

export default function RackPorts(props: RackPortsProps) {
  const { placement, profile } = props;
  return <section className="rd-ports rd-panel" aria-label="Portliste"><div className="rd-panel-heading"><h2><Cable size={17} />Portliste</h2>{placement && <span>{placement.label || profile?.name}</span>}</div>
    {!placement || !profile ? <div className="rd-empty"><Cable size={27} /><p>Patchpanel, Switch oder LWL-Bauteil auswählen.</p></div> : !profile.portCount ? <p className="rd-empty">Dieses Bauteil hat keine Anschlüsse. Die Anschlusszahl lässt sich im Geräteprofil ändern.</p> : <RackPortEditor key={placement.id} {...props} placement={placement} profile={profile} />}
  </section>;
}
