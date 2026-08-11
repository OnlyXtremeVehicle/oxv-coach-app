/**
 * ENTRE-RUNS — écran 7/8 du flux capture v2 (lot V2-L2, PORTE REC).
 * Route : /(app2)/rec/entre-runs. **La TabBar RESTE VISIBLE ici** : le segment
 * n'est pas dans `V2_HIDDEN_SEGMENTS` (arrivee, equipement, placement, roulage,
 * fin), conformément au contrat de coquille du lot L0. Cet en-tête affirmait
 * l'inverse, et l'écran en tirait un `paddingBottom: insets.bottom` — la barre
 * recouvrait donc le bas du contenu, bouton de sortie compris.
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
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isFlagEnabled } from '@/services/featureFlagsService';
import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { addNote } from '@/services/pilotNotesService';
import {
  QCM_INITIAL,
  RESSENTIS,
  THEMES,
  chiffresAffichables,
  choisirRessenti,
  choisirTheme,
  ecritureDepuis,
  passer,
  questionCourante,
  type EtatQcm,
} from '@/features/rec/qcmLogic';
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
  msToLapLabel,
  PressScale,
  radius,
  space,
  tabBarSpace,
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

  /**
   * LE QCM, ET SON EFFET SUR TOUT L'ÉCRAN.
   *
   * Tant qu'il n'est pas traité, les CHIFFRES sont masqués — le cadran du break
   * et le meilleur tour du jour. Le motif est doctrinal : un pilote qui lit
   * « record du jour » avant qu'on lui demande ce qu'il a senti répondra que ça
   * allait. Il ne mentira pas, il aura lu la réponse avant la question.
   *
   * « Traité » comprend « passé ». On ne retient personne au stand.
   */
  const [qcm, setQcm] = useState<EtatQcm>(QCM_INITIAL);
  const chiffresVisibles = chiffresAffichables(qcm);

  const repondreRessenti = (cle: (typeof RESSENTIS)[number]['cle']) => {
    const suivant = choisirRessenti(qcm, cle);
    setQcm(suivant);
    const ecriture = ecritureDepuis(suivant);
    // On n'écrit jamais une réponse à moitié : `ecritureDepuis` rend null tant
    // que les deux moitiés ne sont pas là.
    if (ecriture) {
      void addNote(ecriture.body, meta?.id ?? null, {
        theme: ecriture.theme,
        ressenti: ecriture.ressenti,
      }).catch(() => undefined);
    }
  };

  return (
    <Animated.View style={[styles.root, door]}>
      {/* Le tracé respire derrière les chiffres — motif générique, 6 %. */}
      <Svg
        style={styles.filigrane}
        viewBox="0 0 208 116"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path d={EMPTY_CIRCUIT_PATH} stroke={colors.text.mid} strokeWidth={2} fill="none" />
      </Svg>

      {/*
        Le contenu DÉFILE, et réserve la hauteur de la barre d'onglets.

        L'écran était un bloc fixe : tout ce qui dépassait était perdu, sans
        indice. Trois débordements le guettaient — la ligne biométrie quand son
        drapeau passera à ON, le Dynamic Type, et le clavier pendant la saisie
        de la note. `tabBarSpace` rend la hauteur que la barre occupe.
      */}
      <ScrollView
        style={styles.defile}
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: tabBarSpace(insets.bottom) + space.xl,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow} accessibilityRole="header">
          ENTRE DEUX RUNS
        </Text>

        {/* LE QCM EN TÊTE — lot 21f. Il précède tout chiffre, et c'est la règle
            elle-même : une valeur lue avant la question oriente la réponse.
            L'action « Passer » est en BAS du bloc, jamais en haut à droite : le
            plan des cibles interdit toute action dans le tiers supérieur, et le
            geste au gant y est le moins sûr. */}
        {!chiffresVisibles ? (
          <View style={styles.qcmBloc}>
            <Text style={styles.qcmQuestion} accessibilityRole="header">
              {questionCourante(qcm)}
            </Text>

            <View style={styles.qcmOptions}>
              {qcm.etape === 'theme'
                ? THEMES.map((t) => (
                    <PressScale
                      key={t.cle}
                      onPress={() => setQcm(choisirTheme(qcm, t.cle))}
                      accessibilityLabel={t.label}
                      style={styles.qcmOption}
                    >
                      <Text style={styles.qcmOptionTxt}>{t.label}</Text>
                    </PressScale>
                  ))
                : RESSENTIS.map((r) => (
                    <PressScale
                      key={r.cle}
                      onPress={() => repondreRessenti(r.cle)}
                      accessibilityLabel={r.label}
                      style={styles.qcmOption}
                    >
                      <Text style={styles.qcmOptionTxt}>{r.label}</Text>
                    </PressScale>
                  ))}
            </View>

            <PressScale
              onPress={() => setQcm(passer(qcm))}
              accessibilityLabel="Passer la question"
              style={styles.qcmPasser}
            >
              <Text style={styles.qcmPasserTxt}>Passer</Text>
            </PressScale>
          </View>
        ) : null}

        {/* Cadran du break — affiché SEULEMENT pour un vrai départ du jour, ET
            seulement une fois la question traitée. */}
        {chiffresVisibles && countdownMin !== null ? (
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
        ) : chiffresVisibles ? (
          <Text style={styles.soften}>Soufflez.</Text>
        ) : null}

        {/* Meilleur tour du jour — le seul or de l'écran (chrono/record). */}
        {/* Groupé : l'étiquette et la valeur sont un seul fait. Sans tour bouclé,
          la valeur affichée est le seul caractère « — », qu'un lecteur d'écran
          annonce « tiret » ou saute selon sa verbosité — l'absence de mesure se
          dit donc en toutes lettres. */}
        {chiffresVisibles ? (
          <View
            style={styles.bestBlock}
            accessible
            accessibilityLabel={
              bestLapMs !== null
                ? `Meilleur tour du jour : ${msToLapLabel(bestLapMs)}`
                : // « non mesuré », pas « aucun tour bouclé » : bestLapMs reste nul
                  // aussi bien quand le pilote n'a bouclé aucun tour que quand rien
                  // n'a pu être mesuré (fix GNSS perdu, ligne d'arrivée absente,
                  // boîtier décroché). Dire le second cas comme le premier ferait
                  // affirmer à l'app un fait de pilotage qu'elle n'a pas constaté.
                  'Meilleur tour du jour : non mesuré'
            }
          >
            <Text style={styles.bestEyebrow}>MEILLEUR TOUR DU JOUR</Text>
            {bestLapMs !== null ? (
              <ChronoHero chronoMs={bestLapMs} size="s" celebrate={celebrateDayRecord} />
            ) : (
              <Text style={styles.bestEmpty}>—</Text>
            )}
          </View>
        ) : null}

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
            placeholderTextColor={colors.text.mid}
            selectionColor={colors.accent}
            accessibilityLabel="Votre note rapide"
            style={styles.noteInput}
          />
          {/* L'issue de l'enregistrement doit s'entendre : le champ se vide, ce
            qui sans annonce peut se lire comme une perte. */}
          {saved ? (
            <Text style={styles.noteFeedback} accessibilityLiveRegion="polite">
              Notée. À retrouver dans votre carnet.
            </Text>
          ) : null}
          {noteError ? (
            <Text style={styles.noteFeedback} accessibilityLiveRegion="assertive">
              {noteError}
            </Text>
          ) : null}
          <PressScale
            onPress={onSaveNote}
            disabled={saving || !draft.trim()}
            accessibilityLabel="Enregistrer la note dans le carnet"
            // L'état annoncé suit l'état RÉEL : pendant l'enregistrement d'une
            // note non vide, le bouton est inerte et doit se dire tel quel.
            accessibilityState={{ disabled: saving || !draft.trim(), busy: saving }}
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
          onPress={() => router.replace(REC_ROUTES.appairage as never)}
          accessibilityLabel="Préparer le prochain run"
          containerStyle={styles.nextRunContainer}
          style={styles.nextRun}
        >
          <Text style={styles.nextRunTxt}>Préparer le prochain run</Text>
        </PressScale>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  qcmBloc: {
    marginTop: space.lg,
    gap: space.md,
  },
  qcmQuestion: {
    fontFamily: typo.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text.hi,
    textAlign: 'center',
  },
  qcmOptions: {
    gap: space.sm,
  },
  /**
   * 56 pt de haut : l'optimum cockpit du plan (18 à 21 mm), pas le plancher
   * Apple de 44. Le taux d'erreur passe de 10,3 % en statique à 16,6 % sous
   * vibration — et le pilote répond ganté, au stand.
   */
  qcmOption: {
    minHeight: 56,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  qcmOptionTxt: {
    fontFamily: typo.bodyMedium,
    fontSize: 16,
    color: colors.text.hi,
  },
  qcmPasser: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qcmPasserTxt: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.mid,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  defile: {
    flex: 1,
    paddingHorizontal: space.xl,
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
    color: colors.text.hi,
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
    color: colors.text.mid,
  },
  bestEmpty: {
    fontFamily: typo.monoSemi,
    fontSize: 28,
    color: colors.text.mid,
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
    color: colors.text.mid,
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
