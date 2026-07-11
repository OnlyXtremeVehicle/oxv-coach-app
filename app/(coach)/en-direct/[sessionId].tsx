/**
 * Cockpit focus — le coach suit UN pilote en direct (P5).
 *
 * Flux Realtime via usePilotLive (broadcast). Chiffre roi = le CHRONO du tour en
 * cours (or, c'est un chrono/record en devenir) ; vitesse et G sont des relevés
 * NEUTRES (pas des chronos). Une alerte « virage · à surveiller » factuelle
 * quand un virage est signalé. L'état de connexion est honnête (live / ralenti /
 * coupé) : réseau circuit instable, on n'invente jamais un direct.
 *
 * Doctrine : le coach observe (le pilote conduit en silence). Aucune consigne
 * générée par l'app ; la note express du coach est ATTRIBUÉE, jamais « de l'app ».
 */

import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Fact } from '@/components/instruments';
import { usePilotLive } from '@/hooks/usePilotLive';
import { getCorner } from '@/lib/circuitTopology';
import { formatLiveChrono, liveAlert } from '@/services/liveSessionLogic';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { KingNumber } from '@/ui/KingNumber';
import { Screen } from '@/ui/Screen';

const { palette, dataColors, spacing, radius, fonts, fontSize } = theme;

const CONN_LABEL = {
  connecting: 'Connexion au flux…',
  stale: 'Flux ralenti — dernières données conservées.',
  offline: 'Flux coupé — reconnexion auto, télémétrie gardée sur le boîtier.',
  live: '',
} as const;

export default function CockpitFocusScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; name?: string }>();
  const sessionId = params.sessionId ?? null;
  const { frame, conn } = usePilotLive(sessionId);

  const cornerName =
    frame?.cornerIndex != null ? (getCorner(frame.cornerIndex)?.name ?? null) : null;
  const alert = frame ? liveAlert(frame, cornerName) : null;

  return (
    <Screen>
      <AppBar title={(params.name ?? 'En direct').toUpperCase()} onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Bandeau d'état honnête */}
        <View style={s.connRow}>
          <View
            style={[s.dot, { backgroundColor: conn === 'live' ? dataColors.accel : palette.faint }]}
          />
          <Text style={[s.connTxt, conn === 'live' ? { color: dataColors.accel } : null]}>
            {conn === 'live' ? 'EN DIRECT' : CONN_LABEL[conn]}
          </Text>
        </View>

        {/* Chrono du tour en cours — chiffre roi, or (c'est un chrono). */}
        <View style={s.hero}>
          <Text style={s.eyebrow}>
            {frame
              ? `TOUR ${frame.lap}${frame.sector != null ? ` · SECTEUR ${frame.sector}` : ''}`
              : 'TOUR EN COURS'}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <KingNumber
              value={formatLiveChrono(frame?.chronoMs ?? null)}
              label="Tour en cours"
              color={palette.gold}
              size={54}
            />
          </View>
        </View>

        {/* Alerte factuelle « à surveiller » (vue du coach, jamais du pilote). */}
        {alert ? (
          <View style={s.alertCard}>
            <View style={s.alertBar} />
            <Text style={s.alertTxt}>{alert}</Text>
          </View>
        ) : null}

        {/* Relevés instantanés — neutres (ni chrono, ni alarme). */}
        <View style={s.tiles}>
          <Fact
            label="Vitesse"
            value={frame ? String(Math.round(frame.speedKmh)) : '—'}
            unit="km/h"
          />
          <Fact label="G latéral" value={frame ? frame.gLat.toFixed(2) : '—'} unit="g" />
          <Fact label="G long." value={frame ? frame.gLong.toFixed(2) : '—'} unit="g" />
        </View>

        {/* Note express — voix du coach, ATTRIBUÉE (jamais une consigne de l'app). */}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/(coach)/annoter',
              params: sessionId ? { sessionId } : {},
            })
          }
          style={({ pressed }) => [s.noteBtn, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={s.noteTxt}>Note express</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  connRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: palette.creamMute,
  },
  hero: { marginTop: spacing.xl, alignItems: 'flex-start' as const },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  alertCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  alertBar: {
    width: 3,
    alignSelf: 'stretch' as const,
    borderRadius: 2,
    backgroundColor: palette.coachAlert,
  },
  alertTxt: { fontFamily: fonts.bodyMedium, fontSize: fontSize.body, color: palette.cream },
  tiles: { flexDirection: 'row' as const, gap: spacing.sm, marginTop: spacing.xxl },
  noteBtn: {
    marginTop: spacing.xxl,
    height: 54,
    borderRadius: 16,
    backgroundColor: palette.coachAccent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  noteTxt: { fontFamily: fonts.bodyMedium, fontSize: 15, color: palette.cream },
};
