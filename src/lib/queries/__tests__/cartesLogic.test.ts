/**
 * Lot PROFIL_CARTES — tests obligatoires (spec §7.3) sur la logique pure du
 * Panel de cartes : formatChronoCarte, référence personnelle, numérotation,
 * sélection. Aucune dépendance RN — jest ts-jest, env node.
 */

import {
  type CarteSession,
  appliquerFiltre,
  basculerSelection,
  circuitPrincipal,
  comparaisonPrete,
  construireFiltres,
  ecartReference,
  estReference,
  formatChronoCarte,
  formatDateCarte,
  formatEcartReference,
  formatNumeroCarte,
  numeroterCartes,
  referenceParCircuit,
} from '../cartesLogic';

function carte(partiel: Partial<CarteSession> & { id: string; startedAt: string }): CarteSession {
  return {
    bestLapSeconds: null,
    lapCount: null,
    weather: null,
    vehicleLabel: null,
    circuitKey: 'circuit-a',
    circuitLabel: 'Circuit de Haute Saintonge',
    trackSvgPath: null,
    airTempC: null,
    ...partiel,
  };
}

describe('formatChronoCarte — m:ss,mmm, virgule, minutes toujours affichées', () => {
  it('112.418 → "1:52,418"', () => {
    expect(formatChronoCarte(112.418)).toBe('1:52,418');
  });

  it('59.9 → "0:59,900" (minutes toujours affichées)', () => {
    expect(formatChronoCarte(59.9)).toBe('0:59,900');
  });

  it('null → "—"', () => {
    expect(formatChronoCarte(null)).toBe('—');
  });

  it('valeurs invalides → "—" (NaN, Infinity, négatif)', () => {
    expect(formatChronoCarte(Number.NaN)).toBe('—');
    expect(formatChronoCarte(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatChronoCarte(-1)).toBe('—');
  });

  it('bord de retenue : 119.9995 → "2:00,000", jamais "1:60,000"', () => {
    expect(formatChronoCarte(119.9995)).toBe('2:00,000');
  });

  /**
   * CE TEST DISAIT L'INVERSE JUSQU'AU 12/08/2026. Il verrouillait le point au
   * nom d'une « norme chronométrage » dont aucune source n'était citée, contre
   * un plan de montage qui impose la virgule sans ambiguïté. Le reste du
   * produit était déjà converti : cette fonction seule produisait deux
   * écritures du même chrono selon l'écran.
   */
  it('virgule française, comme partout ailleurs dans le produit', () => {
    expect(formatChronoCarte(84.318)).toBe('1:24,318');
    expect(formatChronoCarte(84.318)).not.toContain('.');
  });
});

describe('référence personnelle — min non nul, PAR CIRCUIT, stable avec NULL', () => {
  const cartes: CarteSession[] = [
    carte({ id: 's1', startedAt: '2027-04-22T10:00:00Z', bestLapSeconds: 114.226 }),
    carte({ id: 's2', startedAt: '2027-05-17T10:00:00Z', bestLapSeconds: 115.87 }),
    carte({ id: 's3', startedAt: '2027-06-14T10:00:00Z', bestLapSeconds: null }),
    carte({ id: 's4', startedAt: '2027-07-08T10:00:00Z', bestLapSeconds: 112.418 }),
  ];

  it('la référence est le min non nul', () => {
    const refs = referenceParCircuit(cartes);
    expect(refs['circuit-a']).toEqual({ id: 's4', seconds: 112.418 });
  });

  it('stable en présence de NULL : la session sans chrono est exclue du calcul', () => {
    const refs = referenceParCircuit(cartes);
    expect(estReference(cartes[2], refs)).toBe(false);
    expect(ecartReference(cartes[2], refs)).toBeNull();
  });

  it('écart = best - référence, masqué sur la carte de référence', () => {
    const refs = referenceParCircuit(cartes);
    expect(ecartReference(cartes[3], refs)).toBeNull(); // la référence elle-même
    expect(ecartReference(cartes[0], refs)).toBeCloseTo(1.808, 3);
    expect(formatEcartReference(1.808)).toBe('+1.808');
  });

  it('calculée PAR CIRCUIT : chaque circuit a sa propre référence', () => {
    const deuxCircuits: CarteSession[] = [
      ...cartes,
      carte({
        id: 'v1',
        startedAt: '2027-03-01T10:00:00Z',
        bestLapSeconds: 99.5,
        circuitKey: 'circuit-b',
      }),
      carte({
        id: 'v2',
        startedAt: '2027-03-02T10:00:00Z',
        bestLapSeconds: 98.2,
        circuitKey: 'circuit-b',
      }),
    ];
    const refs = referenceParCircuit(deuxCircuits);
    expect(refs['circuit-a'].id).toBe('s4');
    expect(refs['circuit-b']).toEqual({ id: 'v2', seconds: 98.2 });
  });

  it('recalculée par filtre : sur une liste filtrée, le min change', () => {
    const filtree = cartes.filter((c) => c.id !== 's4');
    const refs = referenceParCircuit(filtree);
    expect(refs['circuit-a']).toEqual({ id: 's1', seconds: 114.226 });
  });

  it('aucun chrono valide → aucune référence (jamais de valeur inventée)', () => {
    const sansChrono = [
      carte({ id: 'x', startedAt: '2027-01-01T10:00:00Z', bestLapSeconds: null }),
    ];
    expect(referenceParCircuit(sansChrono)).toEqual({});
  });
});

describe('numérotation — chronologique ascendante, indépendante de l’affichage', () => {
  const desordre: CarteSession[] = [
    carte({ id: 'recent', startedAt: '2027-07-08T10:00:00Z' }),
    carte({ id: 'ancien', startedAt: '2026-01-05T10:00:00Z' }),
    carte({ id: 'milieu', startedAt: '2026-11-20T10:00:00Z' }),
  ];

  it('001 = la plus ancienne, quel que soit l’ordre de la liste fournie', () => {
    const numeros = numeroterCartes(desordre);
    expect(numeros.ancien).toBe(1);
    expect(numeros.milieu).toBe(2);
    expect(numeros.recent).toBe(3);

    const inversee = [...desordre].reverse();
    expect(numeroterCartes(inversee)).toEqual(numeros);
  });

  it('zero-pad 3 digits, 4 digits à 1000+', () => {
    expect(formatNumeroCarte(24)).toBe('024');
    expect(formatNumeroCarte(1)).toBe('001');
    expect(formatNumeroCarte(1000)).toBe('1000');
  });
});

describe('sélection — max 2, désélection libre, Comparer actif à exactement 2', () => {
  it('impossible de sélectionner une 3e carte', () => {
    let sel: string[] = [];
    sel = basculerSelection(sel, 'a');
    sel = basculerSelection(sel, 'b');
    sel = basculerSelection(sel, 'c');
    expect(sel).toEqual(['a', 'b']);
  });

  it('désélection libre', () => {
    let sel = ['a', 'b'];
    sel = basculerSelection(sel, 'a');
    expect(sel).toEqual(['b']);
    sel = basculerSelection(sel, 'b');
    expect(sel).toEqual([]);
  });

  it('bouton Comparer inactif à ≠ 2, actif à exactement 2', () => {
    expect(comparaisonPrete([])).toBe(false);
    expect(comparaisonPrete(['a'])).toBe(false);
    expect(comparaisonPrete(['a', 'b'])).toBe(true);
  });
});

describe('filtres — valeurs réelles (années, météos, voitures)', () => {
  const cartes: CarteSession[] = [
    carte({
      id: 'a',
      startedAt: '2027-07-08T10:00:00Z',
      weather: 'Sec',
      vehicleLabel: '911 GT3',
    }),
    carte({
      id: 'b',
      startedAt: '2026-06-14T10:00:00Z',
      weather: 'Pluie',
      vehicleLabel: 'A110 R',
    }),
    carte({ id: 'c', startedAt: '2026-05-17T10:00:00Z', weather: 'Sec', vehicleLabel: null }),
  ];

  it('construit Toutes + années distinctes (desc) + météos + voitures', () => {
    const filtres = construireFiltres(cartes);
    expect(filtres[0]).toEqual({ type: 'toutes' });
    expect(filtres).toContainEqual({ type: 'annee', annee: 2027 });
    expect(filtres).toContainEqual({ type: 'annee', annee: 2026 });
    expect(filtres).toContainEqual({ type: 'meteo', valeur: 'Sec' });
    expect(filtres).toContainEqual({ type: 'meteo', valeur: 'Pluie' });
    expect(filtres).toContainEqual({ type: 'voiture', valeur: '911 GT3' });
    // Pas de doublon météo.
    expect(filtres.filter((f) => f.type === 'meteo')).toHaveLength(2);
  });

  it('applique année / météo / voiture sans muter la liste', () => {
    expect(appliquerFiltre(cartes, { type: 'annee', annee: 2026 }).map((c) => c.id)).toEqual([
      'b',
      'c',
    ]);
    expect(appliquerFiltre(cartes, { type: 'meteo', valeur: 'Sec' }).map((c) => c.id)).toEqual([
      'a',
      'c',
    ]);
    expect(appliquerFiltre(cartes, { type: 'voiture', valeur: 'A110 R' }).map((c) => c.id)).toEqual(
      ['b']
    );
    expect(cartes).toHaveLength(3);
  });
});

describe('formats annexes', () => {
  it('formatDateCarte : « Jeu. 08 Juil. 2027 » (fr, capitalisé)', () => {
    // 8 juillet 2027 = un jeudi (date locale à midi pour éviter les fuseaux).
    expect(formatDateCarte('2027-07-08T12:00:00')).toBe('Jeu. 08 Juil. 2027');
  });

  it('formatDateCarte : date illisible → "—"', () => {
    expect(formatDateCarte('pas-une-date')).toBe('—');
  });

  it('circuitPrincipal : le libellé le plus fréquent, null si aucun', () => {
    const cartes = [
      carte({ id: 'a', startedAt: '2027-01-01T10:00:00Z' }),
      carte({ id: 'b', startedAt: '2027-01-02T10:00:00Z' }),
      carte({ id: 'c', startedAt: '2027-01-03T10:00:00Z', circuitLabel: 'Valencia' }),
    ];
    expect(circuitPrincipal(cartes)).toBe('Circuit de Haute Saintonge');
    expect(circuitPrincipal([])).toBeNull();
  });
});
