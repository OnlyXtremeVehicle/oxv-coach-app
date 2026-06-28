/**
 * Écran #20 — Accueil / Hub central, 3 modes. Refonte (docs/refonte-app, archétype 2 « Hub »).
 *
 *   mode "enroute"   (S5)  — silence en piste : « Coupez l'app. Je conduis. »
 *   mode "countdown" (S4)  — prochaine session
 *   mode "passive"   (autres) — greeting + dernier bilan + 1 action principale
 *                              contextuelle + 2 raccourcis (PR 2). La liste
 *                              « Tout le paddock » a été retirée (PR migration) :
 *                              la nav vit dans les 5 zones + le hub Compte (icône).
 *
 * Chiffre héros = régularité au tour (écart-type, fait factuel), pas la marge
 * globale (réservée au Bilan). Réutilise computeRegularity + fetchSessionLaps.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { GaugeInstrument } from '@/components/instruments';
import { FadeInSection } from '@/components/motion';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { supabase } from '@/lib/supabase';
import { computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { timeAgoFr, timeBasedGreeting } from '@/utils/time';

const { palette, fonts, spacing, radius } = theme;

interface RecentSession {
  id: string;
  startedAt: Date;
  circuitName: string | null;
}

// Raccourcis contextuels (2 max, doctrine Paddock — cf. ticket 11 B1). Les 5
// zones vivent désormais dans la barre d'onglets (PR 1) ; ici, juste l'essentiel
// à portée du pouce, sous l'action principale.
const SHORTCUTS = [
  { label: 'Ma progression', href: '/(app)/progression' },
  { label: 'Mon coach', href: '/(app)/mon-coach' },
] as const;

export default function HomeHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const state = useAppStateStore((s) => s.state);

  const [recentSession, setRecentSession] = useState<RecentSession | null>(null);
  const [regularity, setRegularity] = useState<{ stdDevSeconds: number; lapCount: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

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
          <ModeCountdown firstName={firstName} />
        ) : (
          <ModePassive
            greeting={greeting}
            firstName={firstName}
            recentSession={recentSession}
            regularity={regularity}
            loading={loading}
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

function ModeCountdown({ firstName }: { firstName: string }) {
  return (
    <View style={s.modeWrap}>
      <Text style={s.eyebrow}>Prochaine session</Text>
      <Text style={s.modeTitle}>{firstName ? `À bientôt, ${firstName}.` : 'À bientôt.'}</Text>
      <Text style={s.modeManifest}>L'app vous tiendra au courant.</Text>
    </View>
  );
}

function ModePassive({
  greeting,
  firstName,
  recentSession,
  regularity,
  loading,
}: {
  greeting: string;
  firstName: string;
  recentSession: RecentSession | null;
  regularity: { stdDevSeconds: number; lapCount: number } | null;
  loading: boolean;
}) {
  const greetingText = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  return (
    <View style={{ marginTop: spacing.md }}>
      {/* Salutation */}
      <FadeInSection>
        <Text style={[s.eyebrow, { marginBottom: spacing.sm }]}>Paddock</Text>
        <Text style={s.greetTitle}>{greetingText}</Text>
      </FadeInSection>

      {/* Dernier bilan — porte d'entrée vers le débrief, chiffre déjà visible.
          Entre dans la chorégraphie d'apparition (greeting → bilan → action).
          Pendant le chargement : squelette calme plutôt qu'un saut de mise en page. */}
      <FadeInSection delay={60}>
        {loading ? (
          <View style={s.bilanSkeleton} accessibilityLabel="Chargement de votre dernier bilan">
            <Text style={[s.eyebrow, { marginBottom: spacing.md }]}>Votre dernier bilan</Text>
            <View style={s.skelLineWide} />
            <View style={[s.skelLine, { marginTop: spacing.sm }]} />
          </View>
        ) : recentSession ? (
          <Link
            href={{ pathname: '/(app)/bilan', params: { sessionId: recentSession.id } }}
            asChild
          >
            <Card
              onPress={() => {}}
              accessibilityLabel={`Votre dernier bilan, ${recentSession.circuitName ?? 'session'}, ${timeAgoFr(
                recentSession.startedAt
              )}`}
              style={s.bilan}
            >
              <Text style={s.bilanChevron}>›</Text>
              <Text style={[s.eyebrow, { marginBottom: spacing.md }]}>Votre dernier bilan</Text>
              <View style={s.bilanRow}>
                {regularity ? (
                  <GaugeInstrument
                    value={regularity.stdDevSeconds}
                    min={0}
                    max={Math.max(3, regularity.stdDevSeconds * 1.25)}
                    unit="s"
                    formatValue={(v) => v.toFixed(1).replace('.', ',')}
                    size={104}
                    majorTicks={4}
                    minorPerMajor={1}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.bilanCircuit}>{recentSession.circuitName ?? 'Session'}</Text>
                  <Text style={s.bilanMeta}>{timeAgoFr(recentSession.startedAt)}</Text>
                  {regularity ? (
                    <Text style={s.bilanReg}>Régularité au tour · {regularity.lapCount} tours</Text>
                  ) : null}
                </View>
              </View>
            </Card>
          </Link>
        ) : (
          <Text style={s.emptyManifest}>Votre première session écrira la première ligne.</Text>
        )}
      </FadeInSection>

      {/* Action principale contextuelle (§B1) + 2 raccourcis ghost. */}
      <FadeInSection delay={120}>
        <Link
          href={
            (recentSession
              ? { pathname: '/(app)/bilan', params: { sessionId: recentSession.id } }
              : '/(app)/session') as never
          }
          asChild
        >
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={s.primaryBtnText}>
              {recentSession ? 'Découvrir mon bilan' : 'Préparer ma session'}
            </Text>
          </Pressable>
        </Link>
        <View style={s.shortcutRow}>
          {SHORTCUTS.map((sc) => (
            <Link key={sc.href} href={sc.href as never} asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [s.ghost, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={s.ghostText}>{sc.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </FadeInSection>
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

  greetTitle: {
    fontFamily: fonts.display,
    fontSize: 25,
    letterSpacing: -0.5,
    color: palette.cream,
    marginTop: 2,
  },

  // Dernier bilan (carte héros — chiffre dominant unique). Surcharge la carte du
  // kit : carte2 + rayon xl + halo doré discret (donnée), padding sur grille.
  bilan: {
    backgroundColor: palette.card2,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  bilanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: 4,
  },
  bilanReg: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    // creamMute (et non faint) : ce libellé porte une donnée (régularité) — lisible AA.
    color: palette.creamMute,
    marginTop: 8,
    lineHeight: 15,
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
  bilanChevron: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    color: palette.creamMute,
    fontSize: 22,
  },
  bilanCircuit: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: -0.2,
    color: palette.cream,
  },
  bilanMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: 5,
  },

  emptyManifest: {
    fontFamily: fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.xl,
  },

  // Action principale contextuelle (canon : crème pleine largeur, texte sombre).
  primaryBtn: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  primaryBtnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: '#050505' },
  shortcutRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  ghost: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.lg,
  },
  ghostText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.creamMute,
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
