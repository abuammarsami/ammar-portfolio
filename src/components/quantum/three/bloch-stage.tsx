"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import * as THREE from "three";

export type BlochTarget = { x: number; y: number; z: number; accent: "q0" | "q1"; label?: string };
export type StageColors = { q0: string; q1: string; muted: string };

/** Physics (x,y,z) → three (x=x, y=z, z=y): the sim is z-up, the scene is y-up. */
const toScene = (t: { x: number; y: number; z: number }) => new THREE.Vector3(t.x, t.z, t.y);

const DEFAULT_COLORS: StageColors = { q0: "#5FC9BF", q1: "#9D8CFF", muted: "#8A8F9C" };

/** Glowing state arrow that damps toward its target vector (length = purity). */
function StateArrow({
  target,
  accent,
  grabbable,
  onGrab,
}: {
  target: THREE.Vector3;
  accent: string;
  grabbable?: boolean;
  onGrab?: () => void;
}) {
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

  const setCursor = (c: string) => {
    if (typeof document !== "undefined") document.body.style.cursor = c;
  };

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
        {/* grab handle at the tip — the affordance that says "drag me" */}
        {grabbable && (
          <mesh
            position={[0, 1.05, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              setCursor("grabbing");
              onGrab?.();
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setCursor("grab");
            }}
            onPointerOut={() => setCursor("auto")}
          >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.1} transparent opacity={0.85} />
          </mesh>
        )}
      </group>
      {/* motion trail */}
      <line>
        <bufferGeometry ref={trailGeo} />
        <lineBasicMaterial color={accent} transparent opacity={0.35} />
      </line>
    </>
  );
}

/**
 * Pointer-drag → (θ, φ). While `dragging`, raycast the cursor onto the unit
 * sphere (falling back to the ray's closest approach past the silhouette so the
 * drag stays smooth), invert the z-up↔y-up mapping, and report the angles up.
 */
function ArrowDrag({
  dragging,
  onDrag,
  onEnd,
}: {
  dragging: boolean;
  onDrag: (theta: number, phi: number) => void;
  onEnd: () => void;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1);
    const hit = new THREE.Vector3();
    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      const p = ray.ray.intersectSphere(sphere, hit) ?? ray.ray.closestPointToPoint(sphere.center, hit);
      const dir = p.clone().normalize();
      // scene (x, y=z, z=y) → physics: θ = acos(z_phys)=acos(y_scene), φ = atan2(y_phys,x_phys)=atan2(z_scene,x_scene)
      const theta = Math.acos(Math.max(-1, Math.min(1, dir.y)));
      let phi = Math.atan2(dir.z, dir.x);
      if (phi < 0) phi += 2 * Math.PI;
      onDrag(theta, phi);
    };
    const end = () => {
      if (typeof document !== "undefined") document.body.style.cursor = "auto";
      onEnd();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging, camera, gl, onDrag, onEnd]);
  return null;
}

function Sphere({
  t,
  offsetX,
  palette,
  ambient,
  grabbable,
  onGrab,
}: {
  t: BlochTarget;
  offsetX: number;
  palette: StageColors;
  ambient: boolean;
  grabbable?: boolean;
  onGrab?: () => void;
}) {
  const target = useMemo(() => toScene(t), [t]);
  const spin = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ambient && spin.current) spin.current.rotation.y += dt * 0.12; // slow ambient rotation
  });
  const accent = palette[t.accent];
  return (
    <group position={[offsetX, 0, 0]}>
      <group ref={spin}>
        {/* wireframe shell */}
        <mesh>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color={palette.muted} wireframe transparent opacity={0.12} />
        </mesh>
        {/* equator ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.006, 8, 64]} />
          <meshBasicMaterial color={palette.muted} transparent opacity={0.5} />
        </mesh>
      </group>
      {/* poles */}
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={palette.q0} emissive={palette.q0} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, -1, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={palette.q1} emissive={palette.q1} emissiveIntensity={1.5} />
      </mesh>
      {/* axis */}
      <mesh>
        <cylinderGeometry args={[0.004, 0.004, 2, 6]} />
        <meshBasicMaterial color={palette.muted} transparent opacity={0.3} />
      </mesh>
      <StateArrow target={target} accent={accent} grabbable={grabbable} onGrab={onGrab} />
    </group>
  );
}

/**
 * The single WebGL context for /learn (ADR-0006): renders 1–2 Bloch spheres
 * with glowing damped state arrows, bloom, and slow ambient rotation. When
 * `interactive` (desktop only, ADR-0017) the camera orbits on drag and — for a
 * single qubit with `onDrag` — the state arrow is draggable to set θ/φ.
 */
export default function BlochStage({
  targets,
  effects = true,
  height = 300,
  colors,
  interactive = false,
  onDrag,
}: {
  targets: BlochTarget[];
  effects?: boolean;
  height?: number;
  colors?: StageColors;
  interactive?: boolean;
  onDrag?: (theta: number, phi: number) => void;
}) {
  const palette = colors ?? DEFAULT_COLORS; // theme-aware palette from CSS tokens (P7)
  const spread = targets.length > 1 ? 1.35 : 0;
  const draggableArrow = interactive && targets.length === 1 && !!onDrag;
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const [dragging, setDragging] = useState(false);

  // stable identities so ArrowDrag's window-listener effect only re-subscribes
  // when `dragging` flips — not on every θ/φ update mid-drag
  const startDrag = useCallback(() => {
    if (controls.current) controls.current.enabled = false; // let go of the camera while placing the arrow
    setDragging(true);
  }, []);
  const endDrag = useCallback(() => {
    if (controls.current) controls.current.enabled = true;
    setDragging(false);
  }, []);

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
          <Sphere
            key={i}
            t={t}
            offsetX={(i - (targets.length - 1) / 2) * 2 * spread}
            palette={palette}
            ambient={!interactive}
            grabbable={draggableArrow}
            onGrab={draggableArrow ? startDrag : undefined}
          />
        ))}
        {draggableArrow && onDrag && <ArrowDrag dragging={dragging} onDrag={onDrag} onEnd={endDrag} />}
        {interactive && (
          <OrbitControls
            ref={controls}
            enablePan={false}
            enableZoom={false}
            enableDamping
            dampingFactor={0.12}
            rotateSpeed={0.8}
            autoRotate={!dragging}
            autoRotateSpeed={0.5}
          />
        )}
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
