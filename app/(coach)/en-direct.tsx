/**
 * En direct — roster coach des pilotes en piste (P5, décision Gabin 2026-07-11).
 *
 * Le coach observe qui roule (il ne conduit pas ; le pilote reste en silence en
 * piste). Presence Supabase Realtime via useLiveRoster (roster pur, testé).
 * États honnêtes : connexion / personne en piste / hors-ligne implicite (roster
 * vide). Un toucher sur un pilote → sa fiche (le cockpit focus live viendra
 * ensuite, sur subscribePilotStream). Aucun classement — juste qui est là.
 *
 * En dev, un déclencheur simule un pilote en piste (sans RaceBox ni réseau).
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { useLiveRoster } from '@/hooks/useLiveRoster';
import { joinRoster, startSimulatedStream } from '@/services/liveSessionService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { timeAgoFr } from '@/utils/time';

const { palette, dataColors, spacing, radius, fonts, fontSize } = theme;

export default function EnDirectScreen() {
  const coachId = useAuthStore((st) => st.profile?.id ?? null);
  const { roster, ready } = useLiveRoster(coachId);

  return (
    <Screen>
      <AppBar title="EN DIRECT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={s.eyebrow}>LE DIRECT</Text>
        <Text style={s.title} accessibilityRole="header">
          Qui est en piste.
        </Text>

        {!ready ? (
          <EmptyState label="Connexion" message="Connexion au direct…" />
        ) : roster.length === 0 ? (
          <EmptyState
            label="Personne en piste"
            message="Aucun de vos pilotes n'est en séance pour l'instant. Le direct s'ouvre dès qu'un boîtier émet."
          />
        ) : (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {roster.map((p) => (
              <Card
                key={p.pilotId}
                onPress={() =>
                  router.push({
                    pathname: '/(coach)/en-direct/[sessionId]',
                    params: { sessionId: p.sessionId, name: p.firstName },
                  } as never)
                }
                accessibilityLabel={`${p.firstName}, ${p.onTrack ? 'en piste' : 'au stand'}${
                  p.circuit ? `, ${p.circuit}` : ''
                }`}
              >
                <View style={s.row}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{(p.firstName[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{p.firstName}</Text>
                    <Text style={s.meta}>
                      {p.circuit ?? 'Circuit inconnu'} · depuis {timeAgoFr(new Date(p.sinceMs))}
                    </Text>
                  </View>
                  <View style={s.statusWrap}>
                    <View
                      style={[
                        s.dot,
                        { backgroundColor: p.onTrack ? dataColors.accel : palette.faint },
                      ]}
                    />
                    <Text
                      style={[s.status, { color: p.onTrack ? dataColors.accel : palette.faint }]}
                    >
                      {p.onTrack ? 'EN PISTE' : 'AU STAND'}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {__DEV__ && coachId ? <DevSimulateButton coachId={coachId} /> : null}
      </View>
    </Screen>
  );
}

/** Dev-only : simule un pilote en piste (presence + flux) pour développer sans matériel. */
function DevSimulateButton({ coachId }: { coachId: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const sessionId = 'sim-session';
    // Le pilote simulé rejoint le roster de CE coach (transport par-coach).
    const leave = joinRoster(coachId, {
      pilotId: 'sim-pilot',
      firstName: 'Adrien',
      sessionId,
      circuit: 'Haute Saintonge',
      onTrack: true,
      sinceMs: Date.now(),
    });
    const stop = startSimulatedStream(sessionId);
    return () => {
      leave();
      stop();
    };
  }, [on, coachId]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => setOn((v) => !v)}
      style={({ pressed }) => [s.devBtn, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={s.devTxt}>
        {on ? 'Arrêter la simulation' : 'DEV · simuler un pilote en piste'}
      </Text>
    </Pressable>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.coachAlert,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.coachAlert,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: fontSize.body, color: palette.cream },
  name: { fontFamily: fonts.bodyMedium, fontSize: fontSize.bodyLg, color: palette.cream },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  statusWrap: { alignItems: 'flex-end' as const, gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1 },
  devBtn: {
    marginTop: spacing.xxl,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  devTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
};
