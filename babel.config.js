/**
 * Le plugin de workletisation porte son nom CANONIQUE depuis Reanimated 4 :
 * `react-native-worklets/plugin`.
 *
 * L'ancien `react-native-reanimated/plugin` fonctionne encore en 4.1.7 — c'est
 * un relais de quatre lignes qui réexporte exactement le même objet, vérifié à
 * l'identité. Mais un relais de compatibilité n'est pas un contrat : le jour où
 * il disparaîtra, rien ne le dira. Les animations cesseraient simplement de
 * jouer, sans erreur de compilation ni message.
 *
 * Il doit rester le DERNIER plugin de la liste.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
