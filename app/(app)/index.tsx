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

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { FadeInSection } from '@/components/motion';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { supabase } from '@/lib/supabase';
import { decidePaddockAction, type PaddockAction } from '@/services/paddockHeroLogic';
import { getMyAssignedDevice, type MyDevice } from '@/services/deviceHealthService';
import { getMyNextTrackDay, type NextTrackDay } from '@/services/nextTrackDayService';
import { getQdiForSession, type QdiRecord } from '@/services/qdiService';
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
        .select('id, started_at, circuit_name')
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
        // Radar QDI de cette session (lecture seule — le calcul vit ailleurs).
        getQdiForSession(data.id)
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
          if (reg.bestSeconds != null) setBestSeconds(reg.bestSeconds);
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
            <Pressable
              accessibilityRole="button"
              style={{
                minHeight: 44,
                marginBottom: spacing.sm,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={s.footerLink}>Mode debug — capture UBX</Text>
            </Pressable>
          </Link>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          style={({ pressed }) => ({
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.footerLink}>Se déconnecter</Text>
        </Pressable>
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
    <View style={s.modeWrap}>
      <Text style={s.eyebrow}>Prochaine séance</Text>
      <Text style={s.modeTitle}>{firstName ? `À bientôt, ${firstName}.` : 'À bientôt.'}</Text>
      <Text style={s.modeManifest}>L'app vous tiendra au courant.</Text>
      {action ? (
        <Link href={action.href as never} asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              s.primaryBtn,
              { marginTop: spacing.xl, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={s.primaryBtnText}>{action.label}</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
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
                <Text style={s.regNumber}>
                  ±{regularity.stdDevSeconds.toFixed(2).replace('.', ',')}
                  <Text style={s.regUnit}> s</Text>
                </Text>
                <Text style={s.regSub}>{regularity.lapCount} tours</Text>
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Votre meilleur tour, ${formatChronoMs(bestSeconds * 1000)}`}
                  style={({ pressed }) => [s.bestCard, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <View style={s.goldDot} />
                  <Text style={s.bestLabel}>Votre meilleur tour</Text>
                  <Text style={s.bestDash}> — </Text>
                  <Text style={s.bestChrono}>{formatChronoMs(bestSeconds * 1000)}</Text>
                </Pressable>
              </Link>
            </FadeInSection>
          ) : null}
        </>
      ) : (
        <Text style={s.emptyManifest}>Votre première séance écrira la première ligne.</Text>
      )}

      {/* Action principale contextuelle — bouton plein crème (maquette). */}
      <FadeInSection delay={200}>
        {action?.hint ? <Text style={s.actionHint}>{action.hint}</Text> : null}
        {action ? (
          <Link href={action.href as never} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                s.primaryBtn,
                action.hint ? { marginTop: spacing.md } : null,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={s.primaryBtnText}>{action.label} →</Text>
            </Pressable>
          </Link>
        ) : null}
      </FadeInSection>

      {/* PROCHAINE JOURNÉE (maquette) — séparateur + date + « Préparer › ». */}
      {nextDay ? (
        <FadeInSection delay={240}>
          <View style={s.nextSeparator} />
          <Link href={'/(app)/preparation' as never} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Prochaine journée, ${shortDay(nextDay.date)}. Préparer`}
              style={({ pressed }) => [s.nextRow, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View>
                <Text style={s.nextEyebrow}>PROCHAINE JOURNÉE</Text>
                <Text style={s.nextDate}>
                  {shortDay(nextDay.date)}
                  {nextDay.circuitName ? ` · ${nextDay.circuitName}` : ''}
                </Text>
              </View>
              <Text style={s.nextAction}>Préparer ›</Text>
            </Pressable>
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
