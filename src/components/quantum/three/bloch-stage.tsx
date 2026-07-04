"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type BlochTarget = { x: number; y: number; z: number; accent: "q0" | "q1"; label?: string };

const COLORS = { q0: "#5FC9BF", q1: "#9D8CFF", muted: "#8A8F9C" };

/** Glowing state arrow that damps toward its target vector (length = purity). */
function StateArrow({ target, accent }: { target: THREE.Vector3; accent: string }) {
  const group = useRef<THREE.Group>(null);
  const current = useRef(new THREE.Vector3(0, 1, 0));
  const trail = useRef<THREE.Vector3[]>([]);
  const trailGeo = useRef<THREE.BufferGeometry>(null);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    current.current.lerp(target, Math.min(1, dt * 6));
    const len = Math.max(current.current.length(), 0.02);
    const dir = current.current.clone().normalize();
    g.setRotationFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    );
    g.scale.setScalar(len);
    // trail
    trail.current.push(current.current.clone());
    if (trail.current.length > 26) trail.current.shift();
    if (trailGeo.current) trailGeo.current.setFromPoints(trail.current);
  });

  return (
    <>
      <group ref={group}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.6} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <coneGeometry args={[0.055, 0.16, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.2} />
        </mesh>
      </group>
      {/* motion trail */}
      <line>
        <bufferGeometry ref={trailGeo} />
        <lineBasicMaterial color={accent} transparent opacity={0.35} />
      </line>
    </>
  );
}

function Sphere({ t, offsetX }: { t: BlochTarget; offsetX: number }) {
  const target = useMemo(() => new THREE.Vector3(t.x, t.z, t.y), [t.x, t.y, t.z]); // z-up → three y-up
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.12; // slow ambient rotation
  });
  const accent = COLORS[t.accent];
  return (
    <group position={[offsetX, 0, 0]}>
      <group ref={spin}>
        {/* wireframe shell */}
        <mesh>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color={COLORS.muted} wireframe transparent opacity={0.12} />
        </mesh>
        {/* equator ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.006, 8, 64]} />
          <meshBasicMaterial color={COLORS.muted} transparent opacity={0.5} />
        </mesh>
      </group>
      {/* poles */}
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={COLORS.q0} emissive={COLORS.q0} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, -1, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={COLORS.q1} emissive={COLORS.q1} emissiveIntensity={1.5} />
      </mesh>
      {/* axis */}
      <mesh>
        <cylinderGeometry args={[0.004, 0.004, 2, 6]} />
        <meshBasicMaterial color={COLORS.muted} transparent opacity={0.3} />
      </mesh>
      <StateArrow target={target} accent={accent} />
    </group>
  );
}

/**
 * The single WebGL context for /learn (ADR-0006): renders 1–2 Bloch spheres
 * with glowing damped state arrows, bloom, and slow ambient rotation.
 */
export default function BlochStage({
  targets,
  effects = true,
  height = 300,
}: {
  targets: BlochTarget[];
  effects?: boolean;
  height?: number;
}) {
  const spread = targets.length > 1 ? 1.35 : 0;
  return (
    <div style={{ height, touchAction: "pan-y" }} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.6, targets.length > 1 ? 4.4 : 3.1], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 4, 5]} intensity={40} color="#ffffff" />
        {targets.map((t, i) => (
          <Sphere key={i} t={t} offsetX={(i - (targets.length - 1) / 2) * 2 * spread} />
        ))}
        {effects && (
          <EffectComposer>
            <Bloom intensity={0.9} luminanceThreshold={0.35} mipmapBlur />
            <Vignette darkness={0.55} offset={0.3} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
