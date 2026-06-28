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
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { MediaGrid } from '@/components/MediaGrid';
import { type SessionMediaItem, listSessionMedia } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

export default function SessionMediaScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [media, setMedia] = useState<SessionMediaItem[]>([]);
  const [loading, setLoading] = useState(true);

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
          <MediaGrid items={media} />
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
    </Screen>
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
