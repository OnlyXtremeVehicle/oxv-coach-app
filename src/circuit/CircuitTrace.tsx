/**
 * <CircuitTrace> — rendu 3D d'un circuit + couches de lecture (clé de voûte, specs v4 §05).
 *
 * Port React Three Fiber (natif Expo, via expo-gl) du rendu de référence
 * `docs/specs-bundle-v4/circuit-tool/circuit-3d.html`, enrichi des COUCHES :
 * un sélecteur (chips) recolore le tracé virage par virage selon la donnée
 * `session_insights` (Régularité, Vitesse d'apex, Équilibre châssis, Transfert
 * de charge). Couche « Tracé » = coloriage géométrique (courbure), sans donnée.
 *
 * Doctrine Mirror : montrer OÙ (couleur = support de lecture), jamais dire QUOI
 * faire. Sections hors virage ou donnée absente → acier neutre (ne pas inventer).
 * Validation visuelle = manuelle sur build de dev (règle 9).
 */

/* eslint-disable react/no-unknown-property -- attach/args/object sont des props intrinsèques react-three-fiber */
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';

import { curvature, type Circuit, type Point } from './circuitGenerator';
import {
  LAYERS,
  PILOT_LAYERS,
  colorByCorner,
  sectionCornerMap,
  type LayerId,
  type RGB,
} from './layers';
import type { SessionInsights } from './sessionInsights';

const NIGHT = 0x050505;
const HERITAGE = 0xc4a459;
const STEEL: RGB = { r: 0x5c / 255, g: 0x5c / 255, b: 0x66 / 255 };

// Coloriage géométrique (couche « Tracé ») : vert (rapide) → or → rouge (serré).
const GREEN = new THREE.Color(0x4ade80);
const GOLD = new THREE.Color(0xffb703);
const RED = new THREE.Color(0xc8102e);
function radiusToColor(r: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (200 - r) / (200 - 15)));
  return t < 0.5 ? GREEN.clone().lerp(GOLD, t * 2) : GOLD.clone().lerp(RED, (t - 0.5) * 2);
}
function localRadii(pts: Point[]): number[] {
  return curvature(pts).map((k) => (Math.abs(k) > 1e-4 ? Math.min(300, 1 / k) : 300));
}
function rgbToThree(c: RGB): THREE.Color {
  return new THREE.Color(c.r, c.g, c.b);
}

interface SceneData {
  group: THREE.Group;
  extent: number;
}

// Construit la géométrie centrée à l'origine, ruban coloré par `colors` (1 par section).
function buildScene(circuit: Circuit, colors: THREE.Color[]): SceneData {
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

  const Z = 0;
  const rib = circuit.ribbon;
  const N = rib.length;
  const positions: number[] = [];
  const cols: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < N; i++) {
    const L = rib[i].left;
    const R = rib[i].right;
    positions.push(L[0] - cx, Z, -(L[1] - cy));
    positions.push(R[0] - cx, Z, -(R[1] - cy));
    const col = colors[i] ?? GOLD;
    cols.push(col.r, col.g, col.b, col.r, col.g, col.b);
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
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  group.add(
    new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))
  );

  const linePts = cl.map((p) => new THREE.Vector3(p.x - cx, Z + 0.3, -(p.y - cy)));
  if (circuit.closed && linePts.length) linePts.push(linePts[0].clone());
  const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
  group.add(
    new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: HERITAGE, transparent: true, opacity: 0.45 })
    )
  );

  const grid = new THREE.GridHelper(extent * 3, 30, 0x1a1a1a, 0x101010);
  grid.position.y = -0.5;
  group.add(grid);

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
  /** Insights de la session ; null → seule la couche « Tracé » (géométrie) est disponible. */
  session?: SessionInsights | null;
  /** Couches proposées dans le sélecteur (par défaut, les couches pilote). */
  layers?: LayerId[];
  role?: 'pilot' | 'coach';
}

export function CircuitTrace({
  circuit,
  session = null,
  layers = PILOT_LAYERS,
  role = 'pilot',
}: CircuitTraceProps) {
  const selectable = layers.filter(
    (id) =>
      (role === 'coach' || LAYERS[id].role === 'pilot') &&
      (id === 'geometry' || LAYERS[id].available(session))
  );
  const [active, setActive] = useState<LayerId>(() =>
    selectable.includes('regularity') ? 'regularity' : (selectable[0] ?? 'geometry')
  );
  const current: LayerId = selectable.includes(active)
    ? active
    : selectable.includes('regularity')
      ? 'regularity'
      : 'geometry';

  const coloring = useMemo(
    () =>
      current === 'geometry' || !session
        ? null
        : colorByCorner(current, session, circuit.corners.length),
    [current, session, circuit]
  );

  const colors = useMemo(() => {
    const N = circuit.ribbon.length;
    if (!coloring) {
      const radii = localRadii(circuit.centerline);
      return Array.from({ length: N }, (_, i) => radiusToColor(radii[i]));
    }
    const map = sectionCornerMap(circuit);
    const steel = rgbToThree(STEEL).multiplyScalar(0.5);
    return Array.from({ length: N }, (_, i) => {
      const cidx = map[i];
      const rgb = cidx ? coloring.byCorner[cidx - 1] : null;
      return rgb ? rgbToThree(rgb) : steel.clone();
    });
  }, [circuit, coloring]);

  const { group, extent } = useMemo(() => buildScene(circuit, colors), [circuit, colors]);
  const layer = LAYERS[current];

  return (
    <View style={styles.container}>
      <Canvas camera={{ fov: 50, near: 1, far: 5000, position: [0, extent, extent * 2] }}>
        <color attach="background" args={[NIGHT]} />
        <fog attach="fog" args={[NIGHT, extent * 2, extent * 6]} />
        <primitive object={group} />
        <Rig extent={extent} />
      </Canvas>

      {current !== 'geometry' && coloring && (
        <View style={styles.legend} pointerEvents="none">
          <Text style={styles.legendLabel}>{layer.label.toUpperCase()}</Text>
          {coloring.min !== null && coloring.max !== null && (
            <Text style={styles.legendRange}>
              {coloring.min} – {coloring.max} {layer.unit}
            </Text>
          )}
        </View>
      )}

      <View style={styles.chips}>
        {selectable.map((id) => {
          const on = id === current;
          return (
            <Pressable
              key={id}
              onPress={() => setActive(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{LAYERS[id].label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  chips: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(18,18,18,0.7)',
  },
  chipOn: { borderColor: '#FFB703', backgroundColor: 'rgba(255,183,3,0.12)' },
  chipText: { color: '#A1A1AA', fontSize: 12, letterSpacing: 0.5 },
  chipTextOn: { color: '#F8F9FA' },
  legend: { position: 'absolute', top: 24, right: 24, alignItems: 'flex-end' },
  legendLabel: { color: '#A1A1AA', fontSize: 11, letterSpacing: 2 },
  legendRange: { color: '#F8F9FA', fontSize: 13, marginTop: 4 },
});
