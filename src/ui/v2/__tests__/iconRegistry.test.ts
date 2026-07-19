/**
 * Registre d'icônes OXV V2 — garanties du set (lot L0, livrable 3).
 *
 * Le registre est un module pur : ces tests verrouillent le contrat
 * (20 noms exacts, paths non vides, zéro couleur ou style dans les paths,
 * `rec` seule icône pleine) sans rendre de composant.
 */

import { OXV_FILLED_ICONS, OXV_ICON_NAMES, OXV_ICONS, OxvIconName } from '../icons/registry';

const NOMS_ATTENDUS: readonly OxvIconName[] = [
  'miroir',
  'data',
  'club',
  'vous',
  'rec',
  'chrono',
  'circuit',
  'casque',
  'gants',
  'drapeau-damier',
  'cle',
  'coeur',
  'montre',
  'ceinture',
  'camera',
  'convoi',
  'groupe',
  'insigne',
  'meteo-piste',
  'incident',
];

describe('registre iconographie OXV', () => {
  it('expose exactement les 20 noms attendus', () => {
    expect(OXV_ICON_NAMES).toHaveLength(20);
    expect([...OXV_ICON_NAMES].sort()).toEqual([...NOMS_ATTENDUS].sort());
    expect(Object.keys(OXV_ICONS).sort()).toEqual([...NOMS_ATTENDUS].sort());
  });

  it('chaque icône a au moins un path non vide', () => {
    for (const nom of OXV_ICON_NAMES) {
      const paths = OXV_ICONS[nom];
      expect(paths.length).toBeGreaterThanOrEqual(1);
      for (const d of paths) {
        expect(typeof d).toBe('string');
        expect(d.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('aucun path ne porte de couleur ni de style (le trait vient du composant)', () => {
    for (const nom of OXV_ICON_NAMES) {
      for (const d of OXV_ICONS[nom]) {
        expect(d).not.toMatch(/fill=/i);
        expect(d).not.toMatch(/stroke/i);
        expect(d).not.toContain('#');
      }
    }
  });

  it('chaque path est une géométrie SVG valide sur la grille 24', () => {
    // Uniquement des commandes de path et des nombres — rien d'autre.
    const grammaire = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]+$/;
    for (const nom of OXV_ICON_NAMES) {
      for (const d of OXV_ICONS[nom]) {
        expect(d).toMatch(grammaire);
        expect(d.trimStart().startsWith('M')).toBe(true);
        // Toutes les valeurs numériques restent dans la grille 0..24.
        const nombres = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
        expect(nombres.length).toBeGreaterThan(0);
        for (const n of nombres) {
          const v = Number(n);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it('rec est la seule icône pleine du set', () => {
    expect(OXV_FILLED_ICONS).toEqual(['rec']);
  });

  it('les noms du registre correspondent au type OxvIconName', () => {
    // Vérification statique : ces affectations ne compilent que si les
    // littéraux appartiennent bien au type.
    const exemple: OxvIconName = 'miroir';
    expect(OXV_ICON_NAMES).toContain(exemple);
    for (const nom of Object.keys(OXV_ICONS)) {
      expect(OXV_ICON_NAMES).toContain(nom as OxvIconName);
    }
  });
});
