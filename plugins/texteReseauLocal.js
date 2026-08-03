/**
 * REMPLACE LE TEXTE DE L'AUTORISATION « RÉSEAU LOCAL ».
 *
 * ---
 *
 * CE QUI ÉTAIT LIVRÉ
 *
 * `expo-dev-client` pose sa propre chaîne dans l'Info.plist :
 *
 *     « Expo Dev Launcher uses the local network to discover and connect to
 *       development servers running on your computer. »
 *
 * Elle part dans CHAQUE build, y compris ceux destinés aux pilotes. Un pilote
 * français à qui iOS demande l'accès au réseau local pour « se connecter à des
 * serveurs de développement » ne comprend rien, et l'anglais dans une
 * application par ailleurs entièrement en français se remarque.
 *
 * Relevé le 03/08/2026, en inspectant les entitlements et l'Info.plist calculés
 * avant de relancer un build.
 *
 * ---
 *
 * POURQUOI PAS SIMPLEMENT `ios.infoPlist` DANS app.json
 *
 * Parce que les greffons écrivent APRÈS la configuration statique et écrasent
 * la valeur. Il faut donc un greffon, et il doit tourner en DERNIER.
 *
 * ---
 *
 * IL DOIT ÊTRE DÉCLARÉ **EN TÊTE** DE `plugins` DANS `app.json`
 *
 * Les mods Expo s'exécutent dans l'ORDRE INVERSE de leur déclaration : chaque
 * `withInfoPlist` enveloppe le précédent, donc le premier déclaré tourne en
 * dernier. Même règle que `withoutHealthRecords.js`, et pour la même raison.
 *
 * Constaté, pas supposé : `expo config --type introspect --json` montre le
 * texte final.
 */

const { withInfoPlist } = require('expo/config-plugins');

const CLE = 'NSLocalNetworkUsageDescription';

const TEXTE =
  "OXV cherche votre boîtier et les appareils OXV sur le réseau local du circuit. Rien n'est " +
  'envoyé à personne, et cette autorisation ne sert jamais en dehors du circuit.';

module.exports = function texteReseauLocal(config) {
  return withInfoPlist(config, (cfg) => {
    // On ne pose le texte QUE si la clé existe déjà : si un jour
    // `expo-dev-client` disparaît, l'application ne doit pas se mettre à
    // réclamer une autorisation dont elle n'a plus l'usage.
    if (CLE in cfg.modResults) {
      cfg.modResults[CLE] = TEXTE;
    }
    return cfg;
  });
};
