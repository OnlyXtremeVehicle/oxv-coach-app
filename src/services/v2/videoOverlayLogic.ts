/**
 * Logique pure — validation de l'alignement vidéo (offset tap-align).
 *
 * La table `video_overlays` ne stocke QUE des métadonnées d'alignement d'une
 * vidéo restée 100 % on-device : `offset_ms` (décalage image ↔ télémétrie, peut
 * être négatif) et `duration_ms` (optionnelle, strictement positive). Contrainte
 * miroir du CHECK SQL, validée ici avant tout I/O — sans réseau, testable seule.
 */

export interface OverlayOffsetInput {
  offsetMs: number;
  durationMs?: number | null;
}

export interface OverlayOffsetValidation {
  ok: boolean;
  error?: string;
}

/**
 * Valide un offset d'alignement. `offsetMs` doit être un entier (négatif permis :
 * l'image peut précéder le franchissement). `durationMs`, s'il est fourni, doit
 * être un entier strictement positif. Renvoie un message FR vouvoyé si invalide.
 */
export function validateOverlayOffset(input: OverlayOffsetInput): OverlayOffsetValidation {
  if (!Number.isInteger(input.offsetMs)) {
    return { ok: false, error: 'Le décalage doit être un nombre entier de millisecondes.' };
  }
  if (input.durationMs !== undefined && input.durationMs !== null) {
    if (!Number.isInteger(input.durationMs) || input.durationMs <= 0) {
      return {
        ok: false,
        error: 'La durée doit être un entier strictement positif (en millisecondes).',
      };
    }
  }
  return { ok: true };
}
