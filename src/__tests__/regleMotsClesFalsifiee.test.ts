/**
 * FALSIFICATION — la règle des mots-clés attrape-t-elle vraiment une phrase ?
 *
 * ===========================================================================
 * POURQUOI CE FICHIER EXISTE
 * ===========================================================================
 *
 * `check-doctrine` rend « OK » à chaque exécution depuis qu'il a été écrit. Un
 * scanner qui dit toujours oui et un scanner cassé se ressemblent parfaitement,
 * et ce dépôt a déjà payé cette confusion : une garde de source dont le
 * résolveur ne résolvait rien, un état d'erreur que rien ne pouvait déclencher,
 * un champ de garde optionnel qu'aucun appelant ne passait.
 *
 * On plante donc des phrases, et on exige qu'elles soient vues.
 *
 * ===========================================================================
 * CE QU'ON PEUT FALSIFIER, ET CE QU'ON NE PEUT PAS
 * ===========================================================================
 *
 * Le script lui-même n'est pas importable : il appelle `main()` au chargement.
 * On ne peut donc pas le faire tourner sur un fichier fabriqué.
 *
 * Mais sa DÉCISION est composée de trois pièces, toutes importables : la
 * surface est-elle une feuille de données (`estFeuilleDeDonnees`), la chaîne
 * est-elle une phrase (`estPhrase`), et une exception la couvre-t-elle
 * (`estExcepte`). C'est cette composition qu'on falsifie ici — et c'est elle
 * qui décide, le script ne fait que la promener sur des fichiers.
 */

import { estExcepte } from '../../scripts/restitutionSansPhrase.exceptions';
import { estPhrase, estMotCle } from '@/lib/regleMotsCles';
import { estFeuilleDeDonnees, FEUILLES_DE_DONNEES } from '@/lib/surfacesRestitution';

/** L'écran du Mans qui porte le plus de lectures. */
const ECRAN = 'app/(app2)/data/session/[id].tsx';

describe('une phrase plantée sur une feuille de données est vue', () => {
  it('l’écran choisi EST bien une feuille de données', () => {
    expect(estFeuilleDeDonnees(ECRAN)).toBe(true);
    expect(FEUILLES_DE_DONNEES).toContain(ECRAN);
  });

  /**
   * Quatre phrases de facture différente, toutes plausibles sur cet écran. Si
   * l'une passait, c'est la définition du brief qui serait trop étroite — plus
   * de trois mots ET un mot outil — et il faudrait le dire, pas l'ignorer.
   */
  const PLANTEES = [
    'Votre meilleur tour est le troisième',
    'La marge se resserre dans les virages lents',
    'Regardez ce que la vitesse fait ici',
    'Cette séance porte moins de tours que la précédente',
  ];

  it.each(PLANTEES)('« %s » est reconnue comme une phrase', (texte) => {
    expect(estPhrase(texte)).toBe(true);
  });

  it.each(PLANTEES)('« %s » n’est couverte par AUCUNE exception', (texte) => {
    const ligne = `        <Text style={styles.x}>${texte}</Text>`;
    expect(estExcepte(ECRAN, ligne)).toBe(false);
  });

  it.each(PLANTEES)('« %s » n’est pas non plus un mot-clé', (texte) => {
    expect(estMotCle(texte)).toBe(false);
  });
});

/**
 * L'AUTRE MOITIÉ DE LA FALSIFICATION.
 *
 * Une garde qui attrape tout ne vaut pas mieux qu'une garde qui n'attrape rien :
 * elle se fait désarmer dans la semaine. Les trois rôles écartés doivent donc
 * l'être VRAIMENT, et pour la raison écrite — pas par accident de formulation.
 */
describe('les trois rôles hors règle le sont vraiment', () => {
  it('un libellé d’accessibilité passe — il s’entend, il ne s’affiche pas', () => {
    const ligne = '          accessibilityLabel="Comparer cette séance à une autre"';
    expect(estPhrase('Comparer cette séance à une autre')).toBe(true);
    expect(estExcepte(ECRAN, ligne)).toBe(true);
  });

  it('un état vide passe — la doctrine EXIGE qu’il nomme le champ manquant', () => {
    const ligne = '            emptyMessage="Aucun tour complet capté pour cette séance."';
    expect(estExcepte(ECRAN, ligne)).toBe(true);
  });

  it('une amorce de saisie passe — elle disparaît à la première frappe', () => {
    const ligne = '            placeholder="Ce que vous avez senti dans ce virage"';
    expect(estExcepte(ECRAN, ligne)).toBe(true);
  });

  /**
   * Et le verbatim humain, qui est l'exception la plus lourde de conséquence :
   * elle porte sur un FICHIER précis et un FRAGMENT précis. Servie trop large,
   * elle ouvrirait la porte à toute la prose de l'écran.
   */
  it('le verbatim du pilote passe sur le bilan, et NULLE PART ailleurs', () => {
    const ligne = '              <Text style={styles.x}>{intention.body}</Text>';
    expect(estExcepte('app/(app2)/bilan/[sessionId].tsx', ligne)).toBe(true);
    expect(estExcepte(ECRAN, ligne)).toBe(false);
  });
});
