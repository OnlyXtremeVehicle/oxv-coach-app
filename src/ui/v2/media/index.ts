/**
 * Barrel local du système d'images V2 (`src/ui/v2/media/`).
 *
 * Il ne porte plus qu'`HeroPhoto` — le seul des quatre modules qui importe les
 * jetons du kit pilote (`colors, radius, space`) et qui appartienne donc
 * vraiment à cet univers.
 *
 * `Photo`, `blurhash` et `mediaMath` sont partis dans `src/components/media/`
 * le 05/09/2026 : aucun jeton, deux univers demandeurs. Ils ne sont PAS
 * réexportés ici — un barrel qui réexporte ce qu'il ne possède pas oblige à
 * deux sauts pour savoir qui partage quoi, et c'est précisément ce qu'une garde
 * de frontière doit pouvoir lire d'un seul.
 */

export { HeroPhoto, type HeroPhotoProps } from './HeroPhoto';
