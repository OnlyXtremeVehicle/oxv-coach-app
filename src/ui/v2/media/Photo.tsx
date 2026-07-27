/**
 * Photo — wrapper expo-image du kit V2 (patron Airbnb : la photo est un
 * matériau de premier plan, jamais un décor).
 *
 * - Placeholder : blurhash stocké en base quand disponible, sinon
 *   `TITANE_BLURHASH` (aplat titane) — jamais de gris système.
 * - Transition : fondu `PHOTO_FADE_MS` (220 ms).
 * - `recyclingKey` : dérivée de l'URI si absente (stable malgré les tokens
 *   des URLs signées) — indispensable dans les listes FlashList.
 */

import { Image, type ImageContentFit } from 'expo-image';
import React from 'react';
import type { ImageStyle, StyleProp } from 'react-native';

import { photoRecyclingKey, TITANE_BLURHASH } from './blurhash';
import { PHOTO_FADE_MS } from './mediaMath';

export interface PhotoProps {
  uri: string;
  /**
   * ThumbHash du média, en base64 (lot T2). PRIORITAIRE sur le blurhash : il
   * porte le rapport d'aspect, ce que le blurhash ignore — un portrait cesse de
   * s'afficher dans un cadre de paysage le temps du chargement.
   */
  thumbhash?: string;
  blurhash?: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  accessibilityLabel?: string;
}

export function Photo({
  uri,
  thumbhash,
  blurhash,
  style,
  contentFit = 'cover',
  recyclingKey,
  accessibilityLabel,
}: PhotoProps): React.ReactElement {
  // Trois niveaux, du plus propre au plus générique. L'aplat titane reste le
  // dernier recours : il vaut mieux que le gris système, mais il est le même
  // pour toutes les images — c'est précisément ce que T2 corrige.
  const placeholder = thumbhash ? { thumbhash } : { blurhash: blurhash ?? TITANE_BLURHASH };

  return (
    <Image
      source={{ uri }}
      placeholder={placeholder}
      contentFit={contentFit}
      transition={PHOTO_FADE_MS}
      recyclingKey={recyclingKey ?? photoRecyclingKey(uri)}
      style={style}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
