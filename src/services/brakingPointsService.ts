/**
 * Détection des points de freinage notables sur une trajectoire GPS.
 *
 * Complète le pilier §3.4 (carte de chaleur) : le cahier demande
 * « vitesse, trajectoires ET points de freinage projetés en couleurs ».
 *
 * Approche descriptive et factuelle : on repère les zones où la vitesse
 * chute fortement (freinage) et on marque le point de plus forte
 * décélération de chaque zone. Aucune interprétation — juste « ici, vous
 * avez ralenti franchement ».
 *
 * Logique PURE (pas de Supabase) → testable unitairement.
 *
 * ===========================================================================
 * ARMÉE LE 13/08/2026 — ELLE NE L'ÉTAIT PAS
 * ===========================================================================
 *
 * Ce module rendait exactement le `BrakingMarker` qu'attend
 * `BrakingPointsLayer`, lequel est monté dans `PilotPreset` derrière une garde
 * `brakingPoints && length > 0` — et **aucun appelant ne passait jamais cette
 * prop**. Un layer entier qui ne pouvait pas s'allumer, et un service dont le
 * seul importateur était son propre test.
 *
 * `DETTE.md` posait le choix : « l'armer, ou le retirer franchement ». Décision
 * fondateur du 13/08 : **le garder, et le rendre fiable.** Les deux moitiés
 * comptent — un layer allumé sur une détection fragile serait pire qu'un layer
 * éteint, parce qu'il affirmerait.
 */

import { SEUIL_FREINAGE_G } from '@/telemetry/braking';

export interface TrajPoint {
  lat: number;
  lon: number;
  speed?: number | null;
}

export interface BrakingPoint {
  lat: number;
  lon: number;
  /** Intensité 0..1 : chute de vitesse normalisée sur la zone. */
  intensity: number;
  /** Vitesse d'entrée de la zone de freinage (km/h). */
  entrySpeed: number;
  /** Vitesse de sortie de la zone (km/h). */
  exitSpeed: number;
}

/**
 * Détecte les points de freinage notables.
 *
 * @param points          trajectoire ordonnée chronologiquement
 * @param minDropKmh      chute de vitesse minimale pour qu'une zone compte (défaut 15)
 * @param minSeparationM  distance min entre 2 points de freinage retenus (défaut 30 m)
 */
export function detectBrakingPoints(
  points: TrajPoint[],
  minDropKmh = 15,
  minSeparationM = 30
): BrakingPoint[] {
  if (points.length < 3) return [];

  // 1. Repère les segments descendants continus (vitesse qui baisse).
  const zones: { startIdx: number; endIdx: number; drop: number }[] = [];
  let i = 0;
  while (i < points.length - 1) {
    const s0 = speedAt(points, i);
    if (s0 === null) {
      i += 1;
      continue;
    }
    // Étend tant que la vitesse décroît (tolérance d'1 km/h de bruit).
    let j = i;
    while (j < points.length - 1) {
      const a = speedAt(points, j);
      const b = speedAt(points, j + 1);
      if (a === null || b === null) break;
      if (b > a + 1) break; // remonte = fin de la zone de freinage
      j += 1;
    }
    const sStart = speedAt(points, i);
    const sEnd = speedAt(points, j);
    if (sStart !== null && sEnd !== null && j > i) {
      const drop = sStart - sEnd;
      /**
       * ===================================================================
       * UN LEVER DE PIED N'EST PAS UN FREINAGE
       * ===================================================================
       *
       * Cette zone n'était retenue que sur la CHUTE TOTALE de vitesse, sans
       * aucune notion de distance. Une voiture qui décélère de 120 à 100 en
       * levant le pied sur quatre cents mètres produisait exactement le même
       * signal qu'un freinage de 120 à 100 sur quarante.
       *
       * Sur l'écran de triage du coach, chaque marqueur est une affirmation
       * sur la conduite du pilote, et elle alimente un débrief. En poser un
       * là où il a seulement levé, c'est fabriquer un fait — ce que la
       * doctrine interdit d'abord.
       *
       * On dérive donc la décélération réelle, sans avoir besoin du temps :
       *
       *     a = (v₂² − v₁²) / (2 · d)
       *
       * et on la compare au seuil PARTAGÉ du dépôt, `SEUIL_FREINAGE_G`
       * (−0,3 g), celui-là même qu'emploie `detectBrakingZones`. Le frein
       * moteur d'une voiture de route tourne autour de −0,1 à −0,2 g : il ne
       * franchit pas cette barre, et c'est exactement ce qu'on veut.
       *
       * La chute minimale reste, en second critère : elle écarte les micro-
       * ajustements qui franchissent le seuil sur deux mètres.
       */
      const distanceM = distanceZoneM(points, i, j);
      const decelG = decelerationG(sStart, sEnd, distanceM);
      if (drop >= minDropKmh && decelG !== null && decelG <= SEUIL_FREINAGE_G) {
        zones.push({ startIdx: i, endIdx: j, drop });
      }
    }
    i = Math.max(j, i + 1);
  }

  if (zones.length === 0) return [];

  // 2. Pour chaque zone, le point de freinage = milieu géométrique de la
  //    zone (là où la décélération est la plus représentative).
  const maxDrop = Math.max(...zones.map((z) => z.drop));
  const raw: BrakingPoint[] = zones.map((z) => {
    const midIdx = Math.floor((z.startIdx + z.endIdx) / 2);
    const p = points[midIdx];
    return {
      lat: p.lat,
      lon: p.lon,
      intensity: maxDrop > 0 ? z.drop / maxDrop : 0,
      entrySpeed: speedAt(points, z.startIdx) ?? 0,
      exitSpeed: speedAt(points, z.endIdx) ?? 0,
    };
  });

  // 3. Déduplique les points trop proches (garde le plus intense).
  const kept: BrakingPoint[] = [];
  for (const bp of raw.sort((a, b) => b.intensity - a.intensity)) {
    const tooClose = kept.some((k) => haversineM(k, bp) < minSeparationM);
    if (!tooClose) kept.push(bp);
  }
  return kept;
}

function speedAt(points: TrajPoint[], idx: number): number | null {
  const s = points[idx]?.speed;
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
}

/** Longueur réellement parcourue entre deux indices, en mètres. */
function distanceZoneM(points: TrajPoint[], from: number, to: number): number {
  let d = 0;
  for (let k = from; k < to; k++) d += haversineM(points[k], points[k + 1]);
  return d;
}

/**
 * Décélération moyenne d'une zone, en g, depuis les seules vitesses et la
 * distance — sans horodatage.
 *
 *     v² = v₀² + 2·a·d   →   a = (v² − v₀²) / (2·d)
 *
 * Rend `null` quand la distance est trop courte pour que le quotient veuille
 * dire quelque chose : sur deux points collés, `2·d` tend vers zéro et
 * l'accélération vers l'infini. Cinq mètres est le plancher — à 100 km/h, c'est
 * moins d'un cinquième de seconde.
 *
 * **`null` n'est pas « pas de freinage »** : c'est « on ne sait pas ». L'appelant
 * écarte la zone, ce qui est le bon défaut sur une donnée qu'on affirmerait au
 * coach.
 */
function decelerationG(entryKmh: number, exitKmh: number, distanceM: number): number | null {
  if (!Number.isFinite(distanceM) || distanceM < 5) return null;
  const v0 = entryKmh / 3.6;
  const v1 = exitKmh / 3.6;
  const aMs2 = (v1 * v1 - v0 * v0) / (2 * distanceM);
  if (!Number.isFinite(aMs2)) return null;
  return aMs2 / 9.80665;
}

/** Distance approximative entre 2 points GPS, en mètres (Haversine). */
function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
