/**
 * RETIRE L'ENTITLEMENT « DOSSIERS DE SANTÉ » QUE NOUS NE DEMANDONS PAS.
 *
 * ---
 *
 * CE QUI EST ARRIVÉ
 *
 * Le build iOS n°33 (03/08/2026) a échoué au moment de signer :
 *
 *     Provisioning Profile ... does not support the HealthKit Access
 *     (Verifiable Health Records) capability.
 *
 * Or OXV ne lit AUCUN dossier de santé. Elle lit une fréquence cardiaque
 * enregistrée pendant un roulage — de la donnée HealthKit ordinaire — et
 * `app.json` déclare explicitement `isClinicalDataEnabled: false`.
 *
 * ---
 *
 * POURQUOI L'ENTITLEMENT ÉTAIT QUAND MÊME DEMANDÉ
 *
 * Lu dans la source du greffon (`node_modules/react-native-health/app.plugin.js`,
 * lignes 32-38) : il écrit **inconditionnellement**
 *
 *     config.modResults['com.apple.developer.healthkit.access'] = []
 *
 * puis n'ajoute `'health-records'` dans ce tableau QUE si l'option clinique est
 * vraie. Le drapeau commande donc le CONTENU du tableau, jamais sa PRÉSENCE.
 *
 * Et pour Apple, c'est la présence de la clé qui compte : un tableau vide
 * réclame « HealthKit Access (Verifiable Health Records) », une capacité qui
 * n'est pas en libre-service — elle doit être attribuée par Apple à l'équipe et
 * à l'identifiant de l'application.
 *
 * On demandait donc une autorisation exceptionnelle pour un usage qui n'existe
 * pas, et cela suffisait à bloquer la signature.
 *
 * ---
 *
 * CE QUE CE GREFFON FAIT
 *
 * Il supprime la clé si, et seulement si, elle est VIDE. Un tableau non vide
 * signifierait qu'on demande réellement l'accès clinique : dans ce cas on n'y
 * touche pas, et il faudra passer par Apple.
 *
 * ---
 *
 * IL DOIT ÊTRE DÉCLARÉ **AVANT** `react-native-health` DANS `app.json`
 *
 * C'est contre-intuitif, et quelqu'un finira par vouloir « corriger » l'ordre.
 * Les mods Expo s'exécutent dans l'ORDRE INVERSE de leur déclaration : chaque
 * `withEntitlementsPlist` enveloppe le précédent, donc le dernier déclaré tourne
 * en premier.
 *
 * Constaté, pas supposé : posé APRÈS `react-native-health`, ce greffon tournait
 * bien — un témoin écrit dans les entitlements ressortait — mais la clé
 * `.access` était présente quand même, réécrite ensuite. Placé AVANT, elle
 * disparaît. Vérifié via `npx expo config --type introspect --json`.
 *
 * Si un jour la clé réapparaît dans un build, c'est la première chose à
 * regarder.
 *
 * `com.apple.developer.healthkit` reste, lui : c'est la capacité HealthKit
 * ordinaire, celle dont la biométrie a besoin.
 */

const { withEntitlementsPlist } = require('expo/config-plugins');

const CLE = 'com.apple.developer.healthkit.access';

module.exports = function withoutHealthRecords(config) {
  return withEntitlementsPlist(config, (cfg) => {
    const valeur = cfg.modResults[CLE];

    // Un tableau VIDE ne demande rien d'utile et bloque la signature : on le
    // retire. Un tableau rempli est une demande délibérée — on la respecte.
    if (Array.isArray(valeur) && valeur.length === 0) {
      delete cfg.modResults[CLE];
    }

    return cfg;
  });
};
