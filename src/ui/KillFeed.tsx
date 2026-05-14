import { useEffect } from 'react';
import { useKillFeedStore } from '../stores/killFeedStore';

const FADE_MS = 4000;

export function KillFeed() {
  const entries = useKillFeedStore(s => s.entries);
  const remove  = useKillFeedStore(s => s.remove);

  useEffect(() => {
    if (entries.length === 0) return;
    const latest = entries[entries.length - 1];
    const timer = setTimeout(() => remove(latest.id), FADE_MS);
    return () => clearTimeout(timer);
  }, [entries, remove]);

  if (entries.length === 0) return null;

  return (
    <div id="kill-feed">
      {entries.map(e => (
        <div key={e.id} className={`kill-entry${e.own ? ' own' : ''}`}>
          {e.text}
        </div>
      ))}
    </div>
  );
}
