/**
 * Entre-runs — pause stand. Reskin FIDÈLE à la maquette refonte-v2 §7bis
 * (screens/26-entre-runs.png), règle fondateur : le graphique v2 fait loi,
 * l'héritage utile est retravaillé, jamais collé.
 *
 * Maquette : eyebrow « ENTRE DEUX RUNS » + pastille verte « PAUSE » ·
 * « Soufflez. Prochain run dans » + chiffre roi `32 min` · carte RUN PRÉCÉDENT
 * (chrono OR) · carte NOTE RAPIDE. Écran du flux capture : barre masquée,
 * calme, minimal (silence en piste).
 *
 * Données réelles uniquement :
 *  - compte à rebours : prochaine session inscrite AUJOURD'HUI et à venir
 *    (registrations/sessions du site via nextTrackDayService) — MASQUÉ sinon ;
 *  - run précédent : meilleur tour réel de la capture (useSessionStore),
 *    « — » sans tour bouclé ;
 *  - note rapide : mécanisme réel du Carnet (pilot_notes, own-row RLS),
 *    reliée à la séance de capture (telemetry_sessions.id) si disponible.
 *  - état pneus « chauds » de la maquette : AUCUN capteur → NON RENDU (drop).
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { addNote } from '@/services/pilotNotesService';
import { useAuthStore } from '@/store/useAuthStore';
import { useSessionStore } from '@/store/useSessionStore';
import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { formatChronoMs } from '@/utils/time';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Le prochain départ tombe-t-il sur le jour calendaire local courant ? */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Chiffre roi du compte à rebours : `32` + unité `min`, ou `1 h 05` au-delà. */
function countdownDisplay(min: number): { value: string; unit: string | null } {
  if (min < 60) return { value: String(min), unit: 'min' };
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { value: `${h} h ${String(m).padStart(2, '0')}`, unit: null };
}

export default function EntreRunsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const lapCount = useSessionStore((s) => s.lapCount);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);
  const meta = useSessionStore((s) => s.meta);

  // Compte à rebours — heure de départ RÉELLE (sessions.start_time du site).
  const [nextStart, setNextStart] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    getMyNextTrackDay(profile.id)
      .then((d) => {
        if (cancelled || !d?.startTime) return;
        const start = new Date(`${d.date}T${d.startTime}`);
        if (!Number.isNaN(start.getTime())) setNextStart(start);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Le rebours se rafraîchit à la demi-minute — calme, pas de chrono qui défile.
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Minutes avant le prochain run — SEULEMENT s'il est aujourd'hui et à venir.
  const countdownMin = useMemo(() => {
    if (!nextStart) return null;
    if (!isSameLocalDay(nextStart, new Date(nowTick))) return null;
    const diffMs = nextStart.getTime() - nowTick;
    if (diffMs <= 0) return null;
    return Math.ceil(diffMs / 60_000);
  }, [nextStart, nowTick]);

  // Note rapide — le mécanisme réel du Carnet (pilot_notes), rien d'autre.
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSaveNote() {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await addNote(draft, meta?.id ?? null);
    setSaving(false);
    if (res.ok) {
      setDraft('');
      setSaved(true);
    } else {
      setErrorMsg(res.error ?? 'Enregistrement impossible.');
    }
  }

  const countdown = countdownMin !== null ? countdownDisplay(countdownMin) : null;
  const countdownA11y =
    countdownMin !== null
      ? countdownMin < 60
        ? `Prochain run dans ${countdownMin} minutes`
        : `Prochain run dans ${Math.floor(countdownMin / 60)} heures ${countdownMin % 60} minutes`
      : null;

  return (
    <Screen>
      <View style={s.body}>
        {/* En-tête du flux capture (maquette) : eyebrow + pastille PAUSE. */}
        <View style={s.headerRow}>
          <Text style={s.headerEyebrow}>ENTRE DEUX RUNS</Text>
          <View style={s.pausePill} accessible accessibilityLabel="Session en pause">
            <View style={s.pauseDot} />
            <Text style={s.pauseText}>PAUSE</Text>
          </View>
        </View>

        {/* Titre + chiffre roi — le rebours n'apparaît que s'il est réel. */}
        <Text style={s.title} accessibilityRole="header">
          {countdown ? 'Soufflez. Prochain run dans' : 'Soufflez.'}
        </Text>
        {countdown && countdownA11y ? (
          <View accessible accessibilityLabel={countdownA11y}>
            <Text style={s.kingNumber}>
              {countdown.value}
              {countdown.unit ? <Text style={s.kingUnit}> {countdown.unit}</Text> : null}
            </Text>
          </View>
        ) : null}

        {/* RUN PRÉCÉDENT — le chrono est le seul or de l'écran. */}
        <View
          style={[s.card, s.cardGoldAccent]}
          accessible
          accessibilityLabel={
            bestLapMs !== null
              ? `Run précédent : meilleur tour ${formatChronoMs(bestLapMs)}, ${lapCount} ${
                  lapCount > 1 ? 'tours' : 'tour'
                }`
              : 'Run précédent : aucun tour chronométré'
          }
        >
          <Text style={s.cardEyebrow}>RUN PRÉCÉDENT</Text>
          <Text style={s.chrono}>{bestLapMs !== null ? formatChronoMs(bestLapMs) : '—'}</Text>
          <Text style={s.cardSub}>
            {bestLapMs !== null
              ? lapCount > 1
                ? `meilleur des ${lapCount} tours`
                : 'votre seul tour bouclé'
              : 'aucun tour chronométré'}
          </Text>
        </View>

        {/* NOTE RAPIDE — vos mots, enregistrés dans votre carnet (pilot_notes).
            Aucun gabarit, aucune pré-saisie. */}
        <View style={s.card}>
          <Text style={s.cardEyebrow}>NOTE RAPIDE</Text>
          <TextInput
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              if (saved) setSaved(false);
              if (errorMsg) setErrorMsg(null);
            }}
            multiline
            maxLength={5000}
            placeholder="Écrivez ici, si vous le souhaitez."
            placeholderTextColor={palette.faint}
            selectionColor={palette.green}
            cursorColor={palette.green}
            accessibilityLabel="Votre note rapide"
            style={s.noteInput}
          />
          {saved ? <Text style={s.noteFeedback}>Notée. À retrouver dans votre carnet.</Text> : null}
          {errorMsg ? <Text style={s.noteFeedback}>{errorMsg}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer la note dans le carnet"
            accessibilityState={{ disabled: !draft.trim(), busy: saving }}
            disabled={saving || !draft.trim()}
            onPress={onSaveNote}
            style={({ pressed }) => [
              s.noteAction,
              (pressed || saving) && { opacity: 0.7 },
              !draft.trim() && { opacity: 0.45 },
            ]}
          >
            <Text style={s.noteActionTxt}>
              {saving ? 'Enregistrement…' : 'Enregistrer dans le carnet'}
            </Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, minHeight: spacing.xl }} />

        <Button
          label="Préparer le prochain run"
          onPress={() => router.replace('/(app)/equipement')}
        />
      </View>
    </Screen>
  );
}

const s = {
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },

  // En-tête : eyebrow à gauche, pastille d'état PAUSE à droite (vert = état).
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.xl,
  },
  headerEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  pausePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  pauseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.green },
  pauseText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.green,
  },

  // Titre calme (maquette : « Souffle. Prochain run dans »).
  title: {
    fontFamily: fonts.body,
    fontSize: 20,
    letterSpacing: -0.2,
    lineHeight: 28,
    color: palette.cream,
  },
  // Chiffre roi — mono, le plus grand de l'écran (canon §8).
  kingNumber: {
    fontFamily: fonts.king,
    fontSize: 56,
    letterSpacing: -1.5,
    color: palette.cream,
    marginTop: spacing.sm,
  },
  kingUnit: {
    fontFamily: fonts.mono,
    fontSize: 20,
    letterSpacing: 0,
    color: palette.creamMute,
  },

  // Cartes v2 : surface card, hairline, eyebrow mono ; accent 2px du contexte.
  card: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  cardGoldAccent: {
    borderLeftWidth: 2,
    borderLeftColor: palette.gold,
  },
  cardEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
  },
  chrono: {
    fontFamily: fonts.monoSemi,
    fontSize: 24,
    letterSpacing: -0.5,
    color: palette.gold,
    marginTop: spacing.sm,
  },
  cardSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    letterSpacing: 0.5,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },

  // Note rapide — saisie libre dans la carte (trait vert = accent carnet).
  noteInput: {
    minHeight: 64,
    marginTop: spacing.sm,
    padding: 0,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    color: palette.cream,
    textAlignVertical: 'top' as const,
  },
  noteFeedback: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  noteAction: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignSelf: 'flex-start' as const,
    marginTop: spacing.xs,
  },
  noteActionTxt: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
};
