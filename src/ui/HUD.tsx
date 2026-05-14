import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useXpStore, XP_PER_LEVEL_CONST } from '../stores/xpStore';
import { useEffectsStore } from '../stores/effectsStore';
import { ITEMS } from '../lib/items';

// Pixel-art heart: 18×16 SVG drawn to match Minecraft style
function Heart({ type }: { type: 'full' | 'half' | 'empty' }) {
  const path = 'M4,2 L6,0 L8,0 L10,2 L12,0 L14,0 L16,2 L16,6 L9,14 L2,6 L2,2 Z';
  const fullFill  = '#e83333';
  const halfFill  = '#e83333';
  const emptyFill = 'rgba(0,0,0,0.35)';
  return (
    <svg width="9" height="8" viewBox="0 0 16 14" className="hud-icon">
      {type === 'half' ? (
        <>
          <clipPath id="hc"><rect x="0" y="0" width="8" height="14" /></clipPath>
          <path d={path} fill={emptyFill} />
          <path d={path} fill={halfFill} clipPath="url(#hc)" />
        </>
      ) : (
        <path d={path} fill={type === 'full' ? fullFill : emptyFill} />
      )}
    </svg>
  );
}

// Pixel-art drumstick
function Drumstick({ type }: { type: 'full' | 'half' | 'empty' }) {
  const fullFill  = '#c8792a';
  const halfFill  = '#c8792a';
  const emptyFill = 'rgba(0,0,0,0.35)';
  const path = 'M12,1 L15,4 L13,6 L11,5 L8,8 L9,11 L7,13 L5,11 L1,7 L3,5 L6,6 L9,3 L8,1 Z';
  return (
    <svg width="9" height="8" viewBox="0 0 16 14" className="hud-icon">
      {type === 'half' ? (
        <>
          <clipPath id="dc"><rect x="0" y="0" width="8" height="14" /></clipPath>
          <path d={path} fill={emptyFill} />
          <path d={path} fill={halfFill} clipPath="url(#dc)" />
        </>
      ) : (
        <path d={path} fill={type === 'full' ? fullFill : emptyFill} />
      )}
    </svg>
  );
}

export function HUD() {
  const fps    = useGameStore(s => s.fps);
  const posStr = useGameStore(s => s.posStr);
  const mode   = useGameStore(s => s.mode);
  const health    = usePlayerStore(s => s.health);
  const maxHealth = usePlayerStore(s => s.maxHealth);
  const hunger    = usePlayerStore(s => s.hunger);
  const maxHunger = usePlayerStore(s => s.maxHunger);
  const armor     = usePlayerStore(s => s.armor);
  const xp        = useXpStore(s => s.xp);
  const xpLevel   = useXpStore(s => s.level);
  const speedBoost    = useEffectsStore(s => s.speedBoost);
  const strengthBoost = useEffectsStore(s => s.strengthBoost);

  const totalDef = (['head', 'chest', 'legs', 'feet'] as const).reduce((sum, slot) => {
    return sum + (ITEMS[armor[slot]]?.armorValue ?? 0);
  }, 0);

  const hearts = Array.from({ length: maxHealth / 2 }, (_, i) => {
    const filled = health - i * 2;
    if (filled >= 2) return 'full' as const;
    if (filled === 1) return 'half' as const;
    return 'empty' as const;
  });

  const drumsticks = Array.from({ length: maxHunger / 2 }, (_, i) => {
    const filled = hunger - i * 2;
    if (filled >= 2) return 'full' as const;
    if (filled === 1) return 'half' as const;
    return 'empty' as const;
  });

  const xpFrac = (xp % XP_PER_LEVEL_CONST) / XP_PER_LEVEL_CONST;

  return (
    <>
      <div id="info">
        FPS: {fps}<br />
        XYZ: {posStr}<br />
        Mode: {mode}
      </div>

      {/* Potion effects — top right, below kill feed */}
      {(speedBoost > 0 || strengthBoost > 0) && (
        <div id="potion-effects">
          {speedBoost    > 0 && <span className="effect-tag speed">    Speed {Math.ceil(speedBoost)}s</span>}
          {strengthBoost > 0 && <span className="effect-tag strength"> Strength {Math.ceil(strengthBoost)}s</span>}
        </div>
      )}

      {/* Bottom-centre HUD: armor → health → XP → hunger */}
      <div id="hud-center">
        {totalDef > 0 && (
          <div id="armor-bar">
            {Array.from({ length: Math.ceil(totalDef / 2) }, (_, i) => (
              <span key={i} className={`armor-pip${totalDef - i * 2 < 2 ? ' half' : ''}`} />
            ))}
          </div>
        )}

        <div id="bars-row">
          <div id="health-bar">
            {hearts.map((h, i) => <Heart key={i} type={h} />)}
          </div>

          <div id="hunger-bar">
            {drumsticks.slice().reverse().map((d, i) => <Drumstick key={i} type={d} />)}
          </div>
        </div>

        <div id="xp-bar-wrap">
          <div id="xp-bar">
            <div id="xp-fill" style={{ width: `${xpFrac * 100}%` }} />
          </div>
          {xpLevel > 0 && <span id="xp-level">{xpLevel}</span>}
        </div>
      </div>
    </>
  );
}
