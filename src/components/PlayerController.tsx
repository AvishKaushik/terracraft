import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { usePlayerStore } from '../stores/playerStore';
import { useWorldStore } from '../stores/worldStore';
import { useGameStore } from '../stores/gameStore';
import { raycastBlock } from '../lib/raycast';
import { collidesAt, isInWater, isEyeInWater } from '../lib/physics';
import { inBounds } from '../lib/terrain';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { ITEMS } from '../lib/items';
import {
  GRAVITY, JUMP_VEL, WALK_SPEED, SPRINT_SPEED, FLY_SPEED, SWIM_SPEED,
  WORLD_W, WORLD_H, WORLD_D, PLAYER_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT,
} from '../lib/constants';
import { useSettingsStore } from '../stores/settingsStore';
import { playPlace, playFootstep, playSplash } from '../lib/sounds';
import { getInterpolated } from '../lib/interpolation';
import { socket } from '../lib/socket';
import { waterState } from '../lib/waterState';
import { useChestStore } from '../stores/chestStore';
import { useDroppedItemsStore } from '../stores/droppedItemsStore';
import { useMobStore, mobTargets } from '../stores/mobStore';
import { useEffectsStore } from '../stores/effectsStore';
import { useXpStore } from '../stores/xpStore';
import { useQuestStore } from '../stores/questStore';

function flashDamage() {
  const el = document.getElementById('damage-flash');
  if (el) { el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 350); }
}

export function PlayerController() {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const lastSpaceTap = useRef(0);

  const posRef = useRef(new THREE.Vector3());
  const velRef = useRef(new THREE.Vector3());

  // Accumulators
  const hungerAccum    = useRef(0);
  const starvAccum     = useRef(0);
  const regenAccum     = useRef(0);
  const bowCharging    = useRef(false);
  const bowCharge      = useRef(0);
  const pickupAccum    = useRef(0);
  const fpsAccum     = useRef({ counter: 0, timer: 0 });
  const moveAccum    = useRef(0);
  const stepTimer    = useRef(0);
  const wasInWater   = useRef(false);
  const bobPhase     = useRef(0);
  const bobDecay     = useRef(0);

  // ── Initialise player position ──────────────────────────────────────
  useEffect(() => {
    const { world } = useWorldStore.getState();
    const sx = Math.floor(WORLD_W / 2);
    const sz = Math.floor(WORLD_D / 2);
    let sy = 1;
    for (let y = WORLD_H - 1; y > 0; y--) {
      if (world[(y * WORLD_D + sz) * WORLD_W + sx] !== 0) { sy = y + 1; break; }
    }
    posRef.current.set(sx + 0.5, sy + 0.01, sz + 0.5);
    velRef.current.set(0, 0, 0);
    usePlayerStore.setState({ pos: [posRef.current.x, posRef.current.y, posRef.current.z] });
  }, []);

  // ── Sync posRef when player respawns (dead: true → false) ──────────
  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state, prev) => {
      if (prev.dead && !state.dead) {
        posRef.current.set(...state.spawnPos);
        velRef.current.set(0, 0, 0);
      }
    });
    return unsub;
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const gs = useGameStore.getState();
      if (e.code === 'KeyT' && gs.started && !gs.chatOpen && !gs.inventoryOpen) {
        e.preventDefault();
        gs.setChatOpen(true);
        document.exitPointerLock();
        return;
      }
      if (e.code === 'KeyE' && gs.started && !gs.chatOpen && !gs.inventoryOpen && !gs.chestOpen) {
        e.preventDefault();
        gs.setInventoryOpen(true);
        document.exitPointerLock();
        return;
      }
      if (gs.chatOpen || gs.inventoryOpen || gs.chestOpen || gs.furnaceOpen) return;

      keys.current[e.code] = true;
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5));
        if (n >= 1 && n <= 9) useGameStore.getState().selectSlot(n - 1);
      }
      if (e.code === 'Space') {
        const now = performance.now();
        if (now - lastSpaceTap.current < 280) {
          const { world } = useWorldStore.getState();
          const pos = posRef.current;
          const swimming = isInWater(pos.x, pos.y, pos.z, world);
          if (!swimming) {
            const cur = usePlayerStore.getState().flying;
            usePlayerStore.getState().setFlying(!cur);
            velRef.current.y = 0;
          }
        }
        lastSpaceTap.current = now;
      }
      if (e.code === 'KeyF') {
        const cur = usePlayerStore.getState().flying;
        usePlayerStore.getState().setFlying(!cur);
        velRef.current.y = 0;
      }
      if (e.code === 'Escape') document.exitPointerLock();
    };
    const onUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ── Mouse look ───────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const ps = usePlayerStore.getState();
      const sens = useSettingsStore.getState().sensitivity;
      let yaw = ps.yaw - e.movementX * sens;
      let pitch = ps.pitch - e.movementY * sens;
      const limit = Math.PI / 2 - 0.001;
      pitch = Math.max(-limit, Math.min(limit, pitch));
      ps.setYaw(yaw);
      ps.setPitch(pitch);
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [gl.domElement]);

  // ── Pointer lock state ────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      useGameStore.getState().setMouseLocked(locked);
    };
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, [gl.domElement]);

  // ── Block / food interaction ──────────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const { world, setBlock } = useWorldStore.getState();
      const ps = usePlayerStore.getState();
      const posVec = new THREE.Vector3(...ps.pos);

      if (e.button === 2) {
        // Bow charging: right-click with bow + arrows
        const { currentSlot, hotbar } = useGameStore.getState();
        const heldId = hotbar[currentSlot]?.id ?? 0;
        if (heldId === 280) {
          const hasArrows = hotbar.some(s => s?.id === 281);
          if (hasArrows) {
            bowCharging.current = true;
            bowCharge.current = 0;
            return;
          }
        }

        // Eating / potion: right-click with food/potion in hand
        const { consumeFromSlot } = useGameStore.getState();
        const item = heldId >= 256 ? ITEMS[heldId] : null;
        if (item?.potionEffect) {
          useEffectsStore.getState().applyPotion(item.potionEffect);
          if (item.potionEffect === 'healing') {
            const ps2 = usePlayerStore.getState();
            ps2.setHealth(Math.min(ps2.maxHealth, ps2.health + 6));
          }
          consumeFromSlot(currentSlot);
          return;
        }
        if (item?.foodValue) {
          const ps2 = usePlayerStore.getState();
          if (ps2.hunger < ps2.maxHunger) {
            ps2.setHunger(Math.min(ps2.maxHunger, ps2.hunger + item.foodValue));
            consumeFromSlot(currentSlot);
          }
          return;
        }

        // Animal breeding: right-click with wheat near a cow
        if (heldId === 284) {
          const { pos: pp } = usePlayerStore.getState();
          let closestId: string | null = null;
          let closestDist = 3.5;
          for (const [id, t] of mobTargets) {
            const mob = useMobStore.getState().mobs.get(id);
            if (!mob || mob.type !== 'cow') continue;
            const dx = t.pos[0] - pp[0], dz = t.pos[2] - pp[2];
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < closestDist) { closestDist = dist; closestId = id; }
          }
          if (closestId) {
            socket.emit('mob:breed', { id: closestId });
            consumeFromSlot(currentSlot);
            return;
          }
        }

        // Hoe: right-click on grass/dirt → farmland (block 40)
        if (item?.isTool) {
          const hit2 = raycastBlock(posVec, ps.yaw, ps.pitch, world);
          if (hit2) {
            const hitId2 = world[(hit2.y * WORLD_D + hit2.z) * WORLD_W + hit2.x];
            if (hitId2 === 1 || hitId2 === 2) { // grass or dirt
              const { setBlock } = useWorldStore.getState();
              setBlock(hit2.x, hit2.y, hit2.z, 40);
              return;
            }
          }
        }

        // Enchanting Table: right-click → open enchanting UI
        const hit3 = raycastBlock(posVec, ps.yaw, ps.pitch, world);
        if (hit3) {
          const hitId3 = world[(hit3.y * WORLD_D + hit3.z) * WORLD_W + hit3.x];
          if (hitId3 === 43) {
            useGameStore.getState().setEnchantingOpen(true, [hit3.x, hit3.y, hit3.z]);
            document.exitPointerLock();
            return;
          }
          if (hitId3 === 44) {
            useGameStore.getState().setBrewingOpen(true, [hit3.x, hit3.y, hit3.z]);
            document.exitPointerLock();
            return;
          }
          // TNT: right-click with any item → ignite
          if (hitId3 === 39) {
            socket.emit('tnt:ignite', { x: hit3.x, y: hit3.y, z: hit3.z });
            return;
          }
          // Farmland: right-click with seeds → plant wheat (41)
          if (hitId3 === 40 && heldId === 283) {
            const { setBlock: sb } = useWorldStore.getState();
            sb(hit3.x, hit3.y + 1, hit3.z, 41);
            consumeFromSlot(currentSlot);
            return;
          }
        }

        const hit = raycastBlock(posVec, ps.yaw, ps.pitch, world);
        if (!hit) return;

        const hitId = world[(hit.y * WORLD_D + hit.z) * WORLD_W + hit.x];

        // Right-click on a bed — set spawn point
        if (hitId === 33) {
          usePlayerStore.getState().setSpawnPos([hit.x + 0.5, hit.y + 1, hit.z + 0.5]);
          const el = document.getElementById('spawn-toast');
          if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200); }
          return;
        }

        // Right-click on a furnace — open furnace UI
        if (hitId === 34) {
          useGameStore.getState().setFurnaceOpen(true, [hit.x, hit.y, hit.z]);
          document.exitPointerLock();
          return;
        }

        // Right-click on a chest — open chest UI
        if (hitId === 32) {
          useChestStore.getState().setData([hit.x, hit.y, hit.z], Array(27).fill(0));
          socket.emit('chest:open', { x: hit.x, y: hit.y, z: hit.z });
          useGameStore.getState().setChestOpen(true);
          document.exitPointerLock();
          return;
        }

        const px = hit.x + hit.face[0];
        const py = hit.y + hit.face[1];
        const pz = hit.z + hit.face[2];
        if (!inBounds(px, py, pz)) return;
        if (world[(py * WORLD_D + pz) * WORLD_W + px] !== 0) return;
        const dx = px + 0.5 - posRef.current.x;
        const dz = pz + 0.5 - posRef.current.z;
        const inPlayer = (
          dx > -0.5 - PLAYER_WIDTH / 2 && dx < 0.5 + PLAYER_WIDTH / 2 &&
          dz > -0.5 - PLAYER_WIDTH / 2 && dz < 0.5 + PLAYER_WIDTH / 2 &&
          py + 1 > posRef.current.y && py < posRef.current.y + PLAYER_HEIGHT
        );
        if (inPlayer) return;

        const { playerIds } = useMultiplayerStore.getState();
        let inRemote = false;
        for (const id of playerIds) {
          const interp = getInterpolated(id);
          if (!interp) continue;
          const { pos: rp } = interp;
          if (
            Math.abs(px + 0.5 - rp.x) < 0.5 + PLAYER_WIDTH / 2 &&
            Math.abs(pz + 0.5 - rp.z) < 0.5 + PLAYER_WIDTH / 2 &&
            py + 1 > rp.y && py < rp.y + PLAYER_HEIGHT
          ) { inRemote = true; break; }
        }
        if (inRemote) return;

        const { currentSlot: cs, hotbar: hb, consumeFromSlot: consume } = useGameStore.getState();
        const blockId = hb[cs]?.id ?? 0;
        if (blockId === 0 || blockId >= 256) return; // can't place items

        if (blockId === 15) {
          if (hit.face[1] === -1) return;
          setBlock(px, py, pz, blockId, hit.face as [number, number, number]);
        } else {
          setBlock(px, py, pz, blockId);
        }
        consume(cs);
        useQuestStore.getState().reportPlace();
        playPlace();
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      if (!bowCharging.current) return;
      bowCharging.current = false;
      const charge = bowCharge.current;
      bowCharge.current = 0;
      if (charge < 0.3) return; // too short draw
      const ps2 = usePlayerStore.getState();
      // Consume one arrow
      const gs2 = useGameStore.getState();
      const arrowSlot = gs2.hotbar.findIndex(s => s?.id === 281);
      if (arrowSlot !== -1) gs2.consumeFromSlot(arrowSlot);
      socket.emit('bow:fire', {
        from:   ps2.pos,
        yaw:    ps2.yaw,
        pitch:  ps2.pitch,
        charge: Math.min(charge, 1.5),
      });
    };

    const onContext = (e: MouseEvent) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const { currentSlot, selectSlot } = useGameStore.getState();
      selectSlot(e.deltaY > 0 ? currentSlot + 1 : currentSlot - 1);
    };
    gl.domElement.addEventListener('mousedown', onMouseDown);
    gl.domElement.addEventListener('mouseup', onMouseUp);
    gl.domElement.addEventListener('contextmenu', onContext);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      gl.domElement.removeEventListener('mousedown', onMouseDown);
      gl.domElement.removeEventListener('mouseup', onMouseUp);
      gl.domElement.removeEventListener('contextmenu', onContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [gl.domElement]);

  // ── Game loop ─────────────────────────────────────────────────────────
  useFrame((_state, rawDt) => {
    const { started, chatOpen, inventoryOpen, settingsOpen, chestOpen, furnaceOpen, enchantingOpen, brewingOpen } = useGameStore.getState();
    if (!started || chatOpen || inventoryOpen || settingsOpen || chestOpen || furnaceOpen || enchantingOpen || brewingOpen) {
      waterState.eyeInWater = false;
      return;
    }

    // Don't tick if dead — DeathScreen is showing
    if (usePlayerStore.getState().dead) return;

    const dt = Math.min(rawDt, 0.1);
    const k = keys.current;
    const { world } = useWorldStore.getState();
    const ps = usePlayerStore.getState();
    const pos = posRef.current;
    const vel = velRef.current;
    const flying = ps.flying;
    const { yaw, pitch } = ps;

    // --- Movement input ---
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    let mvF = 0, mvR = 0;
    if (k['KeyW']) mvF += 1;
    if (k['KeyS']) mvF -= 1;
    if (k['KeyD']) mvR += 1;
    if (k['KeyA']) mvR -= 1;
    const mvLen = Math.hypot(mvF, mvR);
    if (mvLen > 0) { mvF /= mvLen; mvR /= mvLen; }
    const fwdX = -sinY, fwdZ = -cosY;
    const rgtX =  cosY, rgtZ = -sinY;
    const sprint = k['ShiftLeft'] || k['ShiftRight'];
    const speedMult2 = useEffectsStore.getState().speedBoost > 0 ? 1.5 : 1;
    const speed = (sprint
      ? (flying ? FLY_SPEED * 1.6 : SPRINT_SPEED)
      : (flying ? FLY_SPEED : WALK_SPEED)) * speedMult2;
    const vx = (fwdX * mvF + rgtX * mvR) * speed;
    const vz = (fwdZ * mvF + rgtZ * mvR) * speed;

    const inWater = isInWater(pos.x, pos.y, pos.z, world);

    if (flying) {
      let vy = 0;
      if (k['Space']) vy += speed;
      if (k['ControlLeft'] || k['ControlRight']) vy -= speed;
      vel.set(vx, vy, vz);
    } else if (inWater) {
      vel.x = vx / speed * SWIM_SPEED;
      vel.z = vz / speed * SWIM_SPEED;
      if (k['Space']) {
        vel.y = isEyeInWater(pos.x, pos.y, pos.z, world) ? SWIM_SPEED : JUMP_VEL * 0.82;
      } else if (k['ControlLeft'] || k['ControlRight']) {
        vel.y = -SWIM_SPEED * 0.7;
      } else {
        vel.y -= GRAVITY * 0.1 * dt;
        vel.y *= Math.max(0, 1 - 5 * dt);
        if (vel.y < -2) vel.y = -2;
      }
    } else {
      vel.x = vx;
      vel.z = vz;
      vel.y -= GRAVITY * dt;
      if (vel.y < -55) vel.y = -55;
      if (k['Space'] && ps.onGround) {
        vel.y = JUMP_VEL;
        ps.setOnGround(false);
      }
    }

    // Underwater state
    const eyeWet = isEyeInWater(pos.x, pos.y, pos.z, world);
    waterState.eyeInWater = eyeWet;
    document.documentElement.style.setProperty('--water-alpha', eyeWet ? '1' : '0');

    // --- Axis-by-axis collision ---
    let onGround = false;
    const preVelY = vel.y; // capture before collision zeroes it
    const dy = vel.y * dt;
    const testY = pos.y + dy;
    if (!collidesAt(pos.x, testY, pos.z, world)) {
      pos.y = testY;
      if (vel.y < 0 && collidesAt(pos.x, pos.y - 0.001, pos.z, world)) onGround = true;
    } else {
      if (vel.y < 0) onGround = true;
      vel.y = 0;
    }

    const testX = pos.x + vel.x * dt;
    if (!collidesAt(testX, pos.y, pos.z, world)) pos.x = testX; else vel.x = 0;

    const testZ = pos.z + vel.z * dt;
    if (!collidesAt(pos.x, pos.y, testZ, world)) pos.z = testZ; else vel.z = 0;

    // Fall damage disabled

    // Void death
    if (pos.y < -10) {
      ps.setHealth(0);
      ps.setDead(true);
      pos.set(WORLD_W / 2 + 0.5, WORLD_H + 1, WORLD_D / 2 + 0.5);
      vel.set(0, 0, 0);
    }

    ps.setOnGround(onGround);

    // --- Potion effects tick ---
    useEffectsStore.getState().tick(dt);
    const eff = useEffectsStore.getState();
    // Healing pulse
    if (eff.healingPulse > 0) {
      useEffectsStore.setState({ healingPulse: eff.healingPulse - 1 });
      const ps3 = usePlayerStore.getState();
      ps3.setHealth(Math.min(ps3.maxHealth, ps3.health + 2));
    }

    // --- Bow charge tick ---
    if (bowCharging.current) bowCharge.current += dt;

    // --- Hunger depletion ---
    if (mvLen > 0 && onGround && !flying && !inWater) {
      hungerAccum.current += dt * (sprint ? 1.0 : 0.5);
      if (hungerAccum.current >= 1) {
        const ps2 = usePlayerStore.getState();
        ps2.setHunger(Math.max(0, ps2.hunger - 1));
        hungerAccum.current -= 1;
      }
    }

    const ps2 = usePlayerStore.getState();

    // --- Starvation damage ---
    if (ps2.hunger <= 0 && ps2.health > 1) {
      starvAccum.current += dt;
      if (starvAccum.current >= 2) {
        starvAccum.current -= 2;
        ps2.setHealth(Math.max(1, ps2.health - 1));
        flashDamage();
      }
    } else {
      starvAccum.current = 0;
    }

    // --- Health regen at full hunger ---
    if (ps2.hunger >= 20 && ps2.health > 0 && ps2.health < 20) {
      regenAccum.current += dt;
      if (regenAccum.current >= 2) {
        ps2.setHealth(ps2.health + 1);
        regenAccum.current -= 2;
      }
    } else {
      regenAccum.current = 0;
    }

    // --- Item pickup (check every 0.25s) ---
    pickupAccum.current += dt;
    if (pickupAccum.current >= 0.25) {
      pickupAccum.current = 0;
      const { clusters } = useDroppedItemsStore.getState();
      for (const [id, cluster] of clusters) {
        const dx = cluster.pos[0] - pos.x;
        const dy = cluster.pos[1] - pos.y;
        const dz = cluster.pos[2] - pos.z;
        if (dx * dx + dy * dy + dz * dz < 1.5 * 1.5) {
          socket.emit('items:pickup', { id });
        }
      }
    }

    // --- Camera ---
    camera.position.set(pos.x, pos.y + EYE_HEIGHT, pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // Camera bob
    const bobbing = mvLen > 0 && onGround && !flying && !inWater;
    bobDecay.current = bobbing
      ? Math.min(1, bobDecay.current + dt * 10)
      : Math.max(0, bobDecay.current - dt * 10);
    if (bobbing) bobPhase.current += dt * (sprint ? 13 : 8.5);
    const bobAmp = (sprint ? 0.062 : 0.042) * bobDecay.current;
    camera.position.y += Math.sin(bobPhase.current) * bobAmp;

    // Footsteps
    if (mvLen > 0 && onGround && !inWater && !flying) {
      stepTimer.current -= dt;
      if (stepTimer.current <= 0) {
        playFootstep();
        stepTimer.current = sprint ? 0.30 : 0.42;
      }
    } else {
      stepTimer.current = 0;
    }

    // Water enter/exit splash
    if (inWater && !wasInWater.current) playSplash();
    wasInWater.current = inWater;

    // FOV
    const baseFov = useSettingsStore.getState().baseFov;
    const targetFov = flying ? baseFov + 13 : (sprint && mvLen > 0 && !inWater) ? baseFov + 8 : baseFov;
    const pcam = camera as THREE.PerspectiveCamera;
    if (Math.abs(pcam.fov - targetFov) > 0.05) {
      pcam.fov += (targetFov - pcam.fov) * Math.min(1, 8 * dt);
      pcam.updateProjectionMatrix();
    }

    usePlayerStore.setState({ pos: [pos.x, pos.y, pos.z], vel: [vel.x, vel.y, vel.z] });

    // Broadcast position at 20 Hz
    moveAccum.current += dt;
    if (moveAccum.current >= 0.05) {
      moveAccum.current = 0;
      socket.emit('player:move', { pos: [pos.x, pos.y, pos.z], yaw, pitch });
    }

    // HUD stats + quest position tracking
    const acc = fpsAccum.current;
    acc.counter++;
    acc.timer += dt;
    if (acc.timer >= 0.5) {
      const fps = Math.round(acc.counter / acc.timer);
      acc.counter = 0; acc.timer = 0;
      const mode = flying ? 'flying' : inWater ? 'swimming' : (onGround ? 'walking' : 'falling');
      useGameStore.getState().setStats(fps, `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`, mode);
      const spawnX = WORLD_W / 2, spawnZ = WORLD_D / 2;
      useQuestStore.getState().reportPos(pos.x, pos.y, pos.z, spawnX, spawnZ);
    }
  });

  return null;
}
