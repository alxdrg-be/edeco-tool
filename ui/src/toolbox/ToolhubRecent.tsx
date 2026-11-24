import { useEffect, useState } from 'react';
import { ArrowUpRight, Clock } from 'lucide-react';
import { TOOLS } from './catalog';
import { toolAllowed, type PresentationPolicy } from './presentationPolicy';
import ToolIcon from './ToolIcon';
import { readRecentTools, RECENT_EVENT } from './recentTools';

export default function ToolhubRecent({ policy, onOpenTool }: { policy: PresentationPolicy; onOpenTool: (id: string) => void }) {
  const [recent, setRecent] = useState(readRecentTools);
  useEffect(() => {
    const update = () => setRecent(readRecentTools());
    window.addEventListener(RECENT_EVENT, update); window.addEventListener('storage', update);
    return () => { window.removeEventListener(RECENT_EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  const visible = recent.flatMap(item => {
    const tool = TOOLS.find(tool => tool.id === item.id && !tool.hiddenFromHub && toolAllowed(tool, policy));
    return tool ? [{ ...item, tool }] : [];
  }).slice(0, 5);
  return <section className="hub-home-recent" aria-labelledby="hub-recent-title">
    <div className="hub-home-section-heading"><h2 id="hub-recent-title"><Clock size={17} /> Zuletzt verwendet</h2><span>Auf diesem Computer</span></div>
    {visible.length ? <div className="hub-recent-list">{visible.map(({ id, usedAt, tool }) => <button key={id} type="button" className={`hub-recent-item tool-color-${tool.color}`} onClick={() => onOpenTool(id)}>
      <ToolIcon id={id} /><span><strong>{tool.title}</strong><small>{new Date(usedAt).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small></span><ArrowUpRight size={16} />
    </button>)}</div> : <p>Öffne ein Werkzeug. Deine zuletzt verwendeten Werkzeuge erscheinen dann hier.</p>}
  </section>;
}
