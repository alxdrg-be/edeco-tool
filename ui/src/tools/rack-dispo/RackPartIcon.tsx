import type { ReactNode } from 'react';
import type { DeviceProfile } from './types';

/** Small front view of a rack part for the library: shape, height and ports follow the profile. */
export default function RackPartIcon({ profile, size = 26 }: { profile: Pick<DeviceProfile, 'kind' | 'units' | 'portCount' | 'medium'>; size?: number }) {
  const units = Math.max(1, Math.min(3, profile.units || 1));
  const height = units === 1 ? 7 : units === 2 ? 11 : 15, top = 12 - height / 2, bottom = top + height;
  const face = (children: ReactNode, dashed = false) => <>
    <rect x="1.5" y={top} width="21" height={height} rx="1" strokeDasharray={dashed ? '2 1.5' : undefined} />
    {!dashed && <><circle cx="3.4" cy={top + 1.6} r=".45" fill="currentColor" stroke="none" /><circle cx="20.6" cy={top + 1.6} r=".45" fill="currentColor" stroke="none" /></>}
    {children}
  </>;
  const rows = profile.portCount > 24 || units > 1 ? 2 : 1;
  const portRow = (y: number, count: number, x0: number, x1: number, lwl: boolean) => Array.from({ length: count }, (_, index) => {
    const step = (x1 - x0) / count, x = x0 + index * step + step * .12, w = step * .76;
    return lwl
      ? <g key={`${y}-${index}`}><rect x={x} y={y} width={w * .42} height="2" rx=".3" /><rect x={x + w * .58} y={y} width={w * .42} height="2" rx=".3" /></g>
      : <path key={`${y}-${index}`} d={`M${x} ${y}h${w}v1.7h${-w * .25}v.6h${-w * .5}v-.6H${x}Z`} />;
  });
  const ports = (x0: number, lwl = false) => {
    const count = lwl ? 4 : 6, y = rows === 2 ? [top + height / 2 - 2.7, top + height / 2 + .5] : [top + height / 2 - 1];
    return y.map(value => portRow(value, count, x0, 20.5, lwl));
  };
  let body: ReactNode;
  switch (profile.kind) {
    case 'patch': body = face(ports(3.5)); break;
    case 'fiber': body = face(ports(3.5, true)); break;
    case 'switch': body = face(<>{ports(7.5)}<circle cx="4.3" cy={12 - 1} r=".7" fill="currentColor" stroke="none" /><circle cx="4.3" cy={12 + 1.2} r=".7" /></>); break;
    case 'manager': body = face(<path d={[5.5, 10, 14.5, 19].map(x => `M${x - 1.6} ${top + 1.6}v${height - 3.2}h3.2v${-(height - 3.2)}`).join('')} />); break;
    case 'shelf': body = <><path d="M2 14h20l-2-2.6H4Z" /><path d="M2 14v2M22 14v2" /></>; break;
    case 'blank': body = face(<path d={`M6 ${12}h12`} opacity=".45" />); break;
    case 'ups': body = face(<><rect x="4" y={top + height * .3} width="6" height={height * .4} rx=".6" /><path d={`M10 ${12}h1M6.2 ${12}h1.6M7 ${11.2}v1.6`} /><path d={[14, 16, 18, 20].map(x => `M${x} ${top + 2}v${height - 4}`).join('')} opacity=".6" /></>); break;
    case 'pdu': body = <><rect x="9" y="2" width="6" height="20" rx="1" />{[5.5, 10.5, 15.5].map(y => <g key={y}><rect x="10.3" y={y} width="3.4" height="3" rx=".5" /><circle cx="11.4" cy={y + 1.1} r=".35" fill="currentColor" stroke="none" /><circle cx="12.6" cy={y + 1.1} r=".35" fill="currentColor" stroke="none" /></g>)}</>; break;
    case 'earth': body = <><path d="M12 3v10M6 13h12M8 16h8M10 19h4" /><circle cx="12" cy="5" r="1.4" /></>; break;
    case 'reserve': body = face(<path d={`M4 ${top + 1}L20 ${bottom - 1}M20 ${top + 1}L4 ${bottom - 1}`} strokeDasharray="1.6 1.2" />, true); break;
    default: body = face(<path d={`M9 ${12 - 1.6}h6M12 ${12 - 1.6}v3.6`} />);
  }
  return <svg className="rd-part-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-part-kind={profile.kind}>{body}</svg>;
}
