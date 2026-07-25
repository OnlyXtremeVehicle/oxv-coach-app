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
 * CARDIO (BIO) : la pastille colorée des pilotes qui partagent leur cardio vient
 * de `useRosterBiometry`, pas de la présence — la FC n'emprunte QUE le canal privé
 * par-session, jamais `live:roster` (RGPD art. 9). La protection est STRUCTURELLE
 * (aucune FC n'est écrite dans RosterMeta), pas un filtre à l'exécution.
 *
 * Le roster n'affiche AUCUN bpm : une valeur chiffrée en liste inviterait à
 * comparer les pilotes entre eux, ce que la doctrine interdit. La mesure se lit en
 * ouvrant le direct du pilote. La pastille est inerte : pas de pulsation, pas de
 * clignotement — ce serait une alerte, et l'app ne diagnostique pas.
 *
 * ÉCHELLE PROPRE À CHAQUE PILOTE : la couleur situe la FC dans la plage observée
 * DE CE PILOTE pendant CETTE séance, jamais sur un barème commun. Deux pastilles
 * de teintes différentes ne se comparent donc pas — d'où la mention explicite
 * sous la liste : sans elle, une colonne de points ordonnés se lirait comme un
 * classement, et un classement entre pilotes est exclu par la doctrine.
 *
 * En dev, un déclencheur simule un pilote en piste (sans RaceBox ni réseau).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { useLiveRoster } from '@/hooks/useLiveRoster';
import { type RosterBioState, useRosterBiometry } from '@/hooks/useRosterBiometry';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { cardioZoneColor, cardioZoneLabel } from '@/services/cardioZoneLogic';
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
  // Le cardio est un flux SÉPARÉ de la présence : le hook n'ouvre un canal privé
  // que pour les pilotes dont `bioShared` est explicitement vrai, et l'état qu'il
  // rend ne sort jamais d'ici (aucune écriture, aucun journal).
  const bioByPilot = useRosterBiometry(roster);

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
              <RosterList roster={roster} bioByPilot={bioByPilot} />
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
            <RosterList roster={roster} bioByPilot={bioByPilot} />
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

function RosterList({
  roster,
  bioByPilot,
}: {
  roster: RosterEntry[];
  bioByPilot: Record<string, RosterBioState>;
}) {
  // Une pastille cardio n'apparaît que si un pilote partage. La mention n'est
  // donc affichée que dans ce cas — et elle est INDISPENSABLE : chaque couleur
  // situe la FC dans la plage de SON pilote, jamais sur un barème commun. Sans
  // ce référent, une colonne de teintes ordonnées se lirait comme un classement.
  const anyCardio = roster.some((p) => p.bioShared === true);
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      {roster.map((p) => (
        <PilotRow key={p.pilotId} pilot={p} bio={bioByPilot[p.pilotId]} />
      ))}
      {anyCardio ? (
        <Text style={s.cardioScaleNote}>
          Chaque couleur cardio se lit sur la plage du pilote concerné. Elles ne se comparent pas
          entre elles.
        </Text>
      ) : null}
    </View>
  );
}

function PilotRow({ pilot, bio }: { pilot: RosterEntry; bio?: RosterBioState }) {
  const live = pilot.onTrack;
  const statusLabel = live ? 'EN PISTE' : 'AU STAND';
  const statusColor = live ? dataColors.accel : palette.creamMute;
  const dotColor = live ? dataColors.accel : palette.faint;

  // Trois absences se confondent volontairement en une seule : pas encore de
  // trame, plage observée trop étroite, ou flux périmé (le hook retire l'entrée).
  // Dans les trois cas la zone est null, donc la pastille est INERTE — on ne
  // fabrique aucune couleur et on ne fige pas la dernière teinte reçue.
  const cardioZoneOrNull = bio?.zone ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pilot.firstName}, ${live ? 'en piste' : 'au stand'}${
        pilot.circuit ? `, ${pilot.circuit}` : ''
      }${
        // Le libellé de zone REMPLACE « cardio partagé » dès qu'une zone existe :
        // le lecteur d'écran reçoit exactement ce que la couleur montre, ni plus
        // (aucun bpm) ni moins. Vocabulaire fermé et factuel de cardioZoneLogic.
        pilot.bioShared === true ? `, ${cardioZoneLabel(cardioZoneOrNull)}` : ''
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
        {/* BIO — pastille des pilotes dont le direct comporte une bande cardio.
            La couleur situe la FC dans la plage observée du pilote LUI-MÊME
            (rampe froid → chaud, ni or ni rouge) : une magnitude, pas un verdict.
            Elle ne dit rien de comparable d'un pilote à l'autre — chaque plage
            est propre à son porteur. Sans partage, rien ne s'affiche. */}
        {pilot.bioShared === true ? (
          <View style={s.bioRow} accessibilityElementsHidden importantForAccessibility="no">
            <View style={[s.bioDot, { backgroundColor: cardioZoneColor(cardioZoneOrNull) }]} />
            <Text style={s.bioMark}>Cardio</Text>
          </View>
        ) : null}
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
  /** Marqueur cardio : pastille + libellé, sur la même ligne que le statut. */
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  /**
   * Disque de 7 px, aligné sur les autres pastilles de l'écran (nameDot,
   * legendDot) : le cardio est un DÉTAIL de la ligne, pas un signal qui la
   * domine. Aucune animation ni halo — une pastille qui bat serait une alerte.
   */
  bioDot: { width: 7, height: 7, borderRadius: 4 },
  bioMark: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: palette.creamMute,
  },
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
  /** Référent de l'échelle cardio — discret, mais jamais optionnel (anti-classement). */
  cardioScaleNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.4,
    marginTop: spacing.xs,
  },
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
