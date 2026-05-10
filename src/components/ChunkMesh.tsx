import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '../stores/worldStore';
import { buildChunkGeometry } from '../lib/mesher';
import { atlasTexture } from '../lib/atlas';
import { dayNight } from '../lib/dayNight';

interface Props { cx: number; cz: number; }

const vertexShader = /* glsl */`
  attribute vec3 color;
  attribute float aSkyLight;
  varying vec3 vColor;
  varying float vSkyLight;
  varying vec2 vUv;

  void main() {
    vColor    = color;
    vSkyLight = aSkyLight;
    vUv       = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform float uDayFactor;
  varying vec3 vColor;
  varying float vSkyLight;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.1) discard;
    // block light is always on; sky light fades to 0 at night
    float brightness = max(vColor.r, vSkyLight * uDayFactor);
    gl_FragColor = vec4(tex.rgb * brightness, tex.a);
  }
`;

function makeChunkMat(transparent: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map:          { value: atlasTexture },
      uDayFactor:   { value: 1.0 },
    },
    vertexShader,
    fragmentShader,
    transparent,
    alphaTest: transparent ? 0.1 : 0,
    depthWrite: true,
    fog: false,
  });
}

export function ChunkMesh({ cx, cz }: Props) {
  const opaqueRef = useRef<THREE.Mesh>(null!);
  const transRef  = useRef<THREE.Mesh>(null!);
  const key = `${cx},${cz}`;

  const world         = useWorldStore(s => s.world);
  const lightMap      = useWorldStore(s => s.lightMap);
  const skyLightMap   = useWorldStore(s => s.skyLightMap);
  const blockLightMap = useWorldStore(s => s.blockLightMap);
  const dirtyChunks   = useWorldStore(s => s.dirtyChunks);
  const clearDirty    = useWorldStore(s => s.clearDirty);

  const opaqueMat = useMemo(() => makeChunkMat(false), []);
  const transMat  = useMemo(() => makeChunkMat(true),  []);

  function applyGeometry(opaque: THREE.BufferGeometry | null, trans: THREE.BufferGeometry | null) {
    const om = opaqueRef.current;
    if (om.geometry) om.geometry.dispose();
    om.geometry = opaque ?? new THREE.BufferGeometry();
    om.visible = !!opaque;

    const tm = transRef.current;
    if (tm.geometry) tm.geometry.dispose();
    tm.geometry = trans ?? new THREE.BufferGeometry();
    tm.visible = !!trans;
  }

  useFrame(() => {
    const df = dayNight.factor;
    (opaqueMat.uniforms.uDayFactor as THREE.IUniform).value = df;
    (transMat.uniforms.uDayFactor  as THREE.IUniform).value = df;
  });

  useEffect(() => {
    const { opaque, trans } = buildChunkGeometry(cx, cz, world, lightMap, skyLightMap, blockLightMap);
    applyGeometry(opaque, trans);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirtyChunks.has(key)) return;
    const { opaque, trans } = buildChunkGeometry(cx, cz, world, lightMap, skyLightMap, blockLightMap);
    applyGeometry(opaque, trans);
    clearDirty(cx, cz);
  }, [dirtyChunks, key, cx, cz, world, lightMap, skyLightMap, blockLightMap, clearDirty]);

  return (
    <>
      <mesh ref={opaqueRef} matrixAutoUpdate={false} material={opaqueMat} />
      <mesh ref={transRef}  matrixAutoUpdate={false} material={transMat}  />
    </>
  );
}
