import {
  BELTOISE_CORNERS,
  cornersDuCircuit,
  estHauteSaintonge,
  getCornerDuCircuit,
} from '@/lib/circuitTopology';

/**
 * La topologie ne décrit qu'UN circuit : Haute Saintonge (tracé Beltoise).
 *
 * Appelée sans précaution sur une séance courue ailleurs, elle renvoyait un nom
 * de virage de Beltoise — « L'épingle Sud » sur un tour de Valence — et les
 * écrans coach peignaient sept pastilles sur un tracé qui n'était pas celui de
 * la séance. Ces tests verrouillent le refus.
 */
describe('topologie — conscience du circuit', () => {
  it('reconnaît le circuit dont nous avons la géométrie, quelle que soit l’écriture', () => {
    expect(estHauteSaintonge('Haute Saintonge')).toBe(true);
    expect(estHauteSaintonge('haute-saintonge')).toBe(true);
    expect(estHauteSaintonge('Circuit de Haute Saintonge')).toBe(true);
    expect(estHauteSaintonge('Beltoise')).toBe(true);
  });

  it('refuse tout autre circuit', () => {
    expect(estHauteSaintonge('Ricardo Tormo')).toBe(false);
    expect(estHauteSaintonge('Valencia')).toBe(false);
    expect(estHauteSaintonge('Charente')).toBe(false);
  });

  it('refuse un nom absent ou vide — fail-closed', () => {
    expect(estHauteSaintonge(null)).toBe(false);
    expect(estHauteSaintonge(undefined)).toBe(false);
    expect(estHauteSaintonge('')).toBe(false);
  });

  it('ne rend aucun virage pour un circuit inconnu', () => {
    expect(cornersDuCircuit('Valencia')).toEqual([]);
    expect(cornersDuCircuit(null)).toEqual([]);
    expect(getCornerDuCircuit(1, 'Valencia')).toBeNull();
    expect(getCornerDuCircuit(1, null)).toBeNull();
  });

  it('rend la topologie réelle sur le circuit qu’elle décrit', () => {
    expect(cornersDuCircuit('Haute Saintonge')).toHaveLength(BELTOISE_CORNERS.length);
    expect(getCornerDuCircuit(1, 'Haute Saintonge')?.index).toBe(1);
  });

  it('ne nomme pas un virage hors de la plage connue, même sur le bon circuit', () => {
    // Le schéma borne `corner_index` à 1..7 ; un circuit à 14 virages ne peut
    // pas être décrit ici, et on ne l'invente pas.
    expect(getCornerDuCircuit(12, 'Haute Saintonge')).toBeNull();
    expect(getCornerDuCircuit(0, 'Haute Saintonge')).toBeNull();
  });
});
