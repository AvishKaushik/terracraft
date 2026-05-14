import { useMemo } from 'react';
import { useGameStore, type Enchants } from '../stores/gameStore';
import { useXpStore } from '../stores/xpStore';
import { ITEMS, ENCHANTS, type EnchantName } from '../lib/items';
import { BLOCKS } from '../lib/blocks';

const ENCHANT_DESCRIPTIONS: Record<EnchantName, string> = {
  Sharpness:  'Swords deal +2 damage per level',
  Efficiency: 'Pickaxes mine 30% faster per level',
  Protection: 'Armor absorbs +2 damage per level',
};

function validEnchant(id: number, name: EnchantName): boolean {
  if (name === 'Sharpness')  return id >= 260 && id <= 263;
  if (name === 'Efficiency') return id >= 256 && id <= 259;
  if (name === 'Protection') return !!(ITEMS[id]?.armorSlot);
  return false;
}

export function EnchantingUI() {
  const enchantingOpen    = useGameStore(s => s.enchantingOpen);
  const setEnchantingOpen = useGameStore(s => s.setEnchantingOpen);
  const currentSlot       = useGameStore(s => s.currentSlot);
  const hotbar            = useGameStore(s => s.hotbar);
  const applyEnchant      = useGameStore(s => s.applyEnchant);
  const level             = useXpStore(s => s.level);
  const spendLevels       = useXpStore(s => s.spendLevels);

  const slot   = hotbar[currentSlot];
  const heldId = slot?.id ?? 0;
  const existing: Enchants = slot?.enchants ?? {};

  const options = useMemo(() => {
    if (heldId === 0 || heldId < 256) return [];
    return ENCHANTS.filter(e => validEnchant(heldId, e));
  }, [heldId]);

  if (!enchantingOpen) return null;

  const name = heldId >= 256 ? (ITEMS[heldId]?.name ?? '') : (BLOCKS[heldId]?.name ?? '');

  return (
    <div id="enchanting-ui">
      <div className="ui-panel-header">
        <span className="ui-title">Enchanting Table</span>
        <span className="enchanting-xp">Lvl {level}</span>
      </div>
      <div className="ui-panel-body">
        <div className="enchanting-held">
          Held: <strong>{name || 'Nothing'}</strong>
          {Object.entries(existing).map(([k, v]) => (
            <span key={k} className="enchant-tag">{k} {v}</span>
          ))}
        </div>
        <div className="enchanting-options">
          {options.length === 0 && <div className="enchant-none">Hold an enchantable item</div>}
          {options.map(enchantName => {
            const curLevel  = existing[enchantName] ?? 0;
            const nextLevel = Math.min(curLevel + 1, 3);
            const cost      = nextLevel;
            const canAfford = level >= cost && curLevel < 3;
            return (
              <button
                key={enchantName}
                className={`enchant-option${canAfford ? '' : ' disabled'}`}
                disabled={!canAfford}
                onClick={() => {
                  if (!canAfford) return;
                  if (spendLevels(cost)) applyEnchant(currentSlot, enchantName, nextLevel);
                }}
              >
                <div className="enchant-name">{enchantName} {nextLevel}</div>
                <div className="enchant-desc">{ENCHANT_DESCRIPTIONS[enchantName]}</div>
                <div className="enchant-cost">Cost: {cost} level{cost !== 1 ? 's' : ''}</div>
              </button>
            );
          })}
        </div>
        <button className="ui-close-btn" onClick={() => { setEnchantingOpen(false); }}>
          Close
        </button>
      </div>
    </div>
  );
}
