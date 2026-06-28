/**
 * Logique PURE de l'agrégation Data Lab (§4.2) — sans réseau ni Supabase, donc
 * testable sous ts-jest. `dataLabService` assemble les données et délègue ici la
 * dérivation des couches activables + de l'état vide honnête.
 */

export type DataLabLayerKey = 'trajectory' | 'speed' | 'g' | 'regularity';

export interface DataLabLayer {
  key: DataLabLayerKey;
  label: string;
  available: boolean;
}

export interface DataLabAvailability {
  layers: DataLabLayer[];
  /** Message honnête si la session n'a pas (encore) de matière relisible, sinon null. */
  emptyReason: string | null;
}

const LAYER_LABELS: Record<DataLabLayerKey, string> = {
  trajectory: 'Trajectoire',
  speed: 'Vitesse',
  g: 'G latéral',
  regularity: 'Régularité',
};

/**
 * À partir des compteurs d'une session, dérive les couches activables et
 * l'éventuel état vide. La trace, la vitesse et le G viennent des frames ; la
 * régularité demande au moins 2 tours valides.
 */
export function deriveDataLabAvailability(input: {
  found: boolean;
  frameCount: number;
  validLapCount: number;
  cornerCount: number;
}): DataLabAvailability {
  const { found, frameCount, validLapCount, cornerCount } = input;
  const hasFrames = frameCount > 0;
  const layers: DataLabLayer[] = [
    { key: 'trajectory', label: LAYER_LABELS.trajectory, available: hasFrames || cornerCount > 0 },
    { key: 'speed', label: LAYER_LABELS.speed, available: hasFrames },
    { key: 'g', label: LAYER_LABELS.g, available: hasFrames },
    { key: 'regularity', label: LAYER_LABELS.regularity, available: validLapCount >= 2 },
  ];

  let emptyReason: string | null = null;
  if (!found) {
    emptyReason = 'Session introuvable.';
  } else if (frameCount === 0 && cornerCount === 0 && validLapCount === 0) {
    emptyReason = "Cette session n'a pas encore assez de matière pour être relue.";
  }

  return { layers, emptyReason };
}
