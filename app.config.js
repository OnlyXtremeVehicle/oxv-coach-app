// ============================================================================
// app.config.js — configuration Expo dynamique
// ============================================================================
//
// Ce fichier complète `app.json` (chargé automatiquement par Expo et passé ici
// via `config`).
//
// ----------------------------------------------------------------------------
// IL N'A PLUS RIEN À INJECTER — 17/08/2026
// ----------------------------------------------------------------------------
//
// Son unique rôle était d'injecter `GOOGLE_MAPS_ANDROID_KEY` dans la config
// Android sans jamais la commiter. La migration vers MapLibre a retiré
// `react-native-maps` : il n'y a plus de carte Google dans l'application, donc
// plus de clé à injecter. La variable n'avait d'ailleurs jamais été renseignée —
// les cartes Android étaient grises.
//
// Le fichier est CONSERVÉ plutôt que supprimé : Expo le prend en compte dès
// qu'il existe, et le rétablir plus tard demanderait de se souvenir qu'il a
// existé. Il documente ici pourquoi il ne fait rien.
//
// Le fond de carte se configure désormais par `EXPO_PUBLIC_TILES_URL`, une
// variable `EXPO_PUBLIC_*` lue directement à l'exécution : elle n'a pas besoin
// de passer par la configuration native, et donc pas besoin de ce fichier.
// ============================================================================

module.exports = ({ config }) => config;
