/**
 * Blurhash V2 — placeholder générique titane + clé de recyclage.
 *
 * `TITANE_BLURHASH` est un blurhash 4×3 réellement encodé (algorithme
 * woltapp/blurhash) depuis un aplat vertical `bg.base` → `bg.card2` : quand
 * une photo n'a pas de blurhash stocké en base, le placeholder reste dans la
 * matière titane de la DA Instrument au lieu d'un gris système.
 */

/** Blurhash 4×3 d'un dégradé titane `bg.base` → `bg.card2` (moyenne sombre et froide). */
export const TITANE_BLURHASH = 'L03Ieht8fQt89DaxfQaxazfQfQfQ';

/**
 * Clé de recyclage stable pour expo-image / FlashList.
 *
 * - `id` fourni (id du média en base) : prime toujours, stable par nature.
 * - Sinon : l'URI privée de sa query string et de son fragment — les URLs
 *   signées Supabase changent de token à chaque rafraîchissement, la partie
 *   chemin, elle, identifie le média de façon stable.
 */
export function photoRecyclingKey(uri: string, id?: string): string {
  if (id !== undefined && id.length > 0) return id;
  const cut = uri.search(/[?#]/);
  return cut === -1 ? uri : uri.slice(0, cut);
}
