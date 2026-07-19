/**
 * ENTRE-RUNS — écran 7/8 du flux capture v2 (lot V2-L2, PORTE REC).
 * Route : /(app2)/rec/entre-runs (segment immersif — la TabBar s'efface).
 *
 * La pause au stand : LE cadran du break au centre, le meilleur tour du jour
 * (célébré une fois s'il bat le précédent), une note rapide (carnet réel), et
 * — phase A — l'honnêteté biométrique. Toutes les décisions sont déléguées à
 * entreRunsLogic (pur, testé) ; l'écran ne fait que du câblage de services
 * EXISTANTS (getMyNextTrackDay, addNote, useSessionStore) — capture inchangée.
 *
 * Données réelles (règle fondateur) : le cadran ne s'affiche que pour un vrai
 * départ du jour à venir (sinon masqué) ; le meilleur tour est « — » sans tour
 * bouclé ; la biométrie est fail-closed (flag OFF → rien, zéro teasing).
 * Silence relatif : ici on est au STAND, pas en piste — les chiffres sont donc
 * autorisés (le silence total, c'est le roulage).
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isFlagEnabled } from '@/services/featureFlagsService';
import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { addNote } from '@/services/pilotNotesService';
import { loadBiometryConsents } from '@/services/consentService';
import { storage } from '@/lib/mmkv';
import { useAuthStore } from '@/store/useAuthStore';
import { useSessionStore } from '@/store/useSessionStore';
import {
  ChronoHero,
  colors,
  Dial,
  EMPTY_CIRCUIT_PATH,
  ListRow,
  PressScale,
  radius,
  space,
  typo,
  useDoorTransition,
} from '@/ui/v2';

import { REC_ROUTES } from '@/features/rec/captureStepLogic';
import {
  BREAK_DIAL_MAX_MS,
  computeBreakCountdown,
  dayBestKey,
  dayRecordCelebratedKey,
  decidePauseBiometry,
  evaluateDayBest,
  formatMmSs,
  localDayIso,
} from '@/features/rec/entreRunsLogic';

/** Échelle du cadran en minutes (BREAK_DIAL_MAX_MS = 45 min). */
const BREAK_DIAL_MAX_MIN = Math.round(BREAK_DIAL_MAX_MS / 60_000);

export default function EntreRunsScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);
  const meta = useSessionStore((s) => s.meta);

  // ── Cadran du break : heure de départ RÉELLE, rafraîchie à la demi-minute ──
  const [nextStartMs, setNextStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    getMyNextTrackDay(profile.id)
      .then((d) => {
        if (cancelled || !d?.startTime) return;
        const start = new Date(`${d.date}T${d.startTime}`);
        if (!Number.isNaN(start.getTime())) setNextStartMs(start.getTime());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => computeBreakCountdown(nextStartMs, nowMs), [nextStartMs, nowMs]);

  // ── Meilleur tour du jour + célébration (garde distincte de l'all-time) ────
  const [celebrateDayRecord, setCelebrateDayRecord] = useState(false);

  useEffect(() => {
    if (bestLapMs === null || meta === null) return;
    const dayIso = localDayIso(new Date());
    const prevRaw = storage.getString(dayBestKey(dayIso));
    const prevBest = prevRaw != null ? Number(prevRaw) : null;
    const evaluated = evaluateDayBest(
      Number.isFinite(prevBest as number) ? prevBest : null,
      bestLapMs
    );
    if (evaluated.dayBestMs !== null) {
      storage.set(dayBestKey(dayIso), String(evaluated.dayBestMs));
    }
    if (evaluated.isNewDayRecord) {
      const guardKey = dayRecordCelebratedKey(meta.id);
      if (!storage.getString(guardKey)) {
        storage.set(guardKey, new Date().toISOString());
        setCelebrateDayRecord(true);
      }
    }
  }, [bestLapMs, meta]);

  // ── Biométrie à la pause (fail-closed, phase A honnête) ────────────────────
  const [pauseBio, setPauseBio] = useState<'strip' | 'hint' | 'none'>('none');
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    Promise.all([isFlagEnabled('biometry'), loadBiometryConsents(profile.id)])
      .then(([flag, consents]) => {
        if (cancelled) return;
        // polarPaired = false tant que BIO-2 (scan ceinture) n'est pas livré.
        setPauseBio(
          decidePauseBiometry({
            flagEnabled: flag,
            captureConsent: consents.capture,
            polarPaired: false,
          })
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // ── Note rapide (mécanisme réel du Carnet : pilot_notes) ───────────────────
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function onSaveNote() {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setNoteError(null);
    const res = await addNote(draft, meta?.id ?? null);
    setSaving(false);
    if (res.ok) {
      setDraft('');
      setSaved(true);
    } else {
      setNoteError(res.error ?? 'Enregistrement impossible.');
    }
  }

  const countdownMin = countdown.show
    ? Math.max(1, Math.ceil(countdown.remainingMs / 60_000))
    : null;

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom },
        door,
      ]}
    >
      {/* Le tracé respire derrière les chiffres — motif générique, 6 %. */}
      <Svg
        style={styles.filigrane}
        viewBox="0 0 208 116"
        pointerEvents="none"
        accessibilityElementsHidden
      >
        <Path d={EMPTY_CIRCUIT_PATH} stroke={colors.text.dim} strokeWidth={2} fill="none" />
      </Svg>

      <Text style={styles.eyebrow}>ENTRE DEUX RUNS</Text>

      {/* Cadran du break — affiché SEULEMENT pour un vrai départ du jour. */}
      {countdownMin !== null ? (
        <View
          style={styles.dialWrap}
          accessible
          accessibilityLabel={`Prochain run dans ${formatMmSs(countdown.remainingMs)}`}
        >
          <Dial
            value={countdownMin}
            max={BREAK_DIAL_MAX_MIN}
            label="PROCHAIN RUN"
            unit="min"
            size="l"
          />
        </View>
      ) : (
        <Text style={styles.soften}>Soufflez.</Text>
      )}

      {/* Meilleur tour du jour — le seul or de l'écran (chrono/record). */}
      <View style={styles.bestBlock}>
        <Text style={styles.bestEyebrow}>MEILLEUR TOUR DU JOUR</Text>
        {bestLapMs !== null ? (
          <ChronoHero chronoMs={bestLapMs} size="s" celebrate={celebrateDayRecord} />
        ) : (
          <Text style={styles.bestEmpty}>—</Text>
        )}
      </View>

      {/* Biométrie phase A : honnêteté ou rien (fail-closed). */}
      {pauseBio === 'hint' ? (
        <View style={styles.hintRow}>
          <ListRow
            icon="montre"
            label="Cœur disponible au bilan"
            sublabel="Votre fréquence cardiaque vous sera restituée après la séance."
            divider={false}
            accessibilityLabel="Votre fréquence cardiaque sera disponible au bilan"
          />
        </View>
      ) : null}

      {/* Note rapide — vos mots, dans votre carnet. Aucun gabarit. */}
      <View style={styles.noteCard}>
        <Text style={styles.noteEyebrow}>NOTE RAPIDE</Text>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (saved) setSaved(false);
            if (noteError) setNoteError(null);
          }}
          multiline
          maxLength={5000}
          placeholder="Écrivez ici, si vous le souhaitez."
          placeholderTextColor={colors.text.dim}
          selectionColor={colors.accent}
          accessibilityLabel="Votre note rapide"
          style={styles.noteInput}
        />
        {saved ? (
          <Text style={styles.noteFeedback}>Notée. À retrouver dans votre carnet.</Text>
        ) : null}
        {noteError ? <Text style={styles.noteFeedback}>{noteError}</Text> : null}
        <PressScale
          onPress={onSaveNote}
          disabled={saving || !draft.trim()}
          accessibilityLabel="Enregistrer la note dans le carnet"
          accessibilityState={{ disabled: !draft.trim(), busy: saving }}
          containerStyle={styles.noteActionContainer}
          style={[styles.noteAction, !draft.trim() && styles.noteActionDim]}
        >
          <Text style={styles.noteActionTxt}>
            {saving ? 'Enregistrement…' : 'Enregistrer dans le carnet'}
          </Text>
        </PressScale>
      </View>

      {/* Préparer le prochain run — l'accès à l'équipement DEPUIS le paddock
          (parité v1, vérif L2 [1]) : sans lui, un pilote arrivé au circuit
          (état S7) ne pourrait pas démarrer/relancer une capture. */}
      <PressScale
        onPress={() => router.replace(REC_ROUTES.equipement as never)}
        accessibilityLabel="Préparer le prochain run"
        containerStyle={styles.nextRunContainer}
        style={styles.nextRun}
      >
        <Text style={styles.nextRunTxt}>Préparer le prochain run</Text>
      </PressScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  filigrane: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.06,
  },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accent,
    alignSelf: 'flex-start',
  },
  dialWrap: {
    marginTop: space.xl,
  },
  soften: {
    fontFamily: typo.display,
    fontSize: 26,
    color: colors.text.hi,
    marginTop: space.xxl,
  },
  bestBlock: {
    marginTop: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  bestEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  bestEmpty: {
    fontFamily: typo.monoSemi,
    fontSize: 28,
    color: colors.text.dim,
  },
  hintRow: {
    width: '100%',
    marginTop: space.xl,
  },
  noteCard: {
    marginTop: space.xxl,
    width: '100%',
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  noteEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  noteInput: {
    minHeight: 64,
    marginTop: space.sm,
    padding: 0,
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.hi,
    textAlignVertical: 'top',
  },
  noteFeedback: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  noteActionContainer: {
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
  noteAction: {
    minHeight: 44,
    justifyContent: 'center',
  },
  noteActionDim: {
    opacity: 0.45,
  },
  noteActionTxt: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  nextRunContainer: {
    width: '100%',
    marginTop: space.xl,
  },
  nextRun: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextRunTxt: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
});
