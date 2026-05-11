import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { SceneSetup } from './SceneSetup';
import { WorldChunks } from './WorldChunks';
import { BlockHighlight } from './BlockHighlight';
import { BlockBreaking } from './BlockBreaking';
import { BreakParticles, type BreakParticlesHandle } from './BreakParticles';
import { PlayerController } from './PlayerController';
import { OtherPlayers } from './OtherPlayers';
import { TorchSprites } from './TorchSprites';
import { GlowSprites } from './GlowSprites';
import { HeldTorch } from './HeldTorch';
import { HeldArm } from './HeldArm';
import { Clouds } from './Clouds';
import { LeafParticles } from './LeafParticles';
import { useMultiplayer } from '../hooks/useMultiplayer';

function SceneWithMultiplayer({ particlesRef }: { particlesRef: React.RefObject<BreakParticlesHandle> }) {
  useMultiplayer();
  return (
    <>
      <SceneSetup />
      <Clouds />
      <LeafParticles />
      <WorldChunks />
      <TorchSprites />
      <GlowSprites />
      <BlockHighlight />
      <BlockBreaking particlesRef={particlesRef} />
      <OtherPlayers />
      <BreakParticles ref={particlesRef} />
      <PlayerController />
      <HeldTorch />
      <HeldArm />
    </>
  );
}

export function Game() {
  const particlesRef = useRef<BreakParticlesHandle>(null!);

  return (
    <Canvas
      camera={{ fov: 70, near: 0.1, far: 200 }}
      frameloop="always"
      flat
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0 }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
    >
      <SceneWithMultiplayer particlesRef={particlesRef} />
    </Canvas>
  );
}
