/**
 * VERDICT DE PERMISSION BLUETOOTH — logique pure, testable sous node.
 *
 * ===========================================================================
 * POURQUOI CE MODULE EXISTE
 * ===========================================================================
 *
 * Le 03/08/2026, une chasse aux fautes de lancement a établi qu'**aucun RaceBox
 * ne pouvait être appairé sur iOS**, et que cela n'avait jamais fonctionné.
 *
 * La chaîne, vérifiée dans le paquet installé et non déduite :
 *
 *   1. `react-native-permissions` ne compile ses poignées iOS que si le Podfile
 *      contient `setup_permissions([...])`.
 *   2. Cette ligne n'est écrite que par le greffon de configuration du paquet.
 *   3. Le greffon n'était **pas déclaré** dans `app.json` — l'historique git
 *      montre qu'il ne l'a jamais été.
 *   4. `RNPermissions.podspec` ne compile que `ios/*.{h,mm}` ; la poignée vit
 *      dans `ios/Bluetooth/` et restait donc hors du binaire.
 *   5. `methods.ios.js` : `request()` rend `RESULTS.UNAVAILABLE` pour toute
 *      permission absente de la liste compilée.
 *   6. `requestBlePermissions()` traduisait ce `unavailable` en `granted:false`,
 *      et les trois écrans d'appairage refusaient alors d'appeler `startScan()`.
 *
 * Le greffon est désormais déclaré. Ce module traite la seconde moitié du
 * défaut, qui reste vraie indépendamment : **`unavailable` n'est pas un refus.**
 *
 * ===========================================================================
 * « JE NE SAIS PAS » N'EST PAS « NON »
 * ===========================================================================
 *
 * Ce dépôt échoue fermé partout, et c'est la bonne règle quand il s'agit de
 * MONTRER une donnée : dans le doute, on ne montre pas. Ici il ne s'agit pas de
 * montrer quoi que ce soit — il s'agit de TENTER une action dont iOS reste le
 * seul véritable gardien. CoreBluetooth demande l'autorisation lui-même au
 * premier scan, et refuse tout seul si le pilote a dit non.
 *
 * Échouer fermé sur `unavailable` ne protège donc personne : cela remplace le
 * dialogue du système par un message de refus que le pilote n'a jamais donné,
 * et rend le cœur du produit inerte. On laisse passer, et on laisse iOS
 * trancher.
 *
 * `denied` et `blocked`, eux, sont des réponses : on les respecte et on le dit.
 */

/** Les issues que `react-native-permissions` sait rendre. */
export type IssuePermission = 'unavailable' | 'denied' | 'blocked' | 'granted' | 'limited';

export interface VerdictPermission {
  /** Faut-il tenter le scan ? */
  granted: boolean;
  /** Ce qui manque, pour l'affichage. Vide si `granted`. */
  missing: string[];
  /**
   * Vrai quand on n'a pas pu savoir et qu'on laisse iOS trancher. L'appelant
   * peut s'en servir pour ne pas promettre au pilote que tout est en ordre.
   */
  indetermine: boolean;
}

/**
 * Verdict pour le Bluetooth sur iOS.
 *
 * `unavailable` laisse passer — voir l'en-tête. Toute issue inconnue est
 * traitée comme `unavailable` : une version future de la bibliothèque qui
 * ajouterait une issue ne doit pas tuer l'appairage.
 */
export function verdictBluetoothIos(issue: string): VerdictPermission {
  if (issue === 'granted' || issue === 'limited') {
    return { granted: true, missing: [], indetermine: false };
  }
  if (issue === 'denied' || issue === 'blocked') {
    return { granted: false, missing: ['Bluetooth'], indetermine: false };
  }
  return { granted: true, missing: [], indetermine: true };
}

/**
 * Verdict pour un jeu de permissions Android, où toutes sont requises.
 *
 * Android n'a pas le problème d'iOS — ses permissions ne dépendent d'aucune
 * poignée compilée séparément — donc la règle y reste stricte : ce qui n'est
 * pas accordé manque.
 */
export function verdictAndroid(resultats: Record<string, string>): VerdictPermission {
  const missing = Object.keys(resultats).filter((clef) => resultats[clef] !== 'granted');
  return { granted: missing.length === 0, missing, indetermine: false };
}
