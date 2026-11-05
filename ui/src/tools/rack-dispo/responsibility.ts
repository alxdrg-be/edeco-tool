import type { Placement, RackDocument } from './types';

/** Who delivers (L) and who installs (M), as written on the edeco rack sheets. */
export const RESPONSIBLE_DEFAULTS = ['ICT Bauherr', 'Elektroinstallateur', 'Bauherr'];

export interface Responsibility { supplyBy: string; installBy: string; plan: string; owner: boolean }

export function responsibility(placement: Placement): Responsibility {
  const read = (key: string) => { const value = placement.metadata?.[key]; return typeof value === 'string' ? value.trim() : ''; };
  const supplyBy = read('supplyBy'), installBy = read('installBy');
  const plan = supplyBy && supplyBy === installBy ? `L+M ${supplyBy}`
    : [supplyBy && `L durch ${supplyBy}`, installBy && `M durch ${installBy}`].filter(Boolean).join(', ');
  // The template highlights what the client supplies (L), e.g. switches and UPS.
  const owner = /bauherr/i.test(supplyBy);
  return { supplyBy, installBy, plan, owner };
}

/** Names already used in the document first, then the common defaults. */
export function responsibleParties(document: RackDocument): string[] {
  const used = document.placements.flatMap(item => { const duty = responsibility(item); return [duty.supplyBy, duty.installBy]; }).filter(Boolean);
  return [...new Set([...used, ...RESPONSIBLE_DEFAULTS])].slice(0, 30);
}
