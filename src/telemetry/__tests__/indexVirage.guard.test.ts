/**
 * GARDE — le numéro de virage est à base 1, d'un bout à l'autre.
 *
 * ---
 *
 * CE QUI A ÉTÉ FAILLI
 *
 * La chaîne est longue et silencieuse :
 *
 *   `BELTOISE_CORNERS[].index`        1..7
 *   → `hauteSaintonge.ts` : `order: corner.index`
 *   → `trackviz/analysis.ts` : `segmentIndex: segment.order`
 *   → `app_segment_analyses.segment_index`
 *   → `(coach)/annoter.tsx` : refuse tout `cornerIndex < 1`
 *
 * Rien dans ce trajet ne déclare sa base. L'ancre `?corner=` du lot J5 a été
 * écrite en annonçant « à zéro comme en base » et en acceptant 0 — le contrat
 * écrit contredisait le code, et un lien composé d'après lui aurait ouvert le
 * virage voisin. La table est vide en production : aucune donnée n'aurait
 * démenti le commentaire.
 *
 * Cette garde relie les deux extrémités de la chaîne pour que la base ne puisse
 * plus se perdre en route.
 *
 * ---
 *
 * CE QU'ELLE NE COUVRE PAS
 *
 * Les libellés. Plusieurs écrans affichent `V${segmentIndex + 1}`, ce qui donne
 * « V2 » pour le virage 1 — défaut ANTÉRIEUR au lot J5, consigné en dette. La
 * garde porte sur les identifiants qui voyagent, pas sur le texte affiché.
 */

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';

describe('garde — le numéro de virage part de 1', () => {
  it('la topologie du circuit numérote à partir de 1', () => {
    const indices = BELTOISE_CORNERS.map((c) => c.index).sort((a, b) => a - b);
    expect(indices[0]).toBe(1);
    // Contigus : un trou ferait qu'un `?corner=` valide n'ouvre rien.
    expect(indices).toEqual(indices.map((_, i) => i + 1));
  });

  it("les segments d'analyse reprennent EXACTEMENT ces numéros", () => {
    const ordres = HAUTE_SAINTONGE_SEGMENTS.map((s) => s.order).sort((a, b) => a - b);
    const indices = BELTOISE_CORNERS.map((c) => c.index).sort((a, b) => a - b);
    expect(ordres).toEqual(indices);
  });

  it('aucun segment ne porte le numéro 0', () => {
    // C'est LA valeur que l'ancien contrat de l'ancre acceptait.
    expect(HAUTE_SAINTONGE_SEGMENTS.some((s) => s.order === 0)).toBe(false);
  });
});
