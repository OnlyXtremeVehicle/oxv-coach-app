/**
 * grammaireViz — la grammaire tient par construction, pas par vigilance.
 *
 * Le cas qui a tout déclenché : `Number.isFinite(0)` vaut `true`, donc la
 * garde « honnête-vide » d'AnatomieViz laissait passer « Freinage sur 0 m ».
 * Ici, le zéro mesuré et l'absence sont deux types — la confusion ne peut
 * plus s'écrire.
 */

import {
  ABSENT,
  couleurDelta,
  couleurMagnitude,
  couleurOrdre,
  depuisNullable,
  mesure,
  POLES_DELTA,
  RAMPE_MAGNITUDE,
  RAMPE_ORDRE,
} from '../grammaireViz';

describe('Mesure — un zéro mesuré est une donnée, une absence n’en est pas une', () => {
  it('0 est une mesure', () => {
    expect(depuisNullable(0)).toEqual({ mesuree: true, valeur: 0 });
  });
  it('null, undefined, NaN et Infinity sont absents', () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(depuisNullable(v as number | null)).toEqual(ABSENT);
    }
  });
  it('le discriminant force la branche avant la valeur', () => {
    const m = mesure(7);
    // Compile-time : `m.valeur` n'existe que si `m.mesuree` — vérifié ici au runtime.
    expect(m.mesuree && m.valeur).toBe(7);
  });
});

describe('couleurMagnitude — clair = fort, bornes serrées', () => {
  it('0 rend le pas le plus sombre, 1 le plus clair', () => {
    expect(couleurMagnitude(0)).toBe(RAMPE_MAGNITUDE[0]);
    expect(couleurMagnitude(1)).toBe(RAMPE_MAGNITUDE[RAMPE_MAGNITUDE.length - 1]);
  });
  it('hors bornes : serré, jamais inventé', () => {
    expect(couleurMagnitude(-3)).toBe(RAMPE_MAGNITUDE[0]);
    expect(couleurMagnitude(42)).toBe(RAMPE_MAGNITUDE[RAMPE_MAGNITUDE.length - 1]);
    expect(couleurMagnitude(NaN)).toBe(RAMPE_MAGNITUDE[0]);
  });
  it('même longueur que l’ancien speedHeat — les index [0..3] survivent', () => {
    expect(RAMPE_MAGNITUDE).toHaveLength(4);
  });
});

describe('couleurOrdre — au-delà de la rampe, on répète, on ne génère pas', () => {
  it('couvre premier / milieu / dernier', () => {
    expect(couleurOrdre(0)).toBe(RAMPE_ORDRE[0]);
    expect(couleurOrdre(2)).toBe(RAMPE_ORDRE[2]);
  });
  it('un 4e tour ne fabrique pas une 4e teinte', () => {
    expect(couleurOrdre(3)).toBe(RAMPE_ORDRE[2]);
  });
});

describe('couleurDelta — le zéro se lit « rien »', () => {
  it('positif = perd (chaud), négatif = reprend (froid)', () => {
    expect(couleurDelta(0.5)).toBe(POLES_DELTA.perd);
    expect(couleurDelta(-0.5)).toBe(POLES_DELTA.reprend);
  });
  it('zéro et bande morte rendent le neutre', () => {
    expect(couleurDelta(0)).toBe(POLES_DELTA.neutre);
    expect(couleurDelta(0.04, 0.05)).toBe(POLES_DELTA.neutre);
  });
  it('un écart non fini ne choisit pas un camp', () => {
    expect(couleurDelta(NaN)).toBe(POLES_DELTA.neutre);
  });
});

describe('le rouge de marque n’a aucun rôle dans la grammaire', () => {
  it('#C8102E n’apparaît dans aucune rampe ni aucun pôle', () => {
    const toutes = [...RAMPE_MAGNITUDE, ...RAMPE_ORDRE, ...Object.values(POLES_DELTA)];
    expect(toutes.map((c) => c.toUpperCase())).not.toContain('#C8102E');
  });
});
