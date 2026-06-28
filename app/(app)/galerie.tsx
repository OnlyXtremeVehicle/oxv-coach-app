/**
 * Galerie média pilote (PR-67) — TOUS vos médias de session, toutes séances.
 *
 * Le pilote retrouve au même endroit les photos/vidéos OXV de toutes ses
 * journées. Lecture seule (RLS own-row) ; les médias sont ajoutés par OXV.
 * Grille + visionneuse réutilisées (MediaGrid). Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { MediaGrid } from '@/components/MediaGrid';
import { type SessionMediaItem, listAllPilotMedia } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

export default function GalerieScreen() {
  const [media, setMedia] = useState<SessionMediaItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <Screen>
      <AppBar title="SOUVENIRS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOS MÉDIAS OXV</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos souvenirs.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : media.length === 0 ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Aucun souvenir"
              message="Vos photos et vidéos de roulage apparaîtront ici. Elles sont ajoutées par OXV après chaque journée."
              source="session_media"
            />
          </View>
        ) : (
          <View style={{ marginTop: theme.spacing.lg }}>
            <MediaGrid items={media} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
};
