/**
 * SYSTÈME D'IMAGES PARTAGÉ — la première pièce réelle de la « couche 2 ».
 *
 * ===========================================================================
 * POURQUOI CES TROIS FICHIERS ONT QUITTÉ `src/ui/v2/media/`
 * ===========================================================================
 *
 * R3 interdit d'importer le kit pilote (`src/ui/v2`) hors de `(app2)`, sauf la
 * couche 2. Deux surfaces de la console le faisaient pour un seul composant :
 *
 *   app/(admin)/sessions-media.tsx   Photo
 *   src/components/MediaGrid.tsx     Photo, monté par (pro)/media.tsx
 *
 * Le réflexe aurait été d'écrire un second `Photo` côté console. **C'est
 * exactement la maladie que ce dépôt porte déjà** : il existe deux `Fact.tsx`
 * divergents, 46 et 84 lignes, et personne ne sait lequel fait foi.
 *
 * La mesure a tranché autrement. `Photo` **ne porte aucun jeton visuel** — ni
 * couleur, ni espacement, ni typographie. C'est une enveloppe d'`expo-image`
 * qui décide d'une politique de placeholder et d'une clé de recyclage. Elle
 * n'appartient à aucun des deux univers ; elle était simplement rangée dans
 * l'un des deux.
 *
 * `blurhash.ts` et `mediaMath.ts` suivent pour la même raison : de la logique
 * pure, sans jeton. `HeroPhoto`, lui, RESTE dans le kit pilote — il importe
 * `colors, radius, space` de `../tokens`, et n'est monté que par `(app2)`. La
 * frontière passe là où la mesure la met, pas là où le dossier la range.
 *
 * ===========================================================================
 * CE QUE CE DÉPLACEMENT NE TRANCHE PAS
 * ===========================================================================
 *
 * `docs/specs/E_Systeme.md:25` nomme `src/ui/data/` comme couche 2 et
 * l'énumère : « radar, tracé Skia, chrono, états, barres, Fact, provenance,
 * confiance, rejeu ». **Ce dossier-là n'existe toujours pas**, et l'y créer
 * n'est pas un déménagement mais l'unification de deux kits divergents, un
 * arbitrage visuel par composant. Cette décision reste ouverte.
 *
 * Ce qui est fait ici est plus petit et vérifiable : un composant sans identité
 * visuelle, dont DEUX univers avaient besoin, cesse d'être rangé chez l'un
 * d'eux. La couche 2 se construit d'un besoin mesuré, pas d'une déclaration.
 *
 * ===========================================================================
 * UN RÉSIDU, ET IL EST NOMMÉ
 * ===========================================================================
 *
 * `TITANE_BLURHASH` — le placeholder de dernier recours — est encodé depuis un
 * dégradé `bg.base → bg.card2`, donc depuis les fonds du kit PILOTE. Sur un
 * écran de console, le fond n'est pas exactement celui-là.
 *
 * On le garde tel quel : les deux fonds sont sombres et froids, l'écart tient
 * en quelques valeurs de luminance, et il est vu deux cent vingt millisecondes
 * sur une image qui charge. Si cet écart devait un jour compter, la correction
 * est une prop de repli passée par l'appelant — pas un second blurhash.
 */

export { photoRecyclingKey, TITANE_BLURHASH } from './blurhash';
export {
  PARALLAX_BLEED,
  PARALLAX_FACTOR,
  parallaxTranslateY,
  PHOTO_FADE_MS,
  SCRIM_HEIGHT_RATIO,
  scrimGradientColors,
  scrimHeight,
  toTransparent,
} from './mediaMath';
export { Photo, type PhotoProps } from './Photo';
