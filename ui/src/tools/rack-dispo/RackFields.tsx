import { useId, useRef, useState } from 'react';
import InfoTip from '../../shared/InfoTip';
import { parsePlanningNumber, type NumberRules } from './rackPanelModel';

export function RackNumberField({ label, value, onCommit, unit, help, field, ...rules }: NumberRules & {
  label: string; value: number | null; onCommit: (value: number | null) => void;
  unit?: string; help?: string; field?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const discard = useRef(false);
  function commit() {
    if (discard.current) { discard.current = false; return; }
    if (draft === null) return;
    const result = parsePlanningNumber(draft, rules);
    if (!result.valid) { setError(result.message); return; }
    setError(''); setDraft(null);
    if (result.value !== value) onCommit(result.value);
  }
  return <div className="rd-field" data-rack-field={field}>
    <div className="rd-field-label"><label htmlFor={id}>{label}{unit ? ` (${unit})` : ''}</label>{help && <InfoTip text={help} />}</div>
    <input id={id} inputMode={rules.integer ? 'numeric' : 'decimal'} value={draft ?? (value === null ? '' : String(value))}
      placeholder={rules.nullable === false ? undefined : 'Unbekannt'} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') { event.preventDefault(); discard.current = true; setDraft(null); setError(''); event.currentTarget.blur(); }
      }} />
    {error && <span id={`${id}-error`} role="alert" className="rd-field-error">{error}</span>}
  </div>;
}

export function RackTextField({ label, value, onCommit, multiline = false, field, maxLength = 2000 }: {
  label: string; value: string; onCommit: (value: string) => void; multiline?: boolean; field?: string; maxLength?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const discard = useRef(false);
  const props = {
    id, value: draft ?? value, maxLength,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: () => {
      if (discard.current) { discard.current = false; return; }
      if (draft !== null && draft !== value) onCommit(draft);
      setDraft(null);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Escape') { event.preventDefault(); discard.current = true; setDraft(null); event.currentTarget.blur(); }
      if (event.key === 'Enter' && !multiline) { event.preventDefault(); event.currentTarget.blur(); }
    },
  };
  return <div className="rd-field" data-rack-field={field}><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} rows={3} /> : <input {...props} />}</div>;
}

export function RackColorField({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const id = useId();
  return <div className="rd-field" data-rack-field="drawingFill">
    <div className="rd-field-label"><label htmlFor={id}>{label}</label><InfoTip text="Zeichnungsfarbe der Vorlage, unabhängig vom Oberflächenthema. Gelb oder Orange kann eine Projektmarkierung sein und zeigt keinen Prüfstatus an. Eine Farbänderung bestätigt keine Herstellerdaten." /></div>
    <div className="rd-color-control"><input id={id} type="color" value={value} onChange={event => onChange(event.target.value)} /><output htmlFor={id}>{value.toUpperCase()}</output></div>
  </div>;
}
