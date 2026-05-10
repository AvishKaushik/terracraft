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
import {
  GRAVITY, JUMP_VEL, WALK_SPEED, SPRINT_SPEED, FLY_SPEED, SWIM_SPEED,
  MOUSE_SENS, WORLD_W, WORLD_H, WORLD_D, PLAYER_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT,
} from '../lib/constants';
import { type BreakParticlesHandle } from './BreakParticles';
import { getInterpolated } from '../lib/interpolation';
import { socket } from '../lib/socket';
import { waterState } from '../lib/waterState';

interface Props {
  particlesRef: React.RefObject<BreakParticlesHandle>;
}

export function PlayerController({ particlesRef }: Props) {
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const lastSpaceTap = useRef(0);

  // Working vectors – reused each frame to avoid allocations
  const posRef = useRef(new THREE.Vector3());
  const velRef = useRef(new THREE.Vector3());

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

  // ── Keyboard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const gs = useGameStore.getState();
      // Open chat with T
      if (e.code === 'KeyT' && gs.started && !gs.chatOpen && !gs.inventoryOpen) {
        e.preventDefault();
        gs.setChatOpen(true);
        document.exitPointerLock();
        return;
      }
      // Open inventory with E
      if (e.code === 'KeyE' && gs.started && !gs.chatOpen && !gs.inventoryOpen) {
        e.preventDefault();
        gs.setInventoryOpen(true);
        document.exitPointerLock();
        return;
      }
      if (gs.chatOpen || gs.inventoryOpen) return;

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
      let yaw = ps.yaw - e.movementX * MOUSE_SENS;
      let pitch = ps.pitch - e.movementY * MOUSE_SENS;
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

  // ── Block interaction ─────────────────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const { world, setBlock } = useWorldStore.getState();
      const ps = usePlayerStore.getState();
      const posVec = new THREE.Vector3(...ps.pos);

      if (e.button === 0) {
        const hit = raycastBlock(posVec, ps.yaw, ps.pitch, world);
        if (!hit || hit.y === 0) return;
        const brokenId = world[(hit.y * WORLD_D + hit.z) * WORLD_W + hit.x];
        particlesRef.current?.spawn(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, brokenId);
        setBlock(hit.x, hit.y, hit.z, 0);
      } else if (e.button === 2) {
        const hit = raycastBlock(posVec, ps.yaw, ps.pitch, world);
        if (!hit) return;
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

        // Prevent placing inside a remote player's body.
        // Use getInterpolated — the store pos is stale (only set on join, not on move).
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

        const { currentSlot, hotbar } = useGameStore.getState();
        const blockId = hotbar[currentSlot];

        if (blockId === 15) {
          // Torch: only allow on top face or side faces (not bottom)
          if (hit.face[1] === -1) return; // no hanging torches
          setBlock(px, py, pz, blockId, hit.face as [number, number, number]);
        } else {
          setBlock(px, py, pz, blockId);
        }
      }
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const { currentSlot, selectSlot } = useGameStore.getState();
      selectSlot(e.deltaY > 0 ? currentSlot + 1 : currentSlot - 1);
    };
    gl.domElement.addEventListener('mousedown', onMouseDown);
    gl.domElement.addEventListener('contextmenu', onContext);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      gl.domElement.removeEventListener('mousedown', onMouseDown);
      gl.domElement.removeEventListener('contextmenu', onContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [gl.domElement, particlesRef]);

  // ── Game loop ─────────────────────────────────────────────────────────
  const fpsAccum   = useRef({ counter: 0, timer: 0 });
  const moveAccum   = useRef(0);

  useFrame((_state, rawDt) => {
    const { started, chatOpen, inventoryOpen } = useGameStore.getState();
    if (!started || chatOpen || inventoryOpen) {
      waterState.eyeInWater = false;
      return;
    }

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
    const speed = sprint
      ? (flying ? FLY_SPEED * 1.6 : SPRINT_SPEED)
      : (flying ? FLY_SPEED : WALK_SPEED);
    const vx = (fwdX * mvF + rgtX * mvR) * speed;
    const vz = (fwdZ * mvF + rgtZ * mvR) * speed;

    const inWater = isInWater(pos.x, pos.y, pos.z, world);

    if (flying) {
      let vy = 0;
      if (k['Space']) vy += speed;
      if (k['ControlLeft'] || k['ControlRight']) vy -= speed;
      vel.set(vx, vy, vz);
    } else if (inWater) {
      // Swimming: horizontal speed reduced, vertical driven entirely by input or buoyancy
      vel.x = vx / speed * SWIM_SPEED;
      vel.z = vz / speed * SWIM_SPEED;
      if (k['Space']) {
        // Fully submerged → swim up; eye already above water → jump out
        vel.y = isEyeInWater(pos.x, pos.y, pos.z, world) ? SWIM_SPEED : JUMP_VEL * 0.82;
      } else if (k['ControlLeft'] || k['ControlRight']) {
        vel.y = -SWIM_SPEED * 0.7;
      } else {
        // No vertical input: weak gravity + damping so the player floats near neutral
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

    // Underwater state — drives CSS tint overlay and 3D fog in SceneSetup
    const eyeWet = isEyeInWater(pos.x, pos.y, pos.z, world);
    waterState.eyeInWater = eyeWet;
    document.documentElement.style.setProperty('--water-alpha', eyeWet ? '1' : '0');

    // --- Axis-by-axis collision ---
    let onGround = false;
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

    if (pos.y < -10) {
      pos.set(WORLD_W / 2 + 0.5, WORLD_H + 1, WORLD_D / 2 + 0.5);
      vel.set(0, 0, 0);
    }

    ps.setOnGround(onGround);

    // --- Camera ---
    camera.position.set(pos.x, pos.y + EYE_HEIGHT, pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // FOV — lerp toward target based on movement state
    const targetFov = flying ? 83 : (sprint && mvLen > 0 && !inWater) ? 78 : 70;
    const pcam = camera as THREE.PerspectiveCamera;
    if (Math.abs(pcam.fov - targetFov) > 0.05) {
      pcam.fov += (targetFov - pcam.fov) * Math.min(1, 8 * dt);
      pcam.updateProjectionMatrix();
    }

    // --- Sync stores (cheap, only pos array reference changes) ---
    usePlayerStore.setState({ pos: [pos.x, pos.y, pos.z], vel: [vel.x, vel.y, vel.z] });

    // --- Broadcast position at 20 Hz ---
    moveAccum.current += dt;
    if (moveAccum.current >= 0.05) {
      moveAccum.current = 0;
      socket.emit('player:move', { pos: [pos.x, pos.y, pos.z], yaw, pitch });
    }

    // --- HUD stats ---
    const acc = fpsAccum.current;
    acc.counter++;
    acc.timer += dt;
    if (acc.timer >= 0.5) {
      const fps = Math.round(acc.counter / acc.timer);
      acc.counter = 0; acc.timer = 0;
      const mode = flying ? 'flying' : inWater ? 'swimming' : (onGround ? 'walking' : 'falling');
      useGameStore.getState().setStats(fps, `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`, mode);
    }
  });

  return null;
}
