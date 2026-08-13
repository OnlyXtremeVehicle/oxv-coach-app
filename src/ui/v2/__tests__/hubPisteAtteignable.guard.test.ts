/**
 * GARDE — le hub PISTE a des entrées VIVANTES.
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE EXISTE
 * ===========================================================================
 *
 * Une vérification adversariale a classé `/(app2)/rec` en CODE MORT : « plus
 * aucun écran n'y mène ». Le constat était juste dans ses effets et faux dans
 * sa cause, et la différence décide du sort de l'écran.
 *
 * Les entrées existaient — `decidePaddockAction` y renvoie, le bouton central y
 * mène pendant une capture. Ce qui manquait était en amont : `setSessions`
 * n'avait AUCUN appelant, `upcomingSessions` restait vide, la machine d'état ne
 * quittait jamais l'axe « compte + capture », et les états qui ouvrent ces
 * chemins n'étaient jamais atteints.
 *
 * Le hub n'était donc pas mort : il était **inatteignable**. Supprimer un écran
 * pour un maillon manquant en amont aurait effacé le seul endroit qui sait
 * REPRENDRE un jour J à l'étape où il en est.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FIGE
 * ===========================================================================
 *
 * Que la question « quelqu'un mène-t-il encore ici ? » ait une réponse
 * automatique, plutôt que d'attendre le prochain audit. Un écran de 260 lignes
 * qu'aucun chemin n'atteint est une dette qui se paie deux fois : en
 * maintenance, et en confiance quand on le découvre.
 */

import fs from 'fs';
import path from 'path';

const RACINE = path.join(__dirname, '..', '..', '..');
const ROUTE_HUB = "'/(app2)/rec'";

function lire(...morceaux: string[]): string {
  return fs.readFileSync(path.join(RACINE, ...morceaux), 'utf8');
}

describe('le hub PISTE est atteignable', () => {
  /**
   * PREMIÈRE ENTRÉE — l'action du Paddock. Elle y renvoie pour tout pilote qui
   * n'a pas encore de séance à relire, et pour les états hors flux.
   */
  it('decidePaddockAction y renvoie', () => {
    const src = lire('services', 'paddockHeroLogic.ts');
    expect(src).toContain(ROUTE_HUB);
  });

  /**
   * DEUXIÈME ENTRÉE — le bouton central, pendant une capture. C'est le chemin
   * de retour : « ramène à ce qui est en train de se passer ».
   */
  it('le bouton central y mène quand une capture tourne', () => {
    const src = lire('ui', 'v2', 'centralButtonLogic.ts');
    expect(src).toMatch(/mode === 'rec' \? '\/\(app2\)\/rec'/);
  });

  /** Et l'action du Paddock est réellement CONSOMMÉE par un écran. */
  it('l’écran d’accueil consomme cette action', () => {
    const src = lire('..', 'app', '(app2)', 'index.tsx');
    expect(src).toMatch(/decidePaddockAction\(/);
  });

  /**
   * LE MAILLON QUI MANQUAIT, ET SANS LEQUEL LES DEUX PREMIÈRES ENTRÉES SONT
   * INERTES.
   *
   * `setSessions` alimente `upcomingSessions`, d'où dépendent les états de
   * veille, de jour J et de retour de séance. Sans appelant, la machine restait
   * bloquée en amont et aucun de ces chemins ne s'ouvrait — ce qui faisait
   * passer un écran vivant pour du code mort.
   */
  it('setSessions a un appelant hors du store', () => {
    const init = lire('lib', 'initEtatPilote.ts');
    expect(init).toMatch(/\.setSessions\(/);
    // Et il est alimenté par une VRAIE lecture, pas par un tableau figé.
    expect(init).toMatch(/getMyNextTrackDay/);
  });

  /**
   * Le hub sait REPRENDRE un jour J à son étape. C'est sa raison d'être, et la
   * seule chose qui rendrait sa suppression coûteuse.
   */
  it('le hub redirige vers l’étape courante du flux', () => {
    const src = lire('..', 'app', '(app2)', 'rec', 'index.tsx');
    expect(src).toMatch(/Redirect/);
    expect(src).toMatch(/useCaptureStep|captureStep/);
  });
});
