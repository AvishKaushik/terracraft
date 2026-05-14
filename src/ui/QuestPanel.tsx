import { useEffect, useRef } from 'react';
import { useQuestStore, type QuestCategory } from '../stores/questStore';
import { useXpStore } from '../stores/xpStore';
import { useGameStore } from '../stores/gameStore';

const CATEGORY_LABELS: Record<QuestCategory, string> = {
  tutorial:    'Tutorial',
  gathering:   'Gathering',
  combat:      'Combat',
  exploration: 'Exploration',
};

const CATEGORY_ICONS: Record<QuestCategory, string> = {
  tutorial:    '📖',
  gathering:   '⛏',
  combat:      '⚔',
  exploration: '🗺',
};

export function QuestPanel() {
  const { quests, panelOpen, setPanelOpen, lastCompleted, claimCompleted } = useQuestStore();
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyJ' && !e.repeat) {
        const { chatOpen, inventoryOpen } = useGameStore.getState();
        if (chatOpen || inventoryOpen) return;
        setPanelOpen(!useQuestStore.getState().panelOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Quest completion toast
  useEffect(() => {
    if (!lastCompleted) return;
    // Give rewards
    const q = quests.find(q => q.title === lastCompleted && q.complete);
    if (q) {
      useXpStore.getState().addXp(q.rewardXp);
      if (q.rewardItems) {
        for (const { id, count } of q.rewardItems) {
          useGameStore.getState().addToHotbar(id, count);
        }
      }
    }
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(claimCompleted, 4000);
  }, [lastCompleted]);

  const categories: QuestCategory[] = ['tutorial', 'gathering', 'combat', 'exploration'];

  return (
    <>
      {/* Completion toast */}
      {lastCompleted && (
        <div id="quest-toast">
          <span id="quest-toast-label">Quest Complete!</span>
          <span id="quest-toast-title">{lastCompleted}</span>
        </div>
      )}

      {/* Key hint */}
      {!panelOpen && (
        <div id="quest-hint">[J] Quests</div>
      )}

      {panelOpen && (
        <div id="quest-panel">
          <div id="quest-panel-header">
            <span>Quest Log</span>
            <span id="quest-close" onClick={() => setPanelOpen(false)}>✕</span>
          </div>
          <div id="quest-panel-body">
            {categories.map(cat => {
              const catQuests = quests.filter(q => q.category === cat);
              const done = catQuests.filter(q => q.complete).length;
              return (
                <div key={cat} className="quest-category">
                  <div className="quest-cat-header">
                    <span>{CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}</span>
                    <span className="quest-cat-count">{done}/{catQuests.length}</span>
                  </div>
                  {catQuests.map(q => (
                    <div key={q.id} className={`quest-entry${q.complete ? ' done' : ''}`}>
                      <div className="quest-row">
                        <span className="quest-check">{q.complete ? '✔' : '○'}</span>
                        <span className="quest-title">{q.title}</span>
                        <span className="quest-reward">+{q.rewardXp} XP</span>
                      </div>
                      <div className="quest-desc">{q.desc}</div>
                      {!q.complete && (
                        <div className="quest-bar-wrap">
                          <div className="quest-bar-fill" style={{ width: `${(q.progress / q.goal) * 100}%` }} />
                          <span className="quest-bar-text">{q.progress}/{q.goal}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
