/**
 * Data Lab NG — couches de la carte du circuit (V9 §7 Data Lab).
 *
 * Décide quelles couches du tracé sont DISPONIBLES pour une séance, et laquelle
 * présenter par défaut. Logique PURE (sans réseau) → testable unitairement.
 *
 * Doctrine d'honnêteté : une couche sans matière n'est pas masquée en douce —
 * elle est présente mais désactivée, avec la raison factuelle (« à venir avec
 * les premières trames »). On ne colore jamais une donnée absente. Aucune
 * couche n'est un verdict : ce sont des angles de lecture, pas des notes.
 */

export type MapLayerKey = 'trace' | 'vitesse' | 'marges';

export interface MapLayer {
  key: MapLayerKey;
  label: string;
  hint: string;
  available: boolean;
  /** Raison factuelle d'indisponibilité (null si disponible). */
  unavailableReason: string | null;
}

export interface MapLayerInputs {
  /** La trajectoire GPS du pilote est-elle exploitable (≥ 2 points) ? */
  hasTrajectory: boolean;
  /** Ces points portent-ils une vitesse exploitable ? */
  hasSpeed: boolean;
  /** Des marges par virage ont-elles été calculées ? */
  hasMargins: boolean;
}

const WAITING_FRAMES = 'À venir avec les premières trames du boîtier.';
const WAITING_ANALYSIS = 'Disponible une fois la séance analysée.';

export function buildMapLayers(input: MapLayerInputs): MapLayer[] {
  return [
    {
      key: 'trace',
      label: 'Tracé',
      hint: 'Votre passage sur le circuit',
      // La géométrie du circuit se dessine toujours : la couche Tracé reste
      // honnête même sans trajectoire (forme du circuit seule).
      available: true,
      unavailableReason: null,
    },
    {
      key: 'vitesse',
      label: 'Vitesse',
      hint: 'Du plus posé au plus rapide',
      available: input.hasTrajectory && input.hasSpeed,
      unavailableReason: input.hasTrajectory && input.hasSpeed ? null : WAITING_FRAMES,
    },
    {
      key: 'marges',
      label: 'Marges',
      hint: 'Vos zones, virage par virage',
      available: input.hasMargins,
      unavailableReason: input.hasMargins ? null : WAITING_ANALYSIS,
    },
  ];
}

/** Couche par défaut : la plus riche disponible (marges → vitesse → tracé). */
export function defaultActiveLayer(layers: MapLayer[]): MapLayerKey {
  const order: MapLayerKey[] = ['marges', 'vitesse', 'trace'];
  for (const key of order) {
    if (layers.find((l) => l.key === key)?.available) return key;
  }
  return 'trace';
}
