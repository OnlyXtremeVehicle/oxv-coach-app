/**
 * L'arbitrage entre sources — explicite, motivé, et qui ne fusionne jamais.
 */

import {
  type FluxSource,
  arbitrerSources,
  departager,
  phraseArbitrage,
  regrouperParSource,
} from '../arbitrageSources';
import { SOURCE_CEINTURE, SOURCE_MONTRE } from '../sourcesBiometrie';

function flux(p: Partial<FluxSource> & Pick<FluxSource, 'id'>): FluxSource {
  return { nbMesures: 100, qualiteMoyenne: null, consentie: true, ...p };
}

describe('regroupement — chaque battement garde son origine', () => {
  it('sépare les lignes par source et moyenne les qualités connues', () => {
    const { flux: fs, inconnues } = regrouperParSource(
      [
        { source: 'polar_h10', quality: 80 },
        { source: 'polar_h10', quality: 60 },
        { source: 'apple_watch', quality: 90 },
      ],
      () => true
    );
    expect(inconnues).toEqual([]);
    const ceinture = fs.find((f) => f.id === 'ceinture_ble');
    const montre = fs.find((f) => f.id === 'montre_apple');
    expect(ceinture).toMatchObject({ nbMesures: 2, qualiteMoyenne: 70 });
    expect(montre).toMatchObject({ nbMesures: 1, qualiteMoyenne: 90 });
  });

  it('aucune qualité en base → null, jamais un 0 fabriqué', () => {
    const { flux: fs } = regrouperParSource(
      [
        { source: 'polar_h10', quality: null },
        { source: 'polar_h10', quality: null },
      ],
      () => true
    );
    expect(fs[0].qualiteMoyenne).toBeNull();
  });

  it('une source hors registre est RELEVÉE, pas versée dans une courbe', () => {
    const { flux: fs, inconnues } = regrouperParSource(
      [
        { source: 'garmin_hrm', quality: 90 },
        { source: 'polar_h10', quality: 50 },
      ],
      () => true
    );
    expect(inconnues).toEqual(['garmin_hrm']);
    expect(fs).toHaveLength(1);
    expect(fs[0].id).toBe('ceinture_ble');
  });
});

describe('éligibilité — écartée, mais jamais en silence', () => {
  it('une source non consentie est écartée POUR CELA', () => {
    const a = arbitrerSources([
      flux({ id: 'ceinture_ble', consentie: false }),
      flux({ id: 'montre_apple' }),
    ]);
    expect(a.retenue).toBe(SOURCE_MONTRE);
    expect(a.ecartees).toContainEqual({ id: 'ceinture_ble', motif: 'non_consentie' });
  });

  it('le motif « non consentie » prime sur « aucune mesure » — c’est celui qui concerne le pilote', () => {
    const a = arbitrerSources([flux({ id: 'ceinture_ble', consentie: false, nbMesures: 0 })]);
    expect(a.ecartees).toEqual([{ id: 'ceinture_ble', motif: 'non_consentie' }]);
  });

  it('aucun candidat → rien de retenu, rien d’inventé', () => {
    const a = arbitrerSources([flux({ id: 'montre_apple', nbMesures: 0 })]);
    expect(a.retenue).toBeNull();
    expect(a.motif).toBeNull();
    expect(a.ecartees).toEqual([{ id: 'montre_apple', motif: 'aucune_mesure' }]);
  });

  it('les clés hors registre sont reportées telles quelles', () => {
    const a = arbitrerSources([flux({ id: 'ceinture_ble' })], ['garmin_hrm']);
    expect(a.ecartees).toContainEqual({ id: 'garmin_hrm', motif: 'source_inconnue' });
  });
});

describe('les critères, dans l’ordre', () => {
  it('1 · cadence — la ceinture l’emporte sur la montre, et le motif le dit', () => {
    const a = arbitrerSources([flux({ id: 'montre_apple' }), flux({ id: 'ceinture_ble' })]);
    expect(a.retenue).toBe(SOURCE_CEINTURE);
    expect(a.motif).toBe('cadence_plus_fine');
    expect(a.ecartees).toEqual([{ id: 'montre_apple', motif: 'cadence_moins_fine' }]);
  });

  it('2 · qualité — à cadence égale, la qualité mesurée départage', () => {
    const duel = departager(
      { flux: flux({ id: 'ceinture_ble', qualiteMoyenne: 40 }), source: SOURCE_CEINTURE },
      {
        flux: flux({ id: 'montre_apple', qualiteMoyenne: 90 }),
        source: { ...SOURCE_MONTRE, cadenceNominaleHz: 1 },
      }
    );
    expect(duel).toEqual({
      gagnant: 'b',
      retenue: 'qualite_mesuree_superieure',
      ecart: 'qualite_mesuree_inferieure',
    });
  });

  it('UNE QUALITÉ INCONNUE NE PERD PAS — elle est incomparable, on passe au critère suivant', () => {
    const duel = departager(
      {
        flux: flux({ id: 'ceinture_ble', qualiteMoyenne: null, nbMesures: 500 }),
        source: SOURCE_CEINTURE,
      },
      {
        flux: flux({ id: 'montre_apple', qualiteMoyenne: 95, nbMesures: 10 }),
        source: { ...SOURCE_MONTRE, cadenceNominaleHz: 1 },
      }
    );
    // Si l'inconnu comptait pour 0, la montre gagnerait sur la qualité.
    expect(duel.retenue).toBe('plus_de_mesures');
    expect(duel.gagnant).toBe('a');
  });

  it('3 · nombre de mesures, à cadence et qualité égales', () => {
    const duel = departager(
      {
        flux: flux({ id: 'ceinture_ble', qualiteMoyenne: 70, nbMesures: 10 }),
        source: SOURCE_CEINTURE,
      },
      {
        flux: flux({ id: 'montre_apple', qualiteMoyenne: 70, nbMesures: 300 }),
        source: { ...SOURCE_MONTRE, cadenceNominaleHz: 1 },
      }
    );
    expect(duel).toEqual({ gagnant: 'b', retenue: 'plus_de_mesures', ecart: 'moins_de_mesures' });
  });

  it('4 · rien ne les sépare → l’ordre déclaré, DIT comme tel', () => {
    const duel = departager(
      {
        flux: flux({ id: 'ceinture_ble', qualiteMoyenne: 70, nbMesures: 100 }),
        source: SOURCE_CEINTURE,
      },
      {
        flux: flux({ id: 'montre_apple', qualiteMoyenne: 70, nbMesures: 100 }),
        source: { ...SOURCE_MONTRE, cadenceNominaleHz: 1 },
      }
    );
    expect(duel).toEqual({ gagnant: 'a', retenue: 'ordre_declare', ecart: 'ordre_declare' });
  });

  it('une source unique est retenue sans justification à produire', () => {
    const a = arbitrerSources([flux({ id: 'montre_apple' })]);
    expect(a.retenue).toBe(SOURCE_MONTRE);
    expect(a.motif).toBe('seule_source');
    expect(phraseArbitrage(a)).toBeNull();
  });
});

describe('ON NE FUSIONNE JAMAIS', () => {
  it('deux sources en lice → une seule retenue, l’autre nommée et écartée', () => {
    const a = arbitrerSources([flux({ id: 'ceinture_ble' }), flux({ id: 'montre_apple' })]);
    expect(a.retenue).not.toBeNull();
    expect(a.ecartees).toHaveLength(1);
    // La retenue n'apparaît jamais parmi les écartées : pas de moyenne, pas de mélange.
    expect(a.ecartees.map((e) => e.id)).not.toContain(a.retenue?.id);
  });

  it('le résultat est stable quel que soit l’ordre d’arrivée des flux', () => {
    const dansUnSens = arbitrerSources([
      flux({ id: 'ceinture_ble' }),
      flux({ id: 'montre_apple' }),
    ]);
    const dansLAutre = arbitrerSources([
      flux({ id: 'montre_apple' }),
      flux({ id: 'ceinture_ble' }),
    ]);
    expect(dansUnSens.retenue).toBe(dansLAutre.retenue);
    expect(dansUnSens.motif).toBe(dansLAutre.motif);
  });
});

describe('la phrase rendue — le motif est MONTRÉ, pas seulement calculé', () => {
  it('nomme la source retenue et la raison', () => {
    const a = arbitrerSources([flux({ id: 'ceinture_ble' }), flux({ id: 'montre_apple' })]);
    expect(phraseArbitrage(a)).toBe(
      'Deux sources ont mesuré cette séance. Lecture retenue : Ceinture cardio — cadence plus fine.'
    );
  });

  it('ne commente pas un écart qui n’est pas un duel perdu', () => {
    const a = arbitrerSources([
      flux({ id: 'ceinture_ble' }),
      flux({ id: 'montre_apple', consentie: false }),
    ]);
    expect(a.retenue).toBe(SOURCE_CEINTURE);
    expect(phraseArbitrage(a)).toBeNull();
  });

  it('aucune retenue → aucune phrase', () => {
    expect(phraseArbitrage({ retenue: null, motif: null, ecartees: [] })).toBeNull();
  });

  it('aucun verbe prescriptif, aucune « limite »', () => {
    const a = arbitrerSources([flux({ id: 'ceinture_ble' }), flux({ id: 'montre_apple' })]);
    expect(phraseArbitrage(a) as string).not.toMatch(
      /\b(freinez|accélérez|vous devriez|il faut|évitez|limite)\b/i
    );
  });
});
