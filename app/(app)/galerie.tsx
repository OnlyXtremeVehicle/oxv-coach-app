/**
 * Galerie séance — reskin refonte-v2 §7bis (35-galerie).
 *
 * TOUS vos médias OXV, toutes séances confondues (service sessionMediaService,
 * table session_media + storage RLS). Lecture seule : les médias sont déposés
 * par OXV après la journée. Le langage graphique refonte-v2 fait loi —
 * mosaïque « une grande + vignettes », surfaces card/card2, hairlines line,
 * eyebrow JetBrains Mono. Or réservé au chrono : ici aucune donnée chrono, donc
 * pas d'or. La visionneuse plein écran (lightbox) est celle de MediaGrid,
 * réutilisée telle quelle.
 *
 * Crédit partenaire (maquette : « PixTrack · déposé par l'organisateur ») :
 * non affiché. La table session_media ne porte pas de crédit partenaire réel
 * lisible côté pilote (uploader = admin OXV via RLS, rôle non résolvable ici).
 * Doctrine « données réelles » : on n'invente pas de crédit. Cf.
 * sharedChangesNeeded si le client veut un vrai crédit d'origine.
 *
 * Vouvoiement, pas d'emoji, descriptif. EmptyState digne si aucune photo.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { MediaModal } from '@/components/MediaGrid';
import { type SessionMediaItem, listAllPilotMedia } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PADDING = theme.spacing.lg; // 16 — padding écran
const GUTTER = theme.spacing.md; // 12 — gap grille (§5 : 10–12)
const CONTENT_WIDTH = SCREEN_WIDTH - 2 * H_PADDING;
const THUMB_SIZE = (CONTENT_WIDTH - GUTTER) / 2; // 2 colonnes de vignettes

export default function GalerieScreen() {
  const [media, setMedia] = useState<SessionMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionMediaItem | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listAllPilotMedia().then((items) => {
      if (!cancelled) {
        setMedia(items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  // Décompte réel (trace vers media.length) : photos / vidéos séparées pour un
  // eyebrow factuel. Pas de circuit ni de date : la galerie fusionne TOUTES les
  // séances, aucune valeur unique ne serait honnête.
  const countLabel = useMemo(() => buildCountLabel(media), [media]);

  const [hero, ...rest] = media;

  return (
    <Screen>
      <AppBar title="Galerie" onBack={() => router.back()} />
      <View style={s.body}>
        <Text style={s.eyebrow} accessibilityRole="text">
          {countLabel}
        </Text>

        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator
              color={theme.palette.creamMute}
              accessibilityLabel="Chargement de vos souvenirs"
            />
          </View>
        ) : media.length === 0 ? (
          <View style={s.emptyWrap}>
            <EmptyState
              label="Aucun souvenir"
              message="Vos photos et vidéos de roulage apparaîtront ici. Elles sont déposées par OXV après chaque journée sur circuit."
              source="session_media"
            />
          </View>
        ) : (
          <View style={s.mosaic}>
            <HeroTile item={hero} index={0} onPress={() => setSelected(hero)} />
            {rest.length > 0 ? (
              <View style={s.grid}>
                {rest.map((item, i) => (
                  <ThumbTile
                    key={item.id}
                    item={item}
                    index={i + 1}
                    onPress={() => setSelected(item)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Lightbox partagée : le lecteur plein écran de MediaGrid, réutilisé. */}
      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

/** Eyebrow factuel : décompte réel photos/vidéos (§5 : mono uppercase ls 1.6+). */
function buildCountLabel(items: SessionMediaItem[]): string {
  const photos = items.filter((m) => m.mediaType === 'photo').length;
  const videos = items.filter((m) => m.mediaType === 'video').length;
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} ${photos > 1 ? 'photos' : 'photo'}`);
  if (videos > 0) parts.push(`${videos} ${videos > 1 ? 'vidéos' : 'vidéo'}`);
  const tail = parts.length > 0 ? parts.join(' · ') : 'aucun média';
  return `Vos souvenirs · ${tail}`;
}

/** Tuile héros — une grande image en haut de la mosaïque. */
function HeroTile({
  item,
  index,
  onPress,
}: {
  item: SessionMediaItem;
  index: number;
  onPress: () => void;
}) {
  return (
    <MediaTileBase
      item={item}
      index={index}
      onPress={onPress}
      width={CONTENT_WIDTH}
      height={Math.round(CONTENT_WIDTH * 0.52)}
      captionVisible
    />
  );
}

/** Vignette — image carrée dans la grille 2 colonnes. */
function ThumbTile({
  item,
  index,
  onPress,
}: {
  item: SessionMediaItem;
  index: number;
  onPress: () => void;
}) {
  return (
    <MediaTileBase
      item={item}
      index={index}
      onPress={onPress}
      width={THUMB_SIZE}
      height={THUMB_SIZE}
    />
  );
}

/**
 * Base commune héros/vignette : image signée réelle, badge « Vidéo » discret,
 * légende réelle en surimpression (héros uniquement), fallback « — » si l'URL
 * signée manque (storage object absent). Bordure d'accent 2px en haut, neutre
 * (crème faible) — le pilote reste neutre (§5, jamais l'or ni le rôle).
 */
function MediaTileBase({
  item,
  index,
  onPress,
  width,
  height,
  captionVisible = false,
}: {
  item: SessionMediaItem;
  index: number;
  onPress: () => void;
  width: number;
  height: number;
  captionVisible?: boolean;
}) {
  const kind = item.mediaType === 'video' ? 'Vidéo' : 'Photo';
  const a11y = item.caption ? `${kind} ${index + 1} : ${item.caption}` : `${kind} ${index + 1}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [s.tile, { width, height, opacity: pressed ? 0.82 : 1 }]}
    >
      {item.signedUrl ? (
        <Image
          source={{ uri: item.signedUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : (
        <View style={s.tilePlaceholder}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={s.tilePlaceholderMark}
          >
            —
          </Text>
        </View>
      )}

      {item.mediaType === 'video' ? (
        <View accessibilityElementsHidden importantForAccessibility="no" style={s.videoBadge}>
          <Text style={s.videoBadgeText}>Vidéo</Text>
        </View>
      ) : null}

      {captionVisible && item.caption ? (
        <View accessibilityElementsHidden importantForAccessibility="no" style={s.captionBar}>
          <Text numberOfLines={1} style={s.captionText}>
            {item.caption}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: {
    paddingHorizontal: H_PADDING,
    paddingBottom: theme.spacing.xxl,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: theme.palette.eyebrow,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  loadingWrap: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyWrap: {
    marginTop: theme.spacing.sm,
  },
  mosaic: {
    gap: GUTTER,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GUTTER,
  },
  tile: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.palette.card2,
    borderTopWidth: 2,
    borderTopColor: theme.palette.cardBorderProminent,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: theme.palette.line,
  },
  tilePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePlaceholderMark: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  videoBadge: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  videoBadgeText: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.cream,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 0.6,
  },
  captionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(11,11,13,0.62)',
  },
  captionText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.creamSoft,
  },
});
