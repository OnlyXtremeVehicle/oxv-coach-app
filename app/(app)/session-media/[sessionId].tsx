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
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { type SessionMediaItem, listSessionMedia } from '@/services/sessionMediaService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>SOUVENIRS</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Vos médias de session
        </Text>

        {media.length === 0 ? (
          <View
            style={{
              padding: spacing.xxl,
              alignItems: 'center',
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
            }}
          >
            <Text
              style={[
                typography.manifest,
                { color: colors.text.tertiary, textAlign: 'center', fontStyle: 'italic' },
              ]}
            >
              Pas encore de souvenirs pour cette session.
            </Text>
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.text.tertiary,
                fontSize: fontSize.caption,
                textAlign: 'center',
              }}
            >
              Les médias sont ajoutés par OXV après la journée de roulage.
            </Text>
          </View>
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

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>

      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
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
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        backgroundColor: colors.background.secondary,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
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
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>—</Text>
        </View>
      )}
      {item.mediaType === 'video' ? (
        <View
          style={{
            position: 'absolute',
            bottom: spacing.xs,
            right: spacing.xs,
            paddingHorizontal: spacing.xs,
            paddingVertical: 2,
            borderRadius: borderRadius.sm,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.eyebrow,
              fontWeight: fontWeight.medium,
              letterSpacing: 1,
            }}
          >
            VIDÉO
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
          padding: spacing.lg,
        }}
      >
        {item.mediaType === 'video' ? (
          <View style={{ alignItems: 'center', gap: spacing.lg }}>
            <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
              {item.caption ?? 'Vidéo de session'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleVideoOpen}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.lg,
                borderRadius: borderRadius.md,
                backgroundColor: colors.accent.red,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.background.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
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
              width: SCREEN_WIDTH - 2 * spacing.lg,
              height: SCREEN_WIDTH - 2 * spacing.lg,
            }}
            resizeMode="contain"
          />
        ) : null}
        {item.caption ? (
          <Text
            style={{
              marginTop: spacing.lg,
              color: colors.text.secondary,
              fontSize: fontSize.caption,
              textAlign: 'center',
              maxWidth: SCREEN_WIDTH - 2 * spacing.xl,
            }}
          >
            {item.caption}
          </Text>
        ) : null}
        <Text
          style={{
            marginTop: spacing.xxl,
            color: colors.text.tertiary,
            fontSize: fontSize.eyebrow,
            letterSpacing: 1.5,
          }}
        >
          TOUCHER POUR FERMER
        </Text>
      </Pressable>
    </Modal>
  );
}
