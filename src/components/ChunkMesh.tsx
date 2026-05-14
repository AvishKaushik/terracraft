import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '../stores/worldStore';
import { buildChunkAsync } from '../lib/mesherPool';
import type { RawMesh } from '../lib/mesher';
import { atlasTexture } from '../lib/atlas';
import { dayNight } from '../lib/dayNight';

interface Props { cx: number; cz: number; }

const vertexShader = /* glsl */`
  attribute vec3 color;
  attribute float aSkyLight;
  attribute float aIsWaterTop;
  uniform float uTime;
  varying vec3 vColor;
  varying float vSkyLight;
  varying vec2 vUv;
  varying float vIsWaterTop;

  void main() {
    vColor       = color;
    vSkyLight    = aSkyLight;
    vUv          = uv;
    vIsWaterTop  = aIsWaterTop;

    vec3 pos = position;
    if (aIsWaterTop > 0.5) {
      pos.y -= 0.125;
      pos.y += sin(uTime * 1.4 + position.x * 1.1 + position.z * 0.9) * 0.045
             + sin(uTime * 0.8 - position.x * 0.7 + position.z * 1.2) * 0.025;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform float uDayFactor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vSkyLight;
  varying vec2 vUv;
  varying float vIsWaterTop;

  void main() {
    vec2 uvFinal = vUv;
    if (vIsWaterTop > 0.5) {
      uvFinal.x += sin(uTime * 0.6 + vUv.y * 8.0) * 0.002;
      uvFinal.y += sin(uTime * 0.5 + vUv.x * 8.0) * 0.002;
    }
    vec4 tex = texture2D(map, uvFinal);
    if (tex.a < 0.1) discard;
    float brightness = max(vColor.r, vSkyLight * uDayFactor);
    gl_FragColor = vec4(tex.rgb * brightness, tex.a);
  }
`;

function makeChunkMat(transparent: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map:        { value: atlasTexture },
      uDayFactor: { value: 1.0 },
      uTime:      { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
    transparent,
    alphaTest: transparent ? 0.1 : 0,
    depthWrite: true,
    fog: false,
  });
}

function rawToGeometry(raw: RawMesh): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position',    new THREE.BufferAttribute(raw.positions, 3));
  geom.setAttribute('normal',      new THREE.BufferAttribute(raw.normals, 3));
  geom.setAttribute('uv',          new THREE.BufferAttribute(raw.uvs, 2));
  geom.setAttribute('color',       new THREE.BufferAttribute(raw.colors, 3));
  geom.setAttribute('aSkyLight',   new THREE.BufferAttribute(raw.skyLights, 1));
  geom.setAttribute('aIsWaterTop', new THREE.BufferAttribute(raw.waterTops, 1));
  geom.setIndex(new THREE.BufferAttribute(raw.indices, 1));
  return geom;
}

export function ChunkMesh({ cx, cz }: Props) {
  const opaqueRef = useRef<THREE.Mesh>(null!);
  const transRef  = useRef<THREE.Mesh>(null!);
  const key       = `${cx},${cz}`;
  const genRef    = useRef(0); // generation counter — discard stale results

  const world         = useWorldStore(s => s.world);
  const skyLightMap   = useWorldStore(s => s.skyLightMap);
  const blockLightMap = useWorldStore(s => s.blockLightMap);
  const clearDirty    = useWorldStore(s => s.clearDirty);

  const opaqueMat = useMemo(() => makeChunkMat(false), []);
  const transMat  = useMemo(() => makeChunkMat(true),  []);

  // Stable apply function via ref so subscribe callback never holds a stale closure
  const applyRef = useRef<(o: RawMesh | null, t: RawMesh | null) => void>(null!);
  applyRef.current = (opaque, trans) => {
    const om = opaqueRef.current;
    if (om.geometry) om.geometry.dispose();
    om.geometry = opaque ? rawToGeometry(opaque) : new THREE.BufferGeometry();
    om.visible  = !!opaque;
    const tm = transRef.current;
    if (tm.geometry) tm.geometry.dispose();
    tm.geometry = trans ? rawToGeometry(trans) : new THREE.BufferGeometry();
    tm.visible  = !!trans;
  };

  useFrame((_s, dt) => {
    const df = dayNight.factor;
    (opaqueMat.uniforms.uDayFactor as THREE.IUniform).value = df;
    (transMat.uniforms.uDayFactor  as THREE.IUniform).value = df;
    (transMat.uniforms.uTime       as THREE.IUniform).value += dt;
  });

  // Initial build
  useEffect(() => {
    const gen = ++genRef.current;
    buildChunkAsync(cx, cz, world, skyLightMap, blockLightMap).then(({ opaque, trans }) => {
      if (genRef.current === gen) applyRef.current(opaque, trans);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe imperatively — avoids re-rendering ALL visible chunks on every block break
  useEffect(() => {
    let prevDirty: Set<string> | null = null;
    return useWorldStore.subscribe((state) => {
      const dirty = state.dirtyChunks;
      if (dirty === prevDirty || !dirty.has(key)) { prevDirty = dirty; return; }
      prevDirty = dirty;
      clearDirty(cx, cz);
      const gen = ++genRef.current;
      buildChunkAsync(cx, cz, world, skyLightMap, blockLightMap).then(({ opaque, trans }) => {
        if (genRef.current === gen) applyRef.current(opaque, trans);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <mesh ref={opaqueRef} matrixAutoUpdate={false} material={opaqueMat} />
      <mesh ref={transRef}  matrixAutoUpdate={false} material={transMat}  />
    </>
  );
}
