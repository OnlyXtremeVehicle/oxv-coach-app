/**
 * <CircuitTrace> — rendu 3D d'un circuit (clé de voûte, specs v4 §05).
 *
 * Port React Three Fiber (natif Expo, via expo-gl) du rendu de référence
 * `docs/specs-bundle-v4/circuit-tool/circuit-3d.html`. Premier incrément :
 * l'ALLURE (ruban coloré par courbure, ligne médiane or, grille, marqueurs de
 * virage, caméra orbitale). Les couches de données (régularité, apex, équilibre
 * châssis…) viendront brancher la prop `session` au sous-incrément suivant.
 *
 * Validation visuelle = manuelle sur build de dev (règle 9 : pas de device ici).
 * Géométrie fournie par `generateCircuit()` (déjà testée : 7 virages, ~2,2 km).
 */

/* eslint-disable react/no-unknown-property -- attach/args/object sont des props intrinsèques react-three-fiber */
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

import { curvature, type Circuit, type Point } from './circuitGenerator';

// Charte OXV (00_CLAUDE §3)
const NIGHT = 0x050505;
const HERITAGE = 0xc4a459;
const GREEN = new THREE.Color(0x4ade80);
const GOLD = new THREE.Color(0xffb703);
const RED = new THREE.Color(0xc8102e);

// Couleur par rayon local : vert (rapide) → or → rouge (serré). Bornes 15…200 m.
function radiusToColor(r: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (200 - r) / (200 - 15)));
  return t < 0.5 ? GREEN.clone().lerp(GOLD, t * 2) : GOLD.clone().lerp(RED, (t - 0.5) * 2);
}

// Rayon local le long du tracé (pour colorer le ruban segment par segment).
function localRadii(pts: Point[]): number[] {
  return curvature(pts).map((k) => (Math.abs(k) > 1e-4 ? Math.min(300, 1 / k) : 300));
}

interface SceneData {
  group: THREE.Group;
  extent: number;
}

// Construit la géométrie 3D (ruban + médiane + grille + marqueurs) centrée à l'origine.
function buildScene(circuit: Circuit): SceneData {
  const cl = circuit.centerline;
  const group = new THREE.Group();
  if (cl.length === 0) return { group, extent: 100 };

  let cx = 0;
  let cy = 0;
  for (const p of cl) {
    cx += p.x;
    cy += p.y;
  }
  cx /= cl.length;
  cy /= cl.length;
  let extent = 0;
  for (const p of cl) extent = Math.max(extent, Math.hypot(p.x - cx, p.y - cy));

  const radii = localRadii(cl);
  const Z = 0;

  // --- ruban (2 triangles par section, y/z permutés : piste à plat) ---
  const rib = circuit.ribbon;
  const N = rib.length;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < N; i++) {
    const L = rib[i].left;
    const R = rib[i].right;
    positions.push(L[0] - cx, Z, -(L[1] - cy));
    positions.push(R[0] - cx, Z, -(R[1] - cy));
    const col = radiusToColor(radii[i]);
    colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
  }
  const segs = circuit.closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const a = 2 * i;
    const b = 2 * i + 1;
    const c = 2 * ((i + 1) % N);
    const d = 2 * ((i + 1) % N) + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  group.add(
    new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
  );

  // --- ligne médiane or ---
  const linePts = cl.map((p) => new THREE.Vector3(p.x - cx, Z + 0.3, -(p.y - cy)));
  if (circuit.closed && linePts.length) linePts.push(linePts[0].clone());
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  group.add(
    new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: HERITAGE, transparent: true, opacity: 0.45 })
    )
  );

  // --- grille discrète ---
  const grid = new THREE.GridHelper(extent * 3, 30, 0x1a1a1a, 0x101010);
  grid.position.y = -0.5;
  group.add(grid);

  // --- marqueurs de virages (anneaux or, à plat) ---
  const ringGeo = new THREE.RingGeometry(2.5, 4, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: HERITAGE, side: THREE.DoubleSide });
  for (const corner of circuit.corners) {
    const p = cl[corner.apexIdx];
    if (!p) continue;
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(p.x - cx, Z + 0.4, -(p.y - cy));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
  }

  return { group, extent };
}

// Caméra orbitale lente (auto-rotation). Orbit tactile = sous-incrément ultérieur.
function Rig({ extent }: { extent: number }) {
  const theta = useRef(Math.PI * 0.25);
  const phi = Math.PI * 0.32;
  const dist = extent * 2.4;
  useFrame(({ camera }, delta) => {
    theta.current += delta * 0.12;
    camera.position.set(
      Math.sin(theta.current) * Math.cos(phi) * dist,
      Math.sin(phi) * dist,
      Math.cos(theta.current) * Math.cos(phi) * dist
    );
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export interface CircuitTraceProps {
  circuit: Circuit;
}

export function CircuitTrace({ circuit }: CircuitTraceProps) {
  const { group, extent } = useMemo(() => buildScene(circuit), [circuit]);
  return (
    <View style={styles.container}>
      <Canvas camera={{ fov: 50, near: 1, far: 5000, position: [0, extent, extent * 2] }}>
        <color attach="background" args={[NIGHT]} />
        <fog attach="fog" args={[NIGHT, extent * 2, extent * 6]} />
        <primitive object={group} />
        <Rig extent={extent} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
});
