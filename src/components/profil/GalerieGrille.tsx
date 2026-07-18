// DIVERGENCE_SCHEMA: la galerie du profil = les médias de PROFIL réels de
// `users.media` (TABLEAU de PilotMediaItem, service pilotMediaService, signed
// URLs) — PAS un objet { cover_url, gallery } comme l'esquissait la spec.
/**
 * Galerie — grille 3 colonnes (référence profil.html, bloc .galerie) :
 * cellules carrées, gap 6, bordure ligne, rayon 3. Photos via URL signée ;
 * une vidéo ou une signature échouée affiche une cellule sobre étiquetée.
 * Dernière cellule « + » (bordure pointillée) = ajout réel via le service.
 */

import { Image, Text, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/motion';
import type { PilotMediaView } from '@/services/pilotMediaService';
import { lotProfilTokens as t } from '@/theme/v2';

export interface GalerieGrilleProps {
  medias: PilotMediaView[];
  /** Cellule « + » affichée si fourni ; appelée à l'appui. */
  onAjouter?: () => void;
  /** Désactive la cellule « + » pendant un envoi. */
  ajoutEnCours?: boolean;
}

const MARGE_ECRAN = 40; // 20 px de chaque côté (référence)
const GAP = 6;

export function GalerieGrille({ medias, onAjouter, ajoutEnCours }: GalerieGrilleProps) {
  const { width } = useWindowDimensions();
  const cellule = Math.floor((width - MARGE_ECRAN - 2 * GAP) / 3);

  return (
    <View style={s.grille}>
      {medias.map((m) => (
        <View key={m.id} style={[s.photo, { width: cellule, height: cellule }]}>
          {m.type === 'photo' && m.signedUrl ? (
            <Image
              source={{ uri: m.signedUrl }}
              style={{ width: cellule - 2, height: cellule - 2, borderRadius: 2 }}
              resizeMode="cover"
              accessibilityLabel="Photo de votre galerie"
            />
          ) : (
            <Text style={s.etiquette}>{m.type === 'video' ? 'Vidéo' : 'Photo'}</Text>
          )}
        </View>
      ))}
      {onAjouter ? (
        <PressableScale
          onPress={onAjouter}
          disabled={ajoutEnCours}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une photo à votre galerie"
          pressedOpacity={0.7}
          style={[
            s.photo,
            s.ajout,
            { width: cellule, height: cellule, opacity: ajoutEnCours ? 0.5 : 1 },
          ]}
        >
          <Text style={s.plus}>+</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const s = {
  grille: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: GAP,
  },
  photo: {
    backgroundColor: t.surface2,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  etiquette: {
    fontFamily: t.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: t.grisSombre,
  },
  ajout: {
    borderStyle: 'dashed' as const,
  },
  plus: {
    fontFamily: t.fonts.corps,
    fontSize: 20,
    color: t.gris,
  },
};
