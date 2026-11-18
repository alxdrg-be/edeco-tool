import { responseError } from '../../shared/http.ts';
import type { Analysis, CabinetView, Catalog, DistributionDocument, DocumentSummary, SavedDocument } from './types.ts';

const PREFIX = '/api/tools/verteiler-dispo';
export class VerteilerApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function request<T>(path: string, body?: unknown, method = 'POST', signal?: AbortSignal): Promise<T> {
  const response = await fetch(PREFIX + path, body === undefined ? { signal } : {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  if (!response.ok) throw new VerteilerApiError(await responseError(response, `Verteiler-Anfrage fehlgeschlagen (${response.status}).`), response.status);
  return await response.json() as T;
}
export const getCatalog = (signal?: AbortSignal) => request<Catalog>('/catalog', undefined, 'GET', signal);
export const getDefault = (template: string, vnb: string) => request<DistributionDocument>(`/default?template_id=${encodeURIComponent(template)}&vnb_id=${encodeURIComponent(vnb)}`);
export const listDocuments = () => request<DocumentSummary[]>('/documents');
export const loadDocument = (id: string) => request<SavedDocument>(`/documents/${encodeURIComponent(id)}`);
export const saveDocument = (document: DistributionDocument, baseRevision: number) => request<SavedDocument>(`/documents/${encodeURIComponent(document.id)}`, { document, base_revision: baseRevision }, 'PUT');
export const analyzeDocument = (document: DistributionDocument, signal?: AbortSignal) => request<Analysis>('/analysis', { document }, 'POST', signal);
export const previewDocument = (document: DistributionDocument, view: CabinetView, signal?: AbortSignal) => request<{ svg: string }>('/preview', { document, view }, 'POST', signal);
export type ExportFormat = 'pdf' | 'svg' | 'dxf' | 'bom-csv' | 'terminals-csv' | 'json';
export async function exportDocument(document: DistributionDocument, format: ExportFormat, views: CabinetView[], paper: 'A4' | 'A3'): Promise<File> {
  const response = await fetch(PREFIX + '/export', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document, format, views, paper, scale: null }),
  });
  if (!response.ok) throw new VerteilerApiError(await responseError(response, 'Der Verteiler-Export ist fehlgeschlagen.'), response.status);
  const blob = await response.blob();
  if (!blob.size) throw new Error('Der Export ist leer. Bitte erneut versuchen.');
  const header = response.headers.get('Content-Disposition') ?? '';
  const fallback = `${document.name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-') || 'Verteiler'}.${format.endsWith('csv') ? 'csv' : format}`;
  const filename = /filename="([^"/\\]+)"/i.exec(header)?.[1] ?? fallback;
  return new File([blob], filename, { type: blob.type });
}
