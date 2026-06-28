/**
 * Pilote Pro — Média (gestion, PR-73).
 *
 * Le pilote pro retrouve tous ses médias OXV (photos / vidéos de roulage) au même
 * endroit, en lecture et consultation. Rien n'est exposé publiquement depuis ici :
 * la mise en vitrine se décide dans l'onglet Partage, geste par geste. RLS own-row
 * (le pro ne voit que ses médias). Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { MediaGrid } from '@/components/MediaGrid';
import { type SessionMediaItem, listAllPilotMedia } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

export default function ProMediaScreen() {
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
      <AppBar title="MÉDIA" trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOS MÉDIAS OXV</Text>
        <Text style={s.title} accessibilityRole="header">
          Tout, au même endroit.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : media.length === 0 ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Aucun média"
              message="Vos photos et vidéos de roulage apparaîtront ici. Elles sont ajoutées par OXV après chaque journée."
              source="session_media"
            />
          </View>
        ) : (
          <>
            <View style={{ marginTop: theme.spacing.lg }}>
              <MediaGrid items={media} />
            </View>
            <Card
              onPress={() => router.push('/(pro)/partage' as never)}
              accessibilityLabel="Partage. Décider ce qui est visible publiquement."
              style={{ marginTop: theme.spacing.xl }}
            >
              <Text style={s.cardTitle}>Mettre en vitrine</Text>
              <Text style={s.cardHint}>
                Rien n&apos;est public sans votre geste. Vous décidez dans Partage.
              </Text>
            </Card>
          </>
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
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
};
