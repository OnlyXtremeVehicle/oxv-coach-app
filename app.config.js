// ============================================================================
// app.config.js — configuration Expo dynamique
// ============================================================================
//
// Ce fichier complète `app.json` (chargé automatiquement par Expo et passé
// ici via `config`). Son unique rôle : injecter la clé Google Maps Android
// SANS jamais la commiter.
//
// iOS utilise Apple Maps (PROVIDER_DEFAULT) → aucune clé requise.
// Android requiert une clé "Maps SDK for Android", restreinte à l'app
// (package fr.oxvehicle.app + empreinte SHA-1 du keystore EAS).
//
// La clé est fournie au moment du build par la variable d'environnement
// GOOGLE_MAPS_ANDROID_KEY :
//   - en CI / build EAS : via un EAS secret
//       eas secret:create --scope project --name GOOGLE_MAPS_ANDROID_KEY \
//         --value <clé> --type string
//   - en local (prebuild) : via .env (gitignored)
//
// Si la variable est absente (ex. dev local sans carte), aucune clé n'est
// injectée — le reste de l'app fonctionne, seules les cartes Android
// resteront grises (fallback liste prévu en Expo Go de toute façon).
// ============================================================================

module.exports = ({ config }) => {
  const googleMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        ...(googleMapsKey ? { googleMaps: { apiKey: googleMapsKey } } : {}),
      },
    },
  };
};
