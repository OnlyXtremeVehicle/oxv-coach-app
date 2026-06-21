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
 * Reskin V2 : Screen + AppBar, Card pour l'état vide. La grille et le
 * lecteur plein écran (Modal) sont inchangés.
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

import { type SessionMediaItem, listSessionMedia } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
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
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="SOUVENIRS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Vos médias de session</Text>

        {media.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyTitle}>Pas encore de souvenirs pour cette session.</Text>
            <Text style={s.emptyHint}>
              Les médias sont ajoutés par OXV après la journée de roulage.
            </Text>
          </Card>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: GRID_GUTTER,
            }}
          >
            {media.map((item) => (
              <MediaTile key={item.id} item={item} onPress={() => setSelected(item)} />
            ))}
          </View>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>

      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MediaTile({ item, onPress }: { item: SessionMediaItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
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
        />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.palette.creamMute, fontSize: theme.fontSize.small }}>—</Text>
        </View>
      )}
      {item.mediaType === 'video' ? (
        <View
          style={{
            position: 'absolute',
            bottom: theme.spacing.xs,
            right: theme.spacing.xs,
            paddingHorizontal: theme.spacing.xs,
            paddingVertical: 2,
            borderRadius: theme.radius.sm,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              color: theme.palette.cream,
              fontSize: theme.fontSize.eyebrow,
              letterSpacing: 1,
              textTransform: 'uppercase',
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
              onPress={handleVideoOpen}
              style={({ pressed }) => ({
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.lg,
                borderRadius: theme.radius.md,
                backgroundColor: theme.palette.red,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  color: theme.palette.cream,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Lire la vidéo
              </Text>
            </Pressable>
          </View>
        ) : item.signedUrl ? (
          <Image
            source={{ uri: item.signedUrl }}
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
          style={{
            fontFamily: theme.fonts.mono,
            marginTop: theme.spacing.xxl,
            color: theme.palette.creamMute,
            fontSize: theme.fontSize.eyebrow,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
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
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
