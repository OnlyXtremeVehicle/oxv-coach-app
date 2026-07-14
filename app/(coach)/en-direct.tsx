/**
 * En direct — roster coach des pilotes en piste (P5), au langage refonte-v2 §12.
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : le MÊME écran s'adapte.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : centre de suivi §12 — en-tête
 *     (badge EN DIRECT + titre + « rafraîchi en continu »), corps 2 colonnes :
 *     à gauche la liste de VOS pilotes en direct, à droite l'ÉTAT du direct
 *     (combien en piste / au stand, circuit). Le rail est fourni par `_layout`.
 *   - COMPAGNON téléphone (< seuil) : AppBar + carte d'état + liste (onglets bas).
 *
 * Le coach OBSERVE (il ne conduit pas ; le pilote reste en silence en piste).
 * DONNÉES RÉELLES seulement — presence Supabase Realtime via useLiveRoster : qui
 * est là, depuis quand, en piste / au stand, sur quel circuit. Aucun chrono,
 * aucune position, aucune alerte n'est inventée ici : ces flux par-pilote vivent
 * sur la fiche direct (en-direct/[sessionId], usePilotLive) — un toucher l'ouvre.
 * Aucun classement, aucune consigne. L'or (chrono) est donc absent de cet écran.
 *
 * En dev, un déclencheur simule un pilote en piste (sans RaceBox ni réseau).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { useLiveRoster } from '@/hooks/useLiveRoster';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { type RosterEntry } from '@/services/liveSessionLogic';
import { joinRoster, startSimulatedStream } from '@/services/liveSessionService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { timeAgoFr } from '@/utils/time';

const { palette, dataColors, spacing, radius, fonts, fontSize } = theme;

const SIDE_W = 300;

/** Circuit commun aux pilotes présents, ou null si aucun / plusieurs. */
function commonCircuit(roster: RosterEntry[]): string | 'multi' | null {
  const set = new Set<string>();
  for (const p of roster) if (p.circuit) set.add(p.circuit);
  if (set.size === 0) return null;
  if (set.size === 1) return [...set][0];
  return 'multi';
}

function plural(n: number): string {
  return n >= 2 ? 's' : '';
}

export default function EnDirectScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const coachId = useAuthStore((st) => st.profile?.id ?? null);
  const { roster, ready } = useLiveRoster(coachId);

  const onTrack = roster.filter((p) => p.onTrack).length;
  const atStand = roster.length - onTrack;
  const circuit = commonCircuit(roster);

  return (
    <Screen>
      {isConsole ? null : <AppBar title="EN DIRECT" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {/* En-tête — badge live + titre ; « rafraîchi en continu » à droite (console). */}
        {isConsole ? (
          <View style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <LiveBadge ready={ready} />
              <Text style={s.title} accessibilityRole="header">
                Qui est en piste.
              </Text>
              <Text style={s.headSub}>{headSubtitle(circuit, roster.length)}</Text>
            </View>
            {ready ? <RefreshPulse /> : null}
          </View>
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            <LiveBadge ready={ready} />
            <Text style={s.title} accessibilityRole="header">
              Qui est en piste.
            </Text>
            <Text style={s.headSub}>{headSubtitle(circuit, roster.length)}</Text>
          </View>
        )}

        {/* Corps — états honnêtes : connexion / personne en piste / roster. */}
        {!ready ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState label="Connexion" message="Connexion au direct…" source="live:roster" />
          </View>
        ) : roster.length === 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState
              label="Personne en piste"
              message="Aucun de vos pilotes n'est en séance pour l'instant. Le direct s'ouvre dès qu'un boîtier émet."
              source="live:roster"
            />
          </View>
        ) : isConsole ? (
          <View style={s.consoleBody}>
            <View style={s.colMain}>
              <PanelHeader
                label="VOS PILOTES · EN DIRECT"
                right={`${roster.length} présent${plural(roster.length)}`}
              />
              <RosterList roster={roster} />
            </View>
            <View style={s.colSide}>
              <StatePanel
                onTrack={onTrack}
                atStand={atStand}
                total={roster.length}
                circuit={circuit}
              />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            <SummaryCard
              onTrack={onTrack}
              atStand={atStand}
              total={roster.length}
              circuit={circuit}
            />
            <PanelHeader
              label="VOS PILOTES"
              right={`${roster.length} présent${plural(roster.length)}`}
            />
            <RosterList roster={roster} />
          </View>
        )}

        {__DEV__ && coachId ? <DevSimulateButton coachId={coachId} /> : null}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function headSubtitle(circuit: string | 'multi' | null, total: number): string {
  const place = circuit === 'multi' ? 'Plusieurs circuits' : (circuit ?? 'Circuit en attente');
  if (total === 0) return place;
  return `${place} · ${total} pilote${plural(total)}`;
}

/** Pastille d'identité live (rouge coach). Le point vit tant que le canal répond. */
function LiveBadge({ ready }: { ready: boolean }) {
  return (
    <View style={s.badge} accessibilityRole="text" accessibilityLabel="En direct">
      <View
        style={[s.badgeDot, { backgroundColor: ready ? palette.coachAccent : palette.faint }]}
      />
      <Text style={s.badgeTxt}>EN DIRECT</Text>
    </View>
  );
}

/** Indicateur factuel : la présence est poussée en continu (Realtime). */
function RefreshPulse() {
  return (
    <View style={s.pulse} accessibilityElementsHidden importantForAccessibility="no">
      <View style={s.pulseDot} />
      <Text style={s.pulseTxt}>RAFRAÎCHI EN CONTINU</Text>
    </View>
  );
}

function PanelHeader({ label, right }: { label: string; right?: string }) {
  return (
    <View style={s.panelHead}>
      <Text style={s.panelLabel} accessibilityRole="header">
        {label}
      </Text>
      {right ? <Text style={s.panelRight}>{right}</Text> : null}
    </View>
  );
}

function RosterList({ roster }: { roster: RosterEntry[] }) {
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      {roster.map((p) => (
        <PilotRow key={p.pilotId} pilot={p} />
      ))}
    </View>
  );
}

function PilotRow({ pilot }: { pilot: RosterEntry }) {
  const live = pilot.onTrack;
  const statusLabel = live ? 'EN PISTE' : 'AU STAND';
  const statusColor = live ? dataColors.accel : palette.creamMute;
  const dotColor = live ? dataColors.accel : palette.faint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pilot.firstName}, ${live ? 'en piste' : 'au stand'}${
        pilot.circuit ? `, ${pilot.circuit}` : ''
      }. Ouvrir son direct.`}
      onPress={() =>
        router.push({
          pathname: '/(coach)/en-direct/[sessionId]',
          params: { sessionId: pilot.sessionId, name: pilot.firstName },
        } as never)
      }
      style={({ pressed }) => [s.row, pressed && { opacity: 0.85, borderColor: palette.edge }]}
    >
      <View style={s.avatar}>
        <Text style={s.avatarTxt}>{(pilot.firstName[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text numberOfLines={1} style={s.name}>
            {pilot.firstName}
          </Text>
          <View style={[s.nameDot, { backgroundColor: dotColor }]} />
        </View>
        <Text numberOfLines={1} style={s.meta}>
          {(pilot.circuit ?? 'Circuit inconnu') + ' · depuis ' + timeAgoFr(new Date(pilot.sinceMs))}
        </Text>
      </View>
      <View style={s.statusCol}>
        <Text style={[s.status, { color: statusColor }]}>{statusLabel}</Text>
      </View>
      <Text style={s.chevron} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

/** Colonne de droite (console) : l'état chiffré du direct — un seul chiffre roi
 *  (les pilotes en piste), le reste qualitatif. Aucun or : ce n'est pas un chrono. */
function StatePanel({
  onTrack,
  atStand,
  total,
  circuit,
}: {
  onTrack: number;
  atStand: number;
  total: number;
  circuit: string | 'multi' | null;
}) {
  return (
    <View style={s.panel}>
      <Text style={s.panelLabel}>ÉTAT DU DIRECT</Text>
      <View style={s.countBlock}>
        <Text style={s.count} accessibilityLabel={`${onTrack} en piste`}>
          {onTrack}
        </Text>
        <Text style={s.countUnit}>en piste</Text>
      </View>
      <View style={s.breakdown}>
        <Legend color={dataColors.accel} label={`${onTrack} en piste`} />
        <Legend color={palette.faint} label={`${atStand} au stand`} />
        <Legend color={palette.eyebrow} label={`${total} présent${plural(total)}`} muted />
      </View>
      {circuit ? (
        <Text style={s.panelNote}>
          {circuit === 'multi' ? 'Plusieurs circuits couverts.' : circuit}
        </Text>
      ) : null}
      <View style={s.hair} />
      <Text style={s.panelHint}>
        Touchez un pilote pour ouvrir son direct — chrono du tour, secteurs, position.
      </Text>
    </View>
  );
}

/** Carte d'état (compagnon téléphone) — même contenu que StatePanel, compacté. */
function SummaryCard({
  onTrack,
  atStand,
  total,
  circuit,
}: {
  onTrack: number;
  atStand: number;
  total: number;
  circuit: string | 'multi' | null;
}) {
  return (
    <View style={s.summary}>
      <View style={s.summaryLeft}>
        <Text style={s.count} accessibilityLabel={`${onTrack} en piste`}>
          {onTrack}
        </Text>
        <Text style={s.countUnit}>en piste</Text>
      </View>
      <View style={s.summaryRight}>
        <Legend color={dataColors.accel} label={`${onTrack} en piste`} />
        <Legend color={palette.faint} label={`${atStand} au stand`} />
        {circuit ? (
          <Text style={s.summaryCircuit}>
            {circuit === 'multi' ? 'Plusieurs circuits' : circuit}
          </Text>
        ) : (
          <Text style={s.summaryCircuit}>
            {total} présent{plural(total)}
          </Text>
        )}
      </View>
    </View>
  );
}

function Legend({ color, label, muted }: { color: string; label: string; muted?: boolean }) {
  return (
    <View style={s.legend}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={[s.legendTxt, muted && { color: palette.eyebrow }]}>{label}</Text>
    </View>
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

const s = StyleSheet.create({
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },

  // Badge live (identité coach = rouge).
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.12)',
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 1.5,
    color: palette.coachAccent,
  },

  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.md,
  },
  headSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },

  pulse: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.coachAccent },
  pulseTxt: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: palette.eyebrow,
  },

  // Corps console — 2 colonnes.
  consoleBody: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl },
  colMain: { flex: 1, minWidth: 0 },
  colSide: { width: SIDE_W },

  // En-tête de panneau.
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  panelLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.faint,
  },
  panelRight: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },

  // Rangée pilote.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: fontSize.body, color: palette.creamSoft },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameDot: { width: 7, height: 7, borderRadius: 4 },
  name: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
    flexShrink: 1,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 3,
  },
  statusCol: { alignItems: 'flex-end' },
  status: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1 },
  chevron: { fontFamily: fonts.mono, fontSize: 18, color: palette.faint, marginLeft: spacing.xs },

  // Panneau d'état (console).
  panel: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  countBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  count: {
    fontFamily: fonts.king,
    fontSize: fontSize.display,
    color: palette.cream,
    letterSpacing: -1,
  },
  countUnit: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginBottom: 4,
  },
  breakdown: { gap: spacing.sm, marginTop: spacing.lg },
  panelNote: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.lg,
  },
  hair: { height: 1, backgroundColor: palette.separator, marginVertical: spacing.lg },
  panelHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: 18,
    color: palette.creamMute,
  },

  // Carte d'état (compagnon).
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    padding: spacing.lg,
  },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  summaryRight: { flex: 1, gap: spacing.sm },
  summaryCircuit: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },

  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendTxt: { fontFamily: fonts.mono, fontSize: fontSize.small, color: palette.creamSoft },

  devBtn: {
    marginTop: spacing.xxl,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
});
