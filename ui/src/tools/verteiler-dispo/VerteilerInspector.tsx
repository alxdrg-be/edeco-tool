import { useEffect, useRef, useState } from 'react';
import { Copy, Info, Plus, Trash2 } from 'lucide-react';
import { parseNumber } from './documentStore.ts';
import type { Cabinet, Cover, DeviceProfile, DistributionDocument, Placement, Ratings, SourceRef } from './types.ts';

export function NumericField({ label, value, change, nullable = false, field, positive = false }: {
  label: string; value: number | null; change: (value: number | null) => void; nullable?: boolean; field: string; positive?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : String(value)), [error, setError] = useState('');
  useEffect(() => { setText(value === null ? '' : String(value)); setError(''); }, [value]);
  function apply() {
    const next = parseNumber(text, nullable);
    if (next === undefined || (positive && next !== null && next <= 0)) { setError(positive ? 'Eine Zahl grösser als null eintragen.' : 'Eine vollständige Zahl eintragen.'); return; }
    setError(''); if (next !== value) change(next);
  }
  return <label className="vd-field"><span>{label}{nullable && <small> unbekannt = leer</small>}</span><input data-field={field} inputMode="decimal" aria-invalid={Boolean(error)} value={text} onChange={event => setText(event.target.value)} onBlur={apply} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply(); event.currentTarget.blur(); } }} />{error && <small className="vd-error">{error}</small>}</label>;
}
function TextField({ label, value, change, field, limit = 200 }: { label: string; value: string; change: (value: string) => void; field: string; limit?: number }) {
  return <label className="vd-field"><span>{label}</span><input data-field={field} maxLength={limit} value={value} onChange={event => change(event.target.value)} /></label>;
}
export function SourceDetails({ sources, ids }: { sources: SourceRef[]; ids: string[] }) {
  const entries = sources.filter(source => ids.includes(source.id));
  return <details className="vd-details"><summary><Info size={14} /> Quellen und Grenzen</summary>
    {entries.length ? entries.map(source => <div className="vd-source" key={source.id}><strong>{source.issuer} · {source.title}</strong><span>{source.edition} · geprüft {source.checked_on}{source.pages ? ` · ${source.pages}` : ''}</span>
      {source.url && <a href={source.url} target="_blank" rel="noreferrer">Originalquelle ↗</a>}<p>{source.notes}</p>{source.sha256 && <small>SHA-256: {source.sha256}</small>}</div>) : <p>Für diese Angabe ist noch keine Quelle hinterlegt. Eigene Abmessungen sind keine Herstellerfreigabe.</p>}
  </details>;
}
interface Props {
  document: DistributionDocument; selectedId: string | null; focusField: string; focusTarget: string | null;
  commit: (document: DistributionDocument) => void; updatePlacement: (patch: Partial<Placement>) => void;
  updateProfile: (patch: Partial<DeviceProfile>) => void; onCopy: () => void; onDelete: () => void;
}

export default function VerteilerInspector({ document, selectedId, focusField, focusTarget, commit, updatePlacement, updateProfile, onCopy, onDelete }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const placement = document.cabinet.placements.find(item => item.id === selectedId), profile = document.profiles.find(item => item.id === placement?.profile_id);
  const cabinet = document.cabinet;
  function updateCabinet(patch: Partial<Cabinet>) { commit({ ...document, cabinet: { ...cabinet, ...patch } }); }
  function rating(patch: Partial<Ratings>) { commit({ ...document, ratings: { ...document.ratings, ...patch } }); }
  function editCover(id: string, patch: Partial<Cover>) { updateCabinet({ covers: cabinet.covers.map(c => c.id === id ? { ...c, ...patch } : c) }); }
  useEffect(() => {
    if (!focusField || !holder.current) return;
    const allFields = [...holder.current.querySelectorAll<HTMLElement>('[data-field]')], lookup = focusField.split('#')[0];
    const ownFields = allFields.filter(item => item.closest('[data-entity-id]')?.getAttribute('data-entity-id') === focusTarget);
    const fields = ownFields.length ? ownFields : allFields;
    const cutout = /^(?:cover\.)?cutouts(?:\.(\d+))?(?:\.|$)/u.exec(lookup);
    const cutoutTarget = cutout ? fields.find(item => item.dataset.field === `cover.cutouts.${cutout[1] ?? '0'}.x_mm`) : undefined;
    const target = fields.find(item => item.dataset.field === lookup) ?? cutoutTarget ?? fields.find(item => item.dataset.field?.split('.').at(-1) === lookup.split('.').at(-1));
    if (!target) return;
    let parent = target.parentElement;
    while (parent && parent !== holder.current) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    target.focus(); target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusField, selectedId, focusTarget]);

  return <div className="vd-inspector-content" ref={holder}>
    {placement && profile ? <>
      <div className="vd-selected-heading"><div><small>Ausgewähltes Bauteil</small><h3>{placement.label || profile.name}</h3></div><button className="btn" type="button" onClick={onCopy} aria-label="Bauteil kopieren"><Copy size={16} /></button></div>
      <TextField label="Bezeichnung / BMK" field="placement.label" value={placement.label} change={label => updatePlacement({ label })} />
      <div className="vd-two"><NumericField label="X (mm)" field="placement.x_mm" value={placement.x_mm} change={value => value !== null && updatePlacement({ x_mm: value })} />
        <NumericField label="Y (mm)" field="placement.y_mm" value={placement.y_mm} change={value => value !== null && updatePlacement({ y_mm: value })} /></div>
      <NumericField label="Tiefe Z (mm)" field="placement.z_mm" value={placement.z_mm} change={value => value !== null && updatePlacement({ z_mm: value })} />
      <label className="vd-field"><span>Schiene</span><select data-field="placement.rail_id" value={placement.rail_id ?? ''} onChange={event => {
        const rail = cabinet.rails.find(item => item.id === event.target.value);
        updatePlacement({ rail_id: rail?.id ?? null, field_id: rail?.field_id ?? cabinet.fields[0]?.id ?? null,
          ...(rail ? { x_mm: rail.x_mm, y_mm: rail.y_mm - (placement.rotation % 180 ? profile.width_mm : profile.height_mm) / 2, z_mm: rail.z_mm } : {}) });
      }}><option value="">Freie Montage</option>{cabinet.rails.map(rail => <option key={rail.id} value={rail.id}>{rail.name}</option>)}</select></label>
      <div className="vd-two"><label className="vd-field"><span>Drehung</span><select data-field="placement.rotation" value={placement.rotation} onChange={event => updatePlacement({ rotation: Number(event.target.value) as Placement['rotation'] })}>{[0, 90, 180, 270].map(n => <option key={n} value={n}>{n}°</option>)}</select></label>
        <label className="vd-field"><span>Zustand</span><select value={placement.status} onChange={event => updatePlacement({ status: event.target.value as Placement['status'] })}><option value="planned">Geplant</option><option value="existing">Bestehend</option><option value="removed">Entfallen</option></select></label></div>
      <details className="vd-details"><summary>Apparat / eigene Variante</summary>
        <p className="vd-muted">Geänderte Abmessungen werden als eigene Variante geführt. Andere Apparate bleiben unverändert.</p>
        <TextField label="Profilname" field="profile.name" value={profile.name} change={name => updateProfile({ name })} />
        <TextField label="Hersteller" field="profile.manufacturer" value={profile.manufacturer} change={manufacturer => updateProfile({ manufacturer })} />
        <TextField label="Artikel" field="profile.article" value={profile.article} change={article => updateProfile({ article })} />
        <div className="vd-two"><NumericField label="Breite (mm)" field="profile.width_mm" value={profile.width_mm} positive change={v => v !== null && updateProfile({ width_mm: v })} />
          <NumericField label="Höhe (mm)" field="profile.height_mm" value={profile.height_mm} positive change={v => v !== null && updateProfile({ height_mm: v })} /></div>
        <NumericField label="Gerätetiefe (mm)" field="profile.depth_mm" value={profile.depth_mm} nullable change={depth_mm => updateProfile({ depth_mm })} />
        <NumericField label="Teilungseinheiten" field="profile.te" value={profile.te} nullable change={te => updateProfile({ te })} />
        <NumericField label="Kabel-/Einbauraum (mm)" field="profile.clearance_mm" value={profile.clearance_mm} change={v => v !== null && updateProfile({ clearance_mm: v })} />
        <label className="vd-field"><span>Montageart</span><select value={profile.mounting} onChange={event => updateProfile({ mounting: event.target.value as DeviceProfile['mounting'] })}><option value="din">Hutschiene</option><option value="plate">Montageplatte</option><option value="free">Freier Block</option></select></label>
        <NumericField label="Verlustleistung (W)" field="profile.power_loss_w" value={profile.power_loss_w} nullable change={power_loss_w => updateProfile({ power_loss_w })} />
        <NumericField label="Bemessungsstrom (A)" field="profile.rated_current_a" value={profile.rated_current_a} nullable change={rated_current_a => updateProfile({ rated_current_a })} />
        {profile.kind === 'terminal' && <TextField label="Klemmentyp / Anschluss" field="profile.terminal_kind" value={profile.terminal_kind} change={terminal_kind => updateProfile({ terminal_kind })} />}
        {profile.kind === 'busbar' && <div className="vd-two"><NumericField label="Cu-Breite (mm)" field="profile.busbar_section_width_mm" value={profile.busbar_section_width_mm} nullable change={busbar_section_width_mm => updateProfile({ busbar_section_width_mm })} /><NumericField label="Cu-Dicke (mm)" field="profile.busbar_section_thickness_mm" value={profile.busbar_section_thickness_mm} nullable change={busbar_section_thickness_mm => updateProfile({ busbar_section_thickness_mm })} /></div>}
      </details>
      <SourceDetails sources={document.sources} ids={profile.source_ids} />
      <details className="vd-details"><summary>Stromkreis und Notizen</summary><TextField label="Stromkreisreferenz" field="placement.source_circuit_id" value={placement.source_circuit_id ?? ''} change={source_circuit_id => updatePlacement({ source_circuit_id: source_circuit_id || null })} /><label className="vd-field"><span>Notizen</span><textarea maxLength={2000} value={placement.notes} onChange={event => updatePlacement({ notes: event.target.value })} /></label></details>
      <button className="btn vd-delete" type="button" onClick={onDelete}><Trash2 size={16} /> Als entfallen markieren</button>
    </> : <>
      <h3>Plan und Gehäuse</h3>
      <TextField label="Planname" field="name" value={document.name} change={name => commit({ ...document, name })} />
      <div className="vd-two"><TextField label="Projektnummer" field="project_number" value={document.project_number} change={project_number => commit({ ...document, project_number })} /><TextField label="Standort" field="location" value={document.location} change={location => commit({ ...document, location })} /></div>
      <details className="vd-details"><summary>Plankopf und Projekt</summary>
        {(['project_name', 'drawing_number', 'schematic_ref', 'author', 'index', 'date'] as const).map((key, i) => <TextField key={key} label={['Projektname', 'Zeichnungsnummer', 'Schemareferenz', 'Bearbeiter', 'Index', 'Datum'][i]} field={key} value={document[key]} change={value => commit({ ...document, [key]: value })} />)}
      </details>
      <details className="vd-details" open><summary>Gehäuse / Innenraum</summary>
        <label className="vd-field"><span>Verteilerart</span><select value={cabinet.kind} onChange={event => updateCabinet({ kind: event.target.value as Cabinet['kind'] })}><option value="UV">Unterverteilung</option><option value="HV">Hauptverteilung</option></select></label>
        {(['manufacturer', 'system', 'article'] as const).map((key, i) => <TextField key={key} label={['Hersteller', 'System', 'Artikel'][i]} field={`cabinet.${key}`} value={cabinet[key]} change={value => updateCabinet({ [key]: value })} />)}
        <div className="vd-two">{(['width_mm', 'height_mm', 'depth_mm', 'inner_width_mm', 'inner_height_mm'] as const).map((key, i) => <NumericField key={key} field={`cabinet.${key}`} label={['Breite aussen (mm)', 'Höhe aussen (mm)', 'Tiefe aussen (mm)', 'Nutzbreite (mm)', 'Nutzhöhe (mm)'][i]} value={cabinet[key]} positive change={v => v !== null && updateCabinet({ [key]: v })} />)}</div>
        <NumericField field="cabinet.usable_depth_mm" label="Nutzbare Einbautiefe (mm)" value={cabinet.usable_depth_mm} nullable change={usable_depth_mm => updateCabinet({ usable_depth_mm })} />
        <div className="vd-two">{(['color_outer', 'color_inner'] as const).map((key, i) => <label key={key} className="vd-field"><span>{i ? 'Innenfarbe' : 'Aussenfarbe'}</span><input type="color" value={cabinet[key]} onChange={event => updateCabinet({ [key]: event.target.value })} /></label>)}</div>
        <div className="vd-two"><TextField label="RAL aussen" field="cabinet.ral_outer" value={cabinet.ral_outer ?? ''} change={ral_outer => updateCabinet({ ral_outer })} /><TextField label="RAL innen" field="cabinet.ral_inner" value={cabinet.ral_inner ?? ''} change={ral_inner => updateCabinet({ ral_inner })} /></div>
      </details>
      <details className="vd-details"><summary>Felder und Hutschienen</summary>
        {cabinet.fields.map(field => <fieldset className="vd-subgroup" data-entity-id={field.id} key={field.id}><legend>{field.name}</legend>
          <TextField label="Feldname" field="field.name" value={field.name} change={name => updateCabinet({ fields: cabinet.fields.map(f => f.id === field.id ? { ...f, name } : f) })} />
          <div className="vd-two">{(['x_mm', 'y_mm', 'width_mm', 'height_mm'] as const).map(key => <NumericField key={key} label={`${key.replace('_mm', '').toUpperCase()} (mm)`} field={`field.${key}`} value={field[key]} positive={key.includes('width') || key.includes('height')} change={v => v !== null && updateCabinet({ fields: cabinet.fields.map(f => f.id === field.id ? { ...f, [key]: v } : f) })} />)}</div>
          <label className="vd-field"><span>Feldfunktion</span><select value={field.role} onChange={event => updateCabinet({ fields: cabinet.fields.map(f => f.id === field.id ? { ...f, role: event.target.value as typeof field.role } : f) })}>{[['equipment', 'Geräte'], ['meter', 'Messung'], ['connection', 'Anschluss'], ['control', 'Steuerung'], ['spare', 'Reserve']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="vd-check"><input type="checkbox" checked={field.sealed} onChange={event => updateCabinet({ fields: cabinet.fields.map(f => f.id === field.id ? { ...f, sealed: event.target.checked } : f) })} /> Plombierbereich nach Profil</label>
        </fieldset>)}
        <button type="button" className="btn" onClick={() => updateCabinet({ fields: [...cabinet.fields, { id: crypto.randomUUID(), name: `Feld ${cabinet.fields.length + 1}`, x_mm: 0, y_mm: 0, width_mm: cabinet.inner_width_mm, height_mm: cabinet.inner_height_mm, role: 'equipment', sealed: false }] })}><Plus size={15} /> Feld</button>
        {cabinet.rails.map(rail => <fieldset className="vd-subgroup" data-entity-id={rail.id} key={rail.id}><legend>{rail.name}</legend><TextField label="Schienenname" field="rail.name" value={rail.name} change={name => updateCabinet({ rails: cabinet.rails.map(r => r.id === rail.id ? { ...r, name } : r) })} />
          <label className="vd-field"><span>Feld</span><select value={rail.field_id} onChange={event => updateCabinet({ rails: cabinet.rails.map(r => r.id === rail.id ? { ...r, field_id: event.target.value } : r) })}>{cabinet.fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <div className="vd-two">{(['x_mm', 'y_mm', 'z_mm', 'length_mm', 'te_pitch_mm'] as const).map(key => <NumericField key={key} label={`${({ x_mm: 'X', y_mm: 'Mittelachse Y', z_mm: 'Z', length_mm: 'Länge', te_pitch_mm: 'TE-Teilung' })[key]} (mm)`} field={`rail.${key}`} value={rail[key]} positive={key === 'length_mm' || key === 'te_pitch_mm'} change={v => v !== null && updateCabinet({ rails: cabinet.rails.map(r => r.id === rail.id ? { ...r, [key]: v } : r) })} />)}</div>
          <button type="button" className="btn" disabled={cabinet.placements.some(p => p.rail_id === rail.id)} onClick={() => updateCabinet({ rails: cabinet.rails.filter(r => r.id !== rail.id) })}>Unbenutzte Schiene entfernen</button>
        </fieldset>)}
        <button type="button" className="btn" disabled={!cabinet.fields.length} onClick={() => { const f = cabinet.fields[0]; if (!f) return; updateCabinet({ rails: [...cabinet.rails, { id: crypto.randomUUID(), name: `Reihe ${cabinet.rails.length + 1}`, field_id: f.id, x_mm: f.x_mm + 10, y_mm: (cabinet.rails.at(-1)?.y_mm ?? f.y_mm) + 120, z_mm: 0, length_mm: Math.max(1, f.width_mm - 20), te_pitch_mm: 18 }] }); }}><Plus size={15} /> Hutschiene</button>
      </details>
      <details className="vd-details"><summary>Abdeckungen und Ausschnitte</summary>
        <p className="vd-muted">Material, Befestigung und Schutzwirkung müssen aus dem gewählten System belegt sein.</p>
        {cabinet.covers.map(cover => <fieldset className="vd-subgroup" data-entity-id={cover.id} key={cover.id}><legend>{cover.name}</legend>
          <TextField label="Name" field="cover.name" value={cover.name} change={name => editCover(cover.id, { name })} />
          <div className="vd-two">{(['x_mm', 'y_mm', 'width_mm', 'height_mm', 'z_mm'] as const).map(key => <NumericField key={key} label={`${key.replace('_mm', '').toUpperCase()} (mm)`} field={`cover.${key}`} value={cover[key]} positive={key.includes('width') || key.includes('height')} change={v => v !== null && editCover(cover.id, { [key]: v })} />)}</div>
          <TextField label="Material / System" field="cover.material" value={cover.material} change={material => editCover(cover.id, { material })} />
          <NumericField label="Dicke (mm)" field="cover.thickness_mm" value={cover.thickness_mm} nullable change={thickness_mm => editCover(cover.id, { thickness_mm })} />
          <label className="vd-check"><input type="checkbox" checked={cover.transparent} onChange={event => editCover(cover.id, { transparent: event.target.checked })} /> Transparent darstellen</label>
          <label className="vd-field"><span>Farbe</span><input type="color" value={cover.color} onChange={event => editCover(cover.id, { color: event.target.value })} /></label>
          {cover.cutouts.map((cutout, index) => <div className="vd-cutout" key={index}><strong>Ausschnitt {index + 1}</strong><div className="vd-two">{(['x_mm', 'y_mm', 'width_mm', 'height_mm'] as const).map(key => <NumericField key={key} label={`${key.replace('_mm', '').toUpperCase()} (mm)`} field={`cover.cutouts.${index}.${key}`} value={cutout[key]} positive={key.includes('width') || key.includes('height')} change={v => v !== null && editCover(cover.id, { cutouts: cover.cutouts.map((c, i) => i === index ? { ...c, [key]: v } : c) })} />)}</div><button type="button" className="btn" onClick={() => editCover(cover.id, { cutouts: cover.cutouts.filter((_, i) => i !== index) })}>Ausschnitt entfernen</button></div>)}
          <button type="button" className="btn" onClick={() => editCover(cover.id, { cutouts: [...cover.cutouts, { x_mm: cover.x_mm + 10, y_mm: cover.y_mm + 10, width_mm: Math.min(180, cover.width_mm), height_mm: Math.min(45, cover.height_mm) }] })}><Plus size={14} /> Ausschnitt</button>
          <button type="button" className="btn vd-delete" onClick={() => updateCabinet({ covers: cabinet.covers.filter(c => c.id !== cover.id) })}>Abdeckung entfernen</button>
        </fieldset>)}
        <button type="button" className="btn" onClick={() => updateCabinet({ covers: [...cabinet.covers, { id: crypto.randomUUID(), name: `Abdeckung ${cabinet.covers.length + 1}`, x_mm: 0, y_mm: 0, width_mm: cabinet.inner_width_mm, height_mm: cabinet.inner_height_mm, z_mm: 0, material: 'Eigene Vorgabe', thickness_mm: null, transparent: false, color: '#d7d9d8', source_id: null, cutouts: [] }] })}><Plus size={15} /> Abdeckung</button>
      </details>
      <details className="vd-details"><summary>Reserve- und Sperrbereiche</summary>
        <p className="vd-muted">Freizuhaltende Flächen nach konkreter Projekt-/Herstellervorgabe. Eine eigene Fläche ist keine VNB-Freigabe.</p>
        {cabinet.reserved_zones.map(zone => <fieldset className="vd-subgroup" data-entity-id={zone.id} key={zone.id}><legend>{zone.name}</legend><TextField label="Bezeichnung" field="reserved_zone.name" value={zone.name} change={name => updateCabinet({ reserved_zones: cabinet.reserved_zones.map(z => z.id === zone.id ? { ...z, name } : z) })} />
          <div className="vd-two">{(['x_mm', 'y_mm', 'width_mm', 'height_mm'] as const).map(key => <NumericField key={key} label={`${key.replace('_mm', '').toUpperCase()} (mm)`} field={`reserved_zone.${key}`} value={zone[key]} positive={key.includes('width') || key.includes('height')} change={v => v !== null && updateCabinet({ reserved_zones: cabinet.reserved_zones.map(z => z.id === zone.id ? { ...z, [key]: v } : z) })} />)}</div>
          <label className="vd-field"><span>Quelle</span><select value={zone.source_id ?? ''} onChange={event => updateCabinet({ reserved_zones: cabinet.reserved_zones.map(z => z.id === zone.id ? { ...z, source_id: event.target.value || null } : z) })}><option value="">Eigene Vorgabe / offen</option>{document.sources.map(s => <option key={s.id} value={s.id}>{s.issuer} · {s.title}</option>)}</select></label>
          <button type="button" className="btn" onClick={() => updateCabinet({ reserved_zones: cabinet.reserved_zones.filter(z => z.id !== zone.id) })}>Bereich entfernen</button>
        </fieldset>)}
        <button type="button" className="btn" onClick={() => updateCabinet({ reserved_zones: [...cabinet.reserved_zones, { id: crypto.randomUUID(), name: `Reserve ${cabinet.reserved_zones.length + 1}`, x_mm: 10, y_mm: 10, width_mm: Math.min(100, cabinet.inner_width_mm), height_mm: Math.min(80, cabinet.inner_height_mm), source_id: null }] })}><Plus size={15} /> Bereich hinzufügen</button>
      </details>
      <details className="vd-details"><summary>Technische Angaben / Nachweise</summary>
        <p className="vd-muted">Diese Angaben sind Deklarationen. Die Prüfung benennt fehlende Bedingungen und Quellen.</p>
        <div className="vd-two">{(['rated_voltage_v', 'rated_current_a', 'icw_ka', 'icw_duration_s', 'ipk_ka', 'icc_ka'] as const).map((key, i) => <NumericField key={key} label={['Bemessungsspannung (V)', 'Bemessungsstrom (A)', 'Icw (kA)', 'Icw-Dauer (s)', 'Ipk (kA)', 'Bedingter Icc (kA)'][i]} field={`ratings.${key}`} value={document.ratings[key]} nullable change={value => rating({ [key]: value })} />)}</div>
        {(['ip_closed', 'ip_open_covered', 'access_protection', 'protective_device_ref'] as const).map((key, i) => <TextField key={key} label={['IP: Tür geschlossen', 'IP: offen mit Abdeckung', 'Zugangsschutz (IPXXB/C)', 'Schutzgerät für Icc'][i]} field={`ratings.${key}`} value={document.ratings[key]} change={value => rating({ [key]: value })} />)}
        <label className="vd-field"><span>Nachweisquellen auswählen</span><select multiple aria-label="Nachweisquellen" value={document.ratings.source_ids} onChange={event => rating({ source_ids: [...event.target.selectedOptions].map(option => option.value) })}>{document.sources.map(source => <option key={source.id} value={source.id}>{source.issuer} · {source.title}</option>)}</select></label>
        <label className="vd-field"><span>Nachweisnotizen / Bedingungen</span><textarea data-field="ratings.notes" maxLength={2000} value={document.ratings.notes} onChange={event => rating({ notes: event.target.value })} /></label>
        <SourceDetails sources={document.sources} ids={document.ratings.source_ids} />
      </details>
      <details className="vd-details"><summary>Vorlagen- und Quellenstand</summary><p className="vd-muted">{document.system_profile_id} · {document.vnb_id.toUpperCase()} · {document.vnb_profile_version || 'Kein VNB-Stand gewählt'}</p><SourceDetails sources={document.sources} ids={document.sources.map(s => s.id)} /></details>
    </>}
  </div>;
}
