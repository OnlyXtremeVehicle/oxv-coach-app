/**
 * `appMap` — ce qui reste à tester après le retrait de l'arbre V1.
 *
 * ---
 *
 * CE QUE CE FICHIER TESTAIT AVANT, ET POURQUOI IL NE LE TESTE PLUS
 *
 * Il vérifiait la cohérence de la table de navigation avec les routes réelles :
 * aucune entrée vers un écran absent, aucun écran sans entrée, chaque onglet
 * pointant vers une racine existante. Cette garde a bien fonctionné — elle est
 * tombée au premier lancement suivant l'archivage de `app/(app)`, en désignant
 * les cinquante et une entrées devenues creuses.
 *
 * La table a donc été retirée avec l'arbre qu'elle décrivait
 * (`archive/arbre-v1/`, tag `avant-suppression-arbre-v1`). Il ne reste qu'une
 * règle, et c'est une règle de DOCTRINE.
 *
 * ---
 *
 * LA SEULE CHOSE QUI COMPTE ENCORE ICI
 *
 * **Principe 3 — silence en piste.** Pendant que le véhicule roule, aucun écran,
 * aucune barre, aucune notification. C'est un principe non négociable du projet,
 * pas un détail d'affichage : il mérite un test qui survive à tous les arbres.
 */

import { shouldShowTabBar } from '../appMap';

describe('silence en piste — la barre s’efface pendant le roulage', () => {
  it('masque la barre dès que le pilote roule, quel que soit le chemin', () => {
    for (const chemin of ['/', '/(app2)', '/(app2)/data', '/(app2)/rec/roulage', '']) {
      expect(shouldShowTabBar(chemin, 'S6_roulage')).toBe(false);
    }
  });

  it('laisse la barre visible dans tous les autres états', () => {
    for (const etat of ['S1_repos', 'S5_pret', 'S7_fini', 'inconnu', '']) {
      expect(shouldShowTabBar('/(app2)', etat)).toBe(true);
    }
  });

  it("ne dépend plus du chemin — l'arbre V1 est archivé", () => {
    // Les sept segments du flux de capture V1 étaient reconnus ici. Ils ne
    // désignent plus rien : aucun ne doit encore masquer la barre par lui-même.
    // L'arbre V2 masque la sienne par `isV2CaptureFlowPath`, chez lui.
    for (const ancien of [
      '/equipement',
      '/placement',
      '/roulage',
      '/entre-runs',
      '/pilotage-fini',
      '/preservation',
      '/bilan-pret',
    ]) {
      expect(shouldShowTabBar(ancien, 'S1_repos')).toBe(true);
    }
  });
});
