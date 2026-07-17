/**
 * Paddock — accueil Miroir, 3 modes. Reskin FIDÈLE aux maquettes Claude Design
 * refonte-v2 §7.1 (screens/01-paddock.png), décision fondateur 2026-07-12.
 *
 *   mode "enroute"   (S5)  — silence en piste : « Coupez l'app. Je conduis. »
 *   mode "countdown" (S4)  — prochaine session
 *   mode "passive"   — maquette : salutation 2 lignes (« …est prête. ») ·
 *     eyebrow « RÉGULARITÉ AU TOUR · CIRCUIT » · chiffre roi ±X,XX s VIOLET 54px
 *     + sous-label tours · aperçu QDI 5 barres colorées · carte meilleur tour
 *     (OR) · bouton crème « Lire le bilan → » · bloc « PROCHAINE JOURNÉE ».
 *
 * Chiffre héros = régularité au tour (fait factuel). Le chrono record reste or,
 * discret. Vouvoiement. Substance conservée : statut boîtier, debug, déconnexion.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { SourceMethodBlock } from '@/components/InsightTransparency';
import {
  AnimatedPresence,
  BreathingGlow,
  FadeInSection,
  PressableScale,
  Stagger,
  useReduceMotion,
} from '@/components/motion';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { supabase } from '@/lib/supabase';
import { decidePaddockAction, type PaddockAction } from '@/services/paddockHeroLogic';
import { getMyAssignedDevice, type MyDevice } from '@/services/deviceHealthService';
import { getMyNextTrackDay, type NextTrackDay } from '@/services/nextTrackDayService';
import { getOrComputeQdiForSession, type QdiRecord } from '@/services/qdiService';
import { computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { formatChronoMs } from '@/utils/time';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { Card } from '@/ui/Card';
import { QdiBars } from '@/ui/QdiBars';
import { Screen } from '@/ui/Screen';
import { timeAgoFr, timeBasedGreeting } from '@/utils/time';

const { palette, fonts, spacing, radius, dataColors } = theme;

/** Légende QDI du panneau pédagogique — mêmes couleurs que QdiBars (une couleur
 *  = une donnée, système §4 handoff). */
const QDI_LEGEND = [
  { label: 'Trajectoire', color: dataColors.trajectory },
  { label: 'Fluidité', color: dataColors.flow },
  { label: 'Freinage', color: dataColors.brake },
  { label: 'Accélération', color: dataColors.accel },
  { label: 'Régularité', color: dataColors.regularity },
] as const;

interface RecentSession {
  id: string;
  startedAt: Date;
  circuitName: string | null;
}

export default function HomeHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const state = useAppStateStore((s) => s.state);

  const [recentSession, setRecentSession] = useState<RecentSession | null>(null);
  const [regularity, setRegularity] = useState<{ stdDevSeconds: number; lapCount: number } | null>(
    null
  );
  const [bestSeconds, setBestSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Hub : statut du boîtier + radar QDI + prochaine journée — best-effort.
  const [myDevice, setMyDevice] = useState<MyDevice | null>(null);
  const [qdi, setQdi] = useState<QdiRecord | null>(null);
  const [nextDay, setNextDay] = useState<NextTrackDay | null>(null);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    getMyAssignedDevice()
      .then((d) => {
        if (!cancelled) setMyDevice(d);
      })
      .catch(() => undefined);

    // Prochaine journée sur circuit (maquette §7.1) — bloc masqué si aucune.
    getMyNextTrackDay(profile.id)
      .then((d) => {
        if (!cancelled) setNextDay(d);
      })
      .catch(() => undefined);

    (async () => {
      const { data, error } = await supabase
        .from('telemetry_sessions')
        .select('id, started_at, circuit_name, best_lap_seconds')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data) {
        setRecentSession({
          id: data.id,
          startedAt: new Date(data.started_at),
          circuitName: data.circuit_name,
        });
        // Radar QDI — recalcul PARESSEUX (session rattrapée par le cron serveur
        // ou QDI d'un algo antérieur), comme la Signature. RLS own-row : seul
        // le propriétaire écrit ; ici c'est toujours lui.
        getOrComputeQdiForSession(data.id)
          .then((q) => {
            if (!cancelled) setQdi(q);
          })
          .catch(() => undefined);
        // Régularité au tour (écart-type) — même chaîne que l'écran Régularité.
        const laps = await fetchSessionLaps(data.id);
        if (!cancelled) {
          const reg = computeRegularity(
            laps
              .filter((l) => !l.is_outlap && !l.is_inlap)
              .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
          );
          if (reg.stdDevSeconds !== null) {
            setRegularity({ stdDevSeconds: reg.stdDevSeconds, lapCount: reg.lapCount });
          }
          // Repli sur l'agrégat de séance (écrit à la complétion) si les lignes
          // laps manquent — même chaîne que le Bilan et la carte trophée.
          const aggBest = (data as { best_lap_seconds?: number | null }).best_lap_seconds ?? null;
          setBestSeconds(reg.bestSeconds ?? aggBest);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const firstName = profile?.first_name ?? '';
  const greeting = timeBasedGreeting();

  // Action principale contextuelle (Paddock NG) : une seule, choisie selon
  // l'état pilote. « En 5 s, le pilote sait quoi faire. »
  const action = decidePaddockAction({
    state,
    hasRecentSession: !!recentSession,
    recentSessionId: recentSession?.id ?? null,
  });

  return (
    <Screen>
      {/* En-tête racine : insigne de marque (gauche) + accès Compte (droite). */}
      <View style={s.top}>
        <Logo size={26} />
        <AccountButton />
      </View>

      <View style={s.body}>
        {state === 'S5_approche' ? (
          <ModeEnroute />
        ) : state === 'S4_anticipation' ? (
          <ModeCountdown firstName={firstName} action={action} />
        ) : (
          <ModePassive
            greeting={greeting}
            firstName={firstName}
            recentSession={recentSession}
            regularity={regularity}
            bestSeconds={bestSeconds}
            loading={loading}
            action={action}
            myDevice={myDevice}
            qdi={qdi}
            nextDay={nextDay}
          />
        )}

        <View style={{ flex: 1, minHeight: spacing.xxl }} />

        <SpaceSwitcher current="pilot" />

        {__DEV__ ? (
          <Link href="/(app)/debug-capture" asChild>
            <PressableScale
              accessibilityRole="button"
              style={{
                minHeight: 44,
                marginBottom: spacing.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={s.footerLink}>Mode debug — capture UBX</Text>
            </PressableScale>
          </Link>
        ) : null}

        <PressableScale
          accessibilityRole="button"
          onPress={signOut}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={s.footerLink}>Se déconnecter</Text>
        </PressableScale>
      </View>
    </Screen>
  );
}

function ModeEnroute() {
  return (
    <View style={s.modeWrap}>
      <Text style={s.eyebrow}>En route</Text>
      <Text style={s.modeTitle}>Bon trajet.</Text>
      <Text style={s.modeManifest}>Coupez l'app. Je conduis.</Text>
    </View>
  );
}

function ModeCountdown({ firstName, action }: { firstName: string; action: PaddockAction | null }) {
  return (
    <Stagger style={s.modeWrap}>
      <Text style={s.eyebrow}>Prochaine séance</Text>
      <Text style={s.modeTitle}>{firstName ? `À bientôt, ${firstName}.` : 'À bientôt.'}</Text>
      <Text style={s.modeManifest}>L'app vous tiendra au courant.</Text>
      {action ? (
        <Link href={action.href as never} asChild>
          <PressableScale
            accessibilityRole="button"
            style={[s.primaryBtn, { marginTop: spacing.xl }]}
          >
            <Text style={s.primaryBtnText}>{action.label}</Text>
          </PressableScale>
        </Link>
      ) : null}
    </Stagger>
  );
}

/**
 * « Votre séance de vendredi » — jour en toutes lettres, UNIQUEMENT si la séance
 * a moins de 7 jours (au-delà, « de vendredi » deviendrait trompeur).
 */
function recentWeekdayOf(date: Date): string | null {
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  if (ageDays >= 7) return null;
  return date.toLocaleDateString('fr-FR', { weekday: 'long' });
}

/** « Sam. 19 juil. » — date courte du bloc « Prochaine journée ». */
function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function ModePassive({
  greeting,
  firstName,
  recentSession,
  regularity,
  bestSeconds,
  loading,
  action,
  myDevice,
  qdi,
  nextDay,
}: {
  greeting: string;
  firstName: string;
  recentSession: RecentSession | null;
  regularity: { stdDevSeconds: number; lapCount: number } | null;
  bestSeconds: number | null;
  loading: boolean;
  action: PaddockAction | null;
  myDevice: MyDevice | null;
  qdi: QdiRecord | null;
  nextDay: NextTrackDay | null;
}) {
  const greetingText = firstName ? `${greeting} ${firstName}.` : `${greeting}.`;

  return (
    <View style={{ marginTop: spacing.md }}>
      {/* Salutation 2 lignes (maquette) : « Bonsoir Adrien. Votre séance de
          vendredi est prête. » — « prête. » accentué. */}
      <FadeInSection>
        <Text style={s.greetTitle}>
          {greetingText}
          {recentSession ? (
            <>
              {' '}
              {(() => {
                const day = recentWeekdayOf(recentSession.startedAt);
                return day ? `Votre séance de ${day} est ` : 'Votre dernière séance est ';
              })()}
              <Text style={s.greetStrong}>prête.</Text>
            </>
          ) : null}
        </Text>
      </FadeInSection>

      {loading ? (
        <View
          style={s.bilanSkeleton}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Chargement de votre dernier bilan"
        >
          <View style={s.skelLineWide} />
          <View style={[s.skelLine, { marginTop: spacing.sm }]} />
        </View>
      ) : recentSession ? (
        <>
          {/* HÉROS — régularité au tour, chiffre roi VIOLET 54px (maquette). */}
          <FadeInSection delay={60}>
            <Text style={s.regEyebrow} numberOfLines={1}>
              RÉGULARITÉ AU TOUR
              {recentSession.circuitName ? ` · ${recentSession.circuitName.toUpperCase()}` : ''}
            </Text>
            {regularity ? (
              <>
                <RegularityKingNumber stdDevSeconds={regularity.stdDevSeconds} />
                <Text style={s.regSub}>{regularity.lapCount} tours lancés</Text>
                {/* Lecture (retour build 23) — ce qu'on regarde, en une phrase.
                    Descriptif, jamais prescriptif. */}
                <Text style={s.lectureLine}>
                  Votre régularité : l&apos;écart entre vos tours (écart-type). Plus il est petit,
                  plus vous êtes constant.
                </Text>
              </>
            ) : (
              <Text style={s.regSub}>{timeAgoFr(recentSession.startedAt)}</Text>
            )}
          </FadeInSection>

          {/* Aperçu QDI — 5 barres colorées (silhouette, pas un score). */}
          {qdi ? (
            <FadeInSection delay={120}>
              <View style={{ marginTop: spacing.xl }}>
                <QdiBars branches={qdi} height={54} />
              </View>
            </FadeInSection>
          ) : null}

          {/* Carte meilleur tour — l'unique OR du Paddock (chrono/record). */}
          {bestSeconds != null ? (
            <FadeInSection delay={160}>
              <Link
                href={{ pathname: '/(app)/bilan', params: { sessionId: recentSession.id } }}
                asChild
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Votre meilleur tour, ${formatChronoMs(bestSeconds * 1000)}`}
                  style={s.bestCard}
                >
                  <View style={s.goldDot} />
                  <Text style={s.bestLabel}>Votre meilleur tour</Text>
                  <Text style={s.bestDash}> — </Text>
                  <Text style={s.bestChrono}>{formatChronoMs(bestSeconds * 1000)}</Text>
                </PressableScale>
              </Link>
            </FadeInSection>
          ) : null}

          {/* Pédagogie (retour build 23 : « élevé mais pas très compréhensible »)
              — comment lire, repliable, état local, jamais un modal. */}
          <FadeInSection delay={180}>
            <HowToRead>
              {regularity ? (
                <HowRow color={dataColors.regularity}>
                  Le grand chiffre violet est votre régularité au tour : l&apos;écart-type de vos
                  tours lancés, en secondes. Les tours lancés excluent la sortie et la rentrée des
                  stands.
                </HowRow>
              ) : null}
              {qdi ? (
                <>
                  <HowRow>
                    Les cinq barres dessinent votre QDI : cinq facettes de la séance, une couleur
                    par donnée, la hauteur suit la valeur mesurée. Une silhouette, pas un score — «
                    point fort » marque la plus haute.
                  </HowRow>
                  <HowLegend items={QDI_LEGEND} />
                </>
              ) : null}
              {bestSeconds != null ? (
                <HowRow color={palette.gold}>
                  L&apos;or est réservé au chrono : la carte « Votre meilleur tour », rien
                  d&apos;autre.
                </HowRow>
              ) : null}
              <SourceMethodBlock
                items={[
                  'Ces chiffres viennent de votre dernière séance close, enregistrée par le boîtier (GPS et capteurs inertiels, 25 points par seconde).',
                  'La référence est vous, uniquement — aucun autre pilote, aucun classement.',
                ]}
              />
            </HowToRead>
          </FadeInSection>
        </>
      ) : (
        <Text style={s.emptyManifest}>Votre première séance écrira la première ligne.</Text>
      )}

      {/* Action principale contextuelle — bouton plein crème (maquette). */}
      <FadeInSection delay={200}>
        {action?.hint ? <Text style={s.actionHint}>{action.hint}</Text> : null}
        {action ? (
          <Link href={action.href as never} asChild>
            <PressableScale
              accessibilityRole="button"
              style={[s.primaryBtn, action.hint ? { marginTop: spacing.md } : null]}
            >
              <Text style={s.primaryBtnText}>{action.label} →</Text>
            </PressableScale>
          </Link>
        ) : null}
      </FadeInSection>

      {/* PROCHAINE JOURNÉE (maquette) — séparateur + date + « Préparer › ». */}
      {nextDay ? (
        <FadeInSection delay={240}>
          <View style={s.nextSeparator} />
          <Link href={'/(app)/preparation' as never} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Prochaine journée, ${shortDay(nextDay.date)}. Préparer`}
              style={s.nextRow}
            >
              <View>
                <Text style={s.nextEyebrow}>PROCHAINE JOURNÉE</Text>
                <Text style={s.nextDate}>
                  {shortDay(nextDay.date)}
                  {nextDay.circuitName ? ` · ${nextDay.circuitName}` : ''}
                </Text>
              </View>
              <Text style={s.nextAction}>Préparer ›</Text>
            </PressableScale>
          </Link>
        </FadeInSection>
      ) : null}

      {/* Statut équipement — information, sous la ligne de flottaison. */}
      {myDevice ? (
        <FadeInSection delay={280}>
          <Link href={'/(app)/mon-equipement' as never} asChild>
            <Card
              onPress={() => {}}
              accessibilityLabel={`Votre boîtier ${myDevice.alias ?? myDevice.label}, état ${myDevice.healthStatus ?? 'inconnu'}`}
              style={{ marginTop: spacing.xl }}
            >
              <Text style={[s.eyebrow, { marginBottom: spacing.xs }]}>Votre boîtier</Text>
              <Text style={s.deviceLine}>
                {myDevice.alias ?? myDevice.label}
                {[myDevice.batteryStatus, myDevice.healthStatus].filter(Boolean).length > 0
                  ? ` · ${[myDevice.batteryStatus, myDevice.healthStatus].filter(Boolean).join(' · ')}`
                  : ''}
              </Text>
            </Card>
          </Link>
        </FadeInSection>
      ) : null}
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pédagogie (retour fondateur build 23 : « élevé mais pas très compréhensible »).
   Composants LOCAUX à l'écran — le périmètre du chantier ne touche pas aux
   composants partagés. Descriptif uniquement : ce que ça montre, jamais quoi
   faire. Aucune donnée ni logique modifiée — lisibilité et motion seulement.
   ───────────────────────────────────────────────────────────────────────────── */

/** « 0,42 » — format français (virgule), N décimales. */
function fmtFr(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',');
}

/**
 * Chiffre roi qui COMPTE : de 0 vers la valeur réelle (ease-out cubic, ~900 ms).
 * La destination est la donnée ; l'animation n'est qu'un chemin vers elle.
 * Respecte « Réduire les animations » (rendu direct, WCAG 2.3.3).
 */
function useCountUpFr(value: number, decimals: number, duration = 900): string {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(() => fmtFr(0, decimals));
  useEffect(() => {
    if (reduceMotion) {
      setDisplay(fmtFr(value, decimals));
      return;
    }
    const listener = progress.addListener(({ value: p }) => setDisplay(fmtFr(p * value, decimals)));
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [value, decimals, duration, reduceMotion, progress]);
  return display;
}

/** Le chiffre roi violet (régularité) — se construit à l'apparition, puis
 *  respire discrètement (BreathingGlow : l'unique respiration de l'écran). */
function RegularityKingNumber({ stdDevSeconds }: { stdDevSeconds: number }) {
  const display = useCountUpFr(stdDevSeconds, 2);
  return (
    <BreathingGlow>
      <Text
        style={s.regNumber}
        accessibilityLabel={`Régularité au tour : plus ou moins ${fmtFr(stdDevSeconds, 2)} secondes`}
      >
        ±{display}
        <Text style={s.regUnit}> s</Text>
      </Text>
    </BreathingGlow>
  );
}

/** Affordance fine « Comment lire cet écran » → panneau repliable (AnimatedPresence). */
function HowToRead({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: spacing.lg }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={theme.hitSlop}
        onPress={() => setOpen((o) => !o)}
        style={s.howBtn}
      >
        <Text style={s.howLabel}>Comment lire cet écran</Text>
        <Text style={[s.howChevron, open ? s.howChevronOpen : null]}>›</Text>
      </PressableScale>
      <AnimatedPresence visible={open}>
        <View style={s.howPanel}>{children}</View>
      </AnimatedPresence>
    </View>
  );
}

/** Une ligne du panneau : pastille de couleur (optionnelle) + phrase factuelle. */
function HowRow({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <View style={s.howRow}>
      {color ? <View style={[s.howDot, { backgroundColor: color }]} /> : null}
      <Text style={s.howText}>{children}</Text>
    </View>
  );
}

/** Légende compacte : une pastille + un libellé par donnée, dans SA couleur. */
function HowLegend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <View style={s.howLegendWrap}>
      {items.map((it) => (
        <View key={it.label} style={s.howLegendItem}>
          <View style={[s.howLegendDot, { backgroundColor: it.color }]} />
          <Text style={[s.howLegendTxt, { color: it.color }]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Eyebrow : info utile (« Votre dernier bilan », « Explorer », mode courant).
  // creamMute (≈ 6.4:1 sur night) pour passer WCAG AA, là où faint échouait.
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },

  // Salutation 20px, 2 lignes (maquette §7.1) — « prête. » accentué.
  greetTitle: {
    fontFamily: fonts.body,
    fontSize: 20,
    letterSpacing: -0.2,
    lineHeight: 28,
    color: palette.cream,
    marginTop: 2,
  },
  greetStrong: { fontFamily: fonts.bodySemi, color: palette.cream },

  // Héros régularité — chiffre roi violet 54px (couleur de la donnée).
  regEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginTop: spacing.xxl,
  },
  regNumber: {
    fontFamily: fonts.king,
    fontSize: 54,
    letterSpacing: -1.5,
    color: dataColors.regularity,
    marginTop: spacing.sm,
  },
  // Unité atténuée (maquette : « s » gris, plus petit que les chiffres).
  regUnit: { fontFamily: fonts.mono, fontSize: 20, letterSpacing: 0, color: palette.creamMute },
  regSub: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.eyebrow,
    marginTop: spacing.xs,
  },
  // Ligne de lecture (build 23) : dit ce qu'on regarde, en une phrase simple.
  lectureLine: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.55,
    marginTop: spacing.sm,
  },
  // « Comment lire cet écran » — affordance fine + panneau sobre.
  howBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  howLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  howChevron: { fontFamily: fonts.body, fontSize: 16, color: palette.creamMute },
  howChevronOpen: { transform: [{ rotate: '90deg' }] },
  howPanel: { gap: spacing.sm, paddingBottom: spacing.xs },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  howDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  howText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.55,
  },
  howLegendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  howLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  howLegendDot: { width: 7, height: 7, borderRadius: 4 },
  howLegendTxt: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.6 },

  // Carte meilleur tour — pastille + chrono OR (l'unique or du Paddock).
  bestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  goldDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold },
  bestLabel: { fontFamily: fonts.bodyMedium, fontSize: theme.fontSize.body, color: palette.cream },
  bestDash: { fontFamily: fonts.body, fontSize: theme.fontSize.body, color: palette.creamMute },
  bestChrono: {
    fontFamily: fonts.monoSemi,
    fontSize: theme.fontSize.bodyLg,
    letterSpacing: -0.3,
    color: palette.gold,
  },

  // Prochaine journée — séparateur + eyebrow + date + « Préparer › ».
  nextSeparator: {
    height: 1,
    backgroundColor: palette.separator,
    marginTop: spacing.xxl,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    minHeight: 56,
  },
  nextEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  nextDate: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
    marginTop: 3,
  },
  nextAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
  },
  deviceLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: palette.creamSoft,
  },
  // Squelette de chargement du dernier bilan : réserve l'espace, calme, sans saut.
  bilanSkeleton: {
    backgroundColor: palette.card2,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: palette.line,
  },
  skelLineWide: { height: 18, width: '55%', borderRadius: 6, backgroundColor: palette.line },
  skelLine: { height: 12, width: '35%', borderRadius: 6, backgroundColor: palette.line },

  emptyManifest: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.xl,
  },

  // Action principale contextuelle (maquette : crème quasi-pilule, texte sombre).
  primaryBtn: {
    backgroundColor: palette.cream,
    borderRadius: 27,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  primaryBtnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: palette.night },
  // Hint contextuel (Paddock NG) : situe le moment, calme et factuel. Light
  // italic, jamais une consigne.
  actionHint: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic',
    color: palette.creamSoft,
    marginTop: spacing.xxl,
    lineHeight: theme.fontSize.small * 1.5,
  },
  // Modes de flux (S5 silence en piste / S4 prochaine session)
  modeWrap: { marginTop: spacing.xxl * 2 },
  modeTitle: {
    fontFamily: fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: -0.3,
    color: palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: spacing.md,
  },
  modeManifest: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.lg,
  },

  footerLink: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: palette.creamMute },
});
