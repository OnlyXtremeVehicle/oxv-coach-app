/**
 * LE MANIFESTE DES DEUX FAMILLES — et la vérification qu'il décrit le dépôt.
 *
 * Le brief cite ce manifeste depuis le 30/08/2026 ; il n'existait sous aucun
 * nom. Ce test tient les deux bouts : que les chemins déclarés correspondent à
 * des fichiers réels, et que ceux inscrits d'avance soient bien encore absents.
 * Un manifeste qui décrit un dépôt qu'il n'a plus ne vaut pas mieux que pas de
 * manifeste.
 */

import { existsSync } from 'fs';
import { join } from 'path';

import {
  FEUILLES_DE_DONNEES,
  FEUILLES_DE_DONNEES_ATTENDUES,
  FEUILLES_DE_RECIT,
  estFeuilleDeDonnees,
  estFeuilleDeRecit,
  estNonDeclaree,
  surfacesDeclarees,
} from '../surfacesRestitution';

const RACINE = process.cwd();

describe('le manifeste décrit le dépôt réel', () => {
  it('chaque feuille de données déclarée existe', () => {
    const absentes = FEUILLES_DE_DONNEES.filter((f) => !existsSync(join(RACINE, f)));
    expect(absentes).toEqual([]);
  });

  /**
   * L'INVERSE COMPTE AUTANT. Un chemin inscrit d'avance qui existe désormais
   * doit descendre dans la liste des feuilles en service — sinon la garde
   * continue de l'attendre au lieu de le contrôler.
   */
  it('les feuilles attendues sont bien encore absentes', () => {
    const apparues = FEUILLES_DE_DONNEES_ATTENDUES.filter((f) => existsSync(join(RACINE, f)));
    expect(apparues).toEqual([]);
  });

  it('aucun chemin n’est déclaré deux fois', () => {
    const tous = surfacesDeclarees();
    expect(new Set(tous.map((s) => s.toLowerCase())).size).toBe(tous.length);
  });

  it('aucune surface n’appartient aux deux familles', () => {
    for (const f of FEUILLES_DE_DONNEES) {
      expect(estFeuilleDeRecit(f)).toBe(false);
    }
    for (const f of FEUILLES_DE_RECIT) {
      expect(estFeuilleDeDonnees(f)).toBe(false);
    }
  });
});

describe('classement d’une surface', () => {
  it('une feuille de données est reconnue, quel que soit le séparateur', () => {
    expect(estFeuilleDeDonnees('app/(app2)/bilan/[sessionId].tsx')).toBe(true);
    expect(estFeuilleDeDonnees('app\\(app2)\\bilan\\[sessionId].tsx')).toBe(true);
    expect(estFeuilleDeDonnees('./app/(app2)/bilan/[sessionId].tsx')).toBe(true);
  });

  /**
   * Le défaut que ce dépôt a déjà payé une fois : la garde des modules
   * orphelins comparait `…\ui\v2/index.ts` à `…\ui\v2\index.ts` et rendait tous
   * les barils faussement orphelins. On normalise des deux côtés.
   */
  it('une feuille attendue est déjà soumise à la règle', () => {
    expect(estFeuilleDeDonnees('app/(app2)/rec/stand.tsx')).toBe(true);
  });

  /**
   * L'ABSENCE EST UNE VIOLATION. Deviner à quelle famille appartient un écran
   * neuf reviendrait à l'exempter en silence — et c'est ainsi que les phrases
   * reviennent sur les feuilles de données.
   */
  it('un écran non déclaré est une violation, pas une question ouverte', () => {
    expect(estNonDeclaree('app/(app2)/un-ecran-neuf.tsx')).toBe(true);
    expect(estNonDeclaree('app/(app2)/bilan/[sessionId].tsx')).toBe(false);
  });

  it('la casse ne fait pas échapper une surface à la règle', () => {
    expect(estFeuilleDeDonnees('APP/(APP2)/SIGNATURE.TSX')).toBe(true);
  });
});
