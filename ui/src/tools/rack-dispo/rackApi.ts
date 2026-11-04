import { safeFilename } from './documentStore';
import type { RackDocument } from './types';

export async function exportRack(document: RackDocument, rackIds: string[], views: ('front' | 'rear')[], format: 'pdf' | 'svg' | 'dxf', signal?: AbortSignal): Promise<File> {
  const response = await fetch('/api/tools/rack-dispo/export', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, rack_ids: rackIds, views, format }), signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = Array.isArray(data.detail) ? data.detail.slice(0, 3).map((item: { msg?: string }) => item.msg).filter(Boolean).join(' ') : data.detail;
    throw new Error(typeof detail === 'string' && detail ? detail : `Rack-Export fehlgeschlagen (${response.status}).`);
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('Der Export ist leer. Bitte erneut versuchen.');
  return new File([blob], `${safeFilename(document.name)}.${format}`, { type: blob.type });
}
export function downloadRackFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = window.document.createElement('a');
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
