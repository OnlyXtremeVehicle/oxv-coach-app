/**
 * Écran #10 — Vous avez piloté. Design V2 (charte oxv-mirror-app).
 *
 * Reconnaissance émotionnelle de la fin de session. Transition automatique
 * vers #11 après 4 secondes — pas de bouton, on respecte le rythme.
 *
 * Doctrine : utilise le passé composé ("Vous avez piloté.") pour marquer
 * l'événement, sans valorisation ni jugement.
 *
 * Reskin V2 : Screen (centré, sans scroll) + AppBar, titres Syncopate.
 * Écran d'état de flux sans retour manuel. Logique de transition inchangée.
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useSessionStore } from '@/store/useSessionStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const TRANSITION_MS = 4_000;

export default function PilotageFiniScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; ubxUri?: string }>();
  const lapCount = useSessionStore((s) => s.lapCount);
  const meta = useSessionStore((s) => s.meta);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/(app)/donnees-securite',
        // On relaie l'URI .ubx local : il sert de source d'analyse prioritaire
        // (déjà en mémoire flash) si l'écriture en base a connu des trous réseau.
        params: { sessionId: params.sessionId ?? '', ubxUri: params.ubxUri ?? '' },
      });
    }, TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [params.sessionId, params.ubxUri]);

  const startedAt = meta?.startedAt ?? null;
  const endedAt = meta?.endedAt ?? new Date();
  const durationMin =
    startedAt && endedAt ? Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000) : null;

  return (
    <Screen scroll={false}>
      <AppBar title="SESSION TERMINÉE" />
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={s.title}>Vous avez piloté.</Text>

        {durationMin !== null || lapCount > 0 ? (
          <Text style={s.meta}>
            {[
              durationMin !== null ? `${durationMin} min` : null,
              lapCount > 0 ? `${lapCount} tour${lapCount > 1 ? 's' : ''}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.display,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.display * 1.15,
    textAlign: 'center' as const,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
};
