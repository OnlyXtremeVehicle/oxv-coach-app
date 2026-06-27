/**
 * Écran galerie média de session — vue pilote.
 *
 * Affiche les photos/vidéos uploadées par OXV (admin) pour la session
 * courante. Grille 2 colonnes, tap pour zoomer plein écran (photo) ou
 * ouvrir le lecteur natif (vidéo).
 *
 * État vide doctrinal : si aucun média, on n'alerte pas — message sobre
 * « Pas encore de souvenirs pour cette session. »
 *
 * Sécurité : RLS DB + RLS Storage filtrent automatiquement. Si le pilote
 * n'a pas accès, le fetch retourne [].
 * Reskin V2 : Screen + AppBar, EmptyState honnête pour l'absence de média.
 * La grille et le lecteur plein écran (Modal) sont inchangés.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { type SessionMediaItem, listSessionMedia } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GUTTER = 8;
const COLUMNS = 2;
const TILE_SIZE = (SCREEN_WIDTH - 2 * 16 - GRID_GUTTER) / COLUMNS;

export default function SessionMediaScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [media, setMedia] = useState<SessionMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionMediaItem | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const items = await listSessionMedia(sessionId);
      if (cancelled) return;
      setMedia(items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="SOUVENIRS" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator
            color={theme.palette.creamMute}
            accessibilityLabel="Chargement de vos médias"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="SOUVENIRS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          Vos médias de session
        </Text>

        {media.length === 0 ? (
          <EmptyState
            label="Souvenirs"
            message="Pas encore de souvenirs pour cette session. Les médias sont ajoutés par OXV après la journée de roulage."
            source="session_media"
          />
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: GRID_GUTTER,
            }}
          >
            {media.map((item, index) => (
              <MediaTile
                key={item.id}
                item={item}
                index={index}
                onPress={() => setSelected(item)}
              />
            ))}
          </View>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={({ pressed }) => [s.backHit, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>

      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MediaTile({
  item,
  index,
  onPress,
}: {
  item: SessionMediaItem;
  index: number;
  onPress: () => void;
}) {
  const kind = item.mediaType === 'video' ? 'Vidéo' : 'Photo';
  const label = item.caption ? `${kind} ${index + 1} : ${item.caption}` : `${kind} ${index + 1}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_SIZE,
        height: TILE_SIZE,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: theme.palette.card2,
        borderWidth: 1,
        borderColor: theme.palette.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {item.signedUrl ? (
        <Image
          source={{ uri: item.signedUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ color: theme.palette.creamMute, fontSize: theme.fontSize.small }}
          >
            —
          </Text>
        </View>
      )}
      {item.mediaType === 'video' ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: 'absolute',
            bottom: theme.spacing.xs,
            right: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
            borderRadius: theme.radius.sm,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.palette.cream,
              fontSize: theme.fontSize.eyebrow,
              letterSpacing: 0.3,
            }}
          >
            Vidéo
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MediaModal({ item, onClose }: { item: SessionMediaItem | null; onClose: () => void }) {
  if (!item) return null;

  const handleVideoOpen = async () => {
    if (!item.signedUrl) return;
    // Sur iOS / Android, ouvre dans le lecteur natif (Safari / Chrome → app
    // dédiée si MP4). Plus simple que d'embarquer expo-av en V1.
    await Linking.openURL(item.signedUrl).catch(() => undefined);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        {item.mediaType === 'video' ? (
          <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
            <Text style={{ color: theme.palette.cream, fontSize: theme.fontSize.body }}>
              {item.caption ?? 'Vidéo de session'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lire la vidéo"
              onPress={handleVideoOpen}
              style={({ pressed }) => ({
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.lg,
                borderRadius: theme.radius.md,
                backgroundColor: theme.palette.red,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.palette.cream,
                  fontSize: theme.fontSize.body,
                  letterSpacing: 0.3,
                }}
              >
                Lire la vidéo
              </Text>
            </Pressable>
          </View>
        ) : item.signedUrl ? (
          <Image
            source={{ uri: item.signedUrl }}
            accessibilityLabel={item.caption ?? 'Photo de session'}
            style={{
              width: SCREEN_WIDTH - 2 * theme.spacing.lg,
              height: SCREEN_WIDTH - 2 * theme.spacing.lg,
            }}
            resizeMode="contain"
          />
        ) : null}
        {item.caption ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              marginTop: theme.spacing.lg,
              color: theme.palette.creamSoft,
              fontSize: theme.fontSize.small,
              textAlign: 'center',
              maxWidth: SCREEN_WIDTH - 2 * theme.spacing.xl,
            }}
          >
            {item.caption}
          </Text>
        ) : null}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            fontFamily: theme.fonts.body,
            marginTop: theme.spacing.xxl,
            color: theme.palette.creamMute,
            fontSize: theme.fontSize.small,
          }}
        >
          Toucher pour fermer
        </Text>
      </Pressable>
    </Modal>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
  },
  backLink: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
};
