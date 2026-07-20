"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * Denis's voice orb — a WebGL sphere with two diagonal energy ribbons
 * sweeping through a mostly-dark, hollow-reading interior, tuned against
 * a reference image (dark ground, orange rim + ribbons, not a solid glow).
 * Ported from a standalone prototype (energy-orb-demo) into a reusable,
 * appropriately-sized component instead of a full-viewport demo page.
 *
 * Purely decorative/ambient for now — see DenisVoiceOrbProps for the
 * `active` prop that will later drive real mic-amplitude reactivity
 * (per the founder's explicit requirement: the waveform/orb motion must
 * track actual speech loudness, not a canned animation). Not wired to
 * real audio yet — this is the visual foundation only.
 */

const orbVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform float uTime;
uniform float uLevel;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec3 p = position;
  float wave = sin((p.y * 7.0) + uTime * 1.5) * 0.018;
  p += normal * wave;
  // Real mic amplitude (0-1, smoothed) pushes the surface outward slightly —
  // the sphere visibly swells while someone is actually speaking.
  p += normal * uLevel * 0.05;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const orbFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
uniform float uTime;
uniform float uLevel;

float hash(vec3 p){
  p = fract(p * 0.3183099 + vec3(.1,.2,.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
                 mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                 mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0; i<5; i++){
    v += a * noise(p);
    p *= 2.05;
    a *= 0.52;
  }
  return v;
}

void main(){
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.2);

  vec3 p = normalize(vWorldPosition);

  float ang = uTime * 0.22;
  vec3 axis = normalize(vec3(0.35, 1.0, 0.25));
  vec3 rp = p * cos(ang) + cross(axis, p) * sin(ang) + axis * dot(axis, p) * (1.0 - cos(ang));

  float wobble1 = fbm(p * 1.6 + vec3(uTime * .10, uTime * .05, -uTime * .07)) - 0.5;
  float wobble2 = fbm(p * 1.9 + vec3(-uTime * .14, uTime * .11, uTime * .08)) - 0.5;

  // Louder = wider ribbons (more of the band lights up), not just brighter —
  // reads as the energy actually swelling with the voice, not a flat glow-up.
  float band = mix(0.965, 0.90, clamp(uLevel, 0.0, 1.0));

  float wave1 = sin((rp.x * 0.9 + rp.y * 1.7 + wobble1 * 0.9) * 2.3 + uTime * 0.3);
  float ribbon1 = smoothstep(band, 0.995, wave1);

  float wave2 = sin((rp.x * 1.6 - rp.y * 0.6 + rp.z * 0.8 + wobble2 * 0.9) * 2.0 - uTime * 0.25);
  float ribbon2 = smoothstep(band, 0.995, wave2);

  float lines = max(ribbon1, ribbon2 * 0.9);

  vec3 base = vec3(0.008, 0.003, 0.0);
  vec3 lineColor = vec3(1.0, 0.30, 0.02);

  vec3 color = base + lineColor * lines * (1.5 + uLevel * 0.8);
  color += vec3(1.0, 0.26, 0.02) * fresnel * (1.3 + uLevel * 0.6);

  float alpha = clamp(0.05 + lines * (0.85 + uLevel * 0.3) + fresnel * (0.5 + uLevel * 0.3), 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;

/** RMS of the analyser's current time-domain buffer, 0-1. Reused across every EnergyOrb frame — allocated once, not per call. */
function useAudioLevelReader(analyserRef?: React.RefObject<AnalyserNode | null>) {
  const bufferRef = useRef<Uint8Array | null>(null);
  const smoothedRef = useRef(0);

  return () => {
    const analyser = analyserRef?.current;
    if (!analyser) {
      smoothedRef.current *= 0.9;
      return smoothedRef.current;
    }

    if (!bufferRef.current || bufferRef.current.length !== analyser.fftSize) {
      bufferRef.current = new Uint8Array(analyser.fftSize);
    }
    const buffer = bufferRef.current as Uint8Array<ArrayBuffer>;
    analyser.getByteTimeDomainData(buffer);

    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = (buffer[i]! - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    // Mic noise floor sits well above 0 RMS even in silence — scale/clamp
    // so quiet-room level reads as ~0, normal speech reads as a real swell.
    const level = Math.min(1, Math.max(0, (rms - 0.02) * 6));

    // Fast attack, slower release — feels responsive to speech onset
    // without visibly flickering between words.
    smoothedRef.current +=
      (level - smoothedRef.current) * (level > smoothedRef.current ? 0.5 : 0.12);
    return smoothedRef.current;
  };
}

function EnergyOrb({
  analyserRef,
}: {
  analyserRef?: React.RefObject<AnalyserNode | null>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const readLevel = useAudioLevelReader(analyserRef);

  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = clock.elapsedTime;
    mat.current.uniforms.uLevel.value = readLevel();
  });

  return (
    <mesh>
      <sphereGeometry args={[1.55, 128, 128]} />
      <shaderMaterial
        ref={mat}
        vertexShader={orbVertex}
        fragmentShader={orbFragment}
        transparent
        blending={THREE.NormalBlending}
        depthWrite
        uniforms={{ uTime: { value: 0 }, uLevel: { value: 0 } }}
      />
    </mesh>
  );
}

function randomParticleLayout() {
  const count = 700;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 1.65 + Math.random() * 1.25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    sizes[i] = Math.random() * 0.018 + 0.004;
  }

  // Connection-line candidate list: a fixed subset of particle indices
  // (not all 700 — checking every pair would be 700^2 ≈ 490k distance
  // tests/frame) bucketed into a coarse spatial grid and sorted by cell,
  // so entries near each other in this array are also near each other in
  // space. The per-frame scan below then only compares each candidate to
  // the next few array neighbors — a cheap stand-in for a real neighbor
  // search that still finds mostly-real nearby pairs.
  const subsetStep = Math.ceil(count / 260); // ~260 candidates out of 700
  const cellSize = 0.5;
  const candidates: number[] = [];
  for (let i = 0; i < count; i += subsetStep) candidates.push(i);
  candidates.sort((a, b) => {
    const cellOf = (idx: number) => {
      const ix = Math.floor(positions[idx * 3]! / cellSize) + 20;
      const iy = Math.floor(positions[idx * 3 + 1]! / cellSize) + 20;
      const iz = Math.floor(positions[idx * 3 + 2]! / cellSize) + 20;
      return ix * 1600 + iy * 40 + iz;
    };
    return cellOf(a) - cellOf(b);
  });
  const connectSubset = new Int32Array(candidates);

  return { positions, sizes, connectSubset };
}

// How many trailing neighbors (in the spatially-sorted candidate list)
// each candidate particle is checked against per frame.
const CONNECT_WINDOW = 10;
// Hard cap on simultaneously-drawn lines — bounds the fixed-size buffer
// regardless of state so a burst of close particles can't blow past it.
const MAX_CONNECTIONS = 320;
// Distance thresholds particles must be within to connect: tighter/sparser
// at rest, wider/denser while Denis is actively speaking (uLevel → 1).
const CONNECT_DISTANCE_IDLE = 0.3;
const CONNECT_DISTANCE_ACTIVE = 0.62;
const connectionColor = new THREE.Color("#ff9a2e");

function ParticleField({
  analyserRef,
}: {
  analyserRef?: React.RefObject<AnalyserNode | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const lineGeometry = useRef<THREE.BufferGeometry>(null);
  // Lazy useState initializer — the correct home for impure one-time
  // computation (runs exactly once on mount, unlike useMemo which React
  // may discard/recompute and expects to stay pure; unlike a ref, it's
  // never touched during render after that).
  const [{ positions, sizes, connectSubset }] = useState(randomParticleLayout);
  const readLevel = useAudioLevelReader(analyserRef);

  // Fixed-size buffers sized for MAX_CONNECTIONS lines — allocated once,
  // partially filled each frame, never reallocated.
  const [{ linePositions, lineColors }] = useState(() => ({
    linePositions: new Float32Array(MAX_CONNECTIONS * 2 * 3),
    lineColors: new Float32Array(MAX_CONNECTIONS * 2 * 3),
  }));

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = clock.elapsedTime * 0.08;
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.2) * 0.08;
    }

    const geometry = lineGeometry.current;
    if (!geometry) return;

    const level = readLevel();
    const maxDistance =
      CONNECT_DISTANCE_IDLE + level * (CONNECT_DISTANCE_ACTIVE - CONNECT_DISTANCE_IDLE);
    const maxDistanceSq = maxDistance * maxDistance;

    let lineCount = 0;
    for (let a = 0; a < connectSubset.length && lineCount < MAX_CONNECTIONS; a++) {
      const ia = connectSubset[a]!;
      const ax = positions[ia * 3]!;
      const ay = positions[ia * 3 + 1]!;
      const az = positions[ia * 3 + 2]!;
      const window = Math.min(CONNECT_WINDOW, connectSubset.length - a - 1);
      for (let w = 1; w <= window && lineCount < MAX_CONNECTIONS; w++) {
        const ib = connectSubset[a + w]!;
        const bx = positions[ib * 3]!;
        const by = positions[ib * 3 + 1]!;
        const bz = positions[ib * 3 + 2]!;
        const dx = ax - bx;
        const dy = ay - by;
        const dz = az - bz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq >= maxDistanceSq) continue;

        // Closer pairs read brighter; the active state also lifts the
        // floor so connections stay visible even near the fade-out edge.
        const dist = Math.sqrt(distSq);
        const brightness = Math.min(1, (1 - dist / maxDistance) * 1.3 + level * 0.15);

        const vBase = lineCount * 6;
        linePositions[vBase] = ax;
        linePositions[vBase + 1] = ay;
        linePositions[vBase + 2] = az;
        linePositions[vBase + 3] = bx;
        linePositions[vBase + 4] = by;
        linePositions[vBase + 5] = bz;

        lineColors[vBase] = connectionColor.r * brightness;
        lineColors[vBase + 1] = connectionColor.g * brightness;
        lineColors[vBase + 2] = connectionColor.b * brightness;
        lineColors[vBase + 3] = connectionColor.r * brightness;
        lineColors[vBase + 4] = connectionColor.g * brightness;
        lineColors[vBase + 5] = connectionColor.b * brightness;

        lineCount++;
      }
    }

    // Collapse unused slots via draw range instead of reallocating or
    // zeroing the tail every frame.
    geometry.setDrawRange(0, lineCount * 2);
    const positionAttr = geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ff9a2e"
          size={0.022}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <lineSegments>
        <bufferGeometry ref={lineGeometry}>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[lineColors, 3]}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function SlowSpin({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = clock.elapsedTime * 0.05;
  });
  return <group ref={group}>{children}</group>;
}

function Scene({
  analyserRef,
}: {
  analyserRef?: React.RefObject<AnalyserNode | null>;
}) {
  return (
    <>
      <ambientLight intensity={0.15} />
      <SlowSpin>
        <EnergyOrb analyserRef={analyserRef} />
        <ParticleField analyserRef={analyserRef} />
      </SlowSpin>
      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette darkness={0.85} offset={0.25} />
      </EffectComposer>
    </>
  );
}

export type DenisVoiceOrbProps = {
  /** CSS pixel size — the canvas is always square. */
  size?: number;
  className?: string;
  /**
   * Live mic (or any other real-time) amplitude source — from
   * useMicAudioLevel() or an equivalent AnalyserNode. When omitted, the
   * orb just idles (no audio-reactive swell), still fully animated
   * otherwise. This is the ONLY supported way to make the orb react to
   * "speech loudness" — there is no fake/timer-driven pulse mode by
   * design, per the explicit requirement that motion must track real audio.
   */
  analyserRef?: React.RefObject<AnalyserNode | null>;
};

export function DenisVoiceOrb({ size = 160, className, analyserRef }: DenisVoiceOrbProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden" }}
    >
      <Canvas
        camera={{ position: [0, 0, 7.2], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene analyserRef={analyserRef} />
      </Canvas>
    </div>
  );
}
