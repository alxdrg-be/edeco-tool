import { safeFilename } from './documentStore';
import type { RackDocument } from './types';
import { responseError } from '../../shared/http.ts';

export interface RackSheetPayload { rackId: string; view: 'front' | 'rear'; svg: string }
export async function exportRack(document: RackDocument, rackIds: string[], views: ('front' | 'rear')[], format: 'pdf' | 'svg' | 'dxf', signal?: AbortSignal, sheets?: RackSheetPayload[]): Promise<File> {
  const response = await fetch('/api/tools/rack-dispo/export', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, rack_ids: rackIds, views, format, ...(sheets ? { sheets } : {}) }), signal });
  if (!response.ok) throw new Error(await responseError(response, `Rack-Export fehlgeschlagen (${response.status}).`));
  const blob = await response.blob();
  if (!blob.size) throw new Error('Der Export ist leer. Bitte erneut versuchen.');
  return new File([blob], `${safeFilename(document.name)}.${format}`, { type: blob.type });
}
export { downloadBlob as downloadRackFile } from '../../shared/download';
