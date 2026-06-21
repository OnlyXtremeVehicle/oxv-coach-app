/**
 * Écran #20 — Accueil / Hub central, 3 modes. Design V2 (charte oxv-mirror-app).
 *
 *   mode "enroute"   (S5)  — "Bon trajet vers Beltoise. Coupez l'app. Je conduis."
 *   mode "countdown" (S4)  — prochaine session
 *   mode "passive"   (autres) — greeting + dernier bilan + navigation
 *
 * Reskin V2 : Screen + AppBar (Logo), titres Syncopate, Card/SectionLabel/Fact
 * du kit. Logique inchangée (data, modes, SpaceSwitcher, déconnexion).
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { supabase } from '@/lib/supabase';
import { getAnalysisForSession } from '@/services/analysesService';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { timeAgoFr, timeBasedGreeting } from '@/utils/time';

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
  const [synthese, setSynthese] = useState<{ marginGlobal: number } | null>(null);
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
        const analysis = await getAnalysisForSession(data.id);
        if (!cancelled && analysis) {
          setSynthese({ marginGlobal: analysis.marginGlobal });
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
      <AppBar title="OXV MIRROR" leading={<Logo size={26} />} />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        {state === 'S5_approche' ? (
          <ModeEnroute />
        ) : state === 'S4_anticipation' ? (
          <ModeCountdown firstName={firstName} />
        ) : (
          <ModePassive
            greeting={greeting}
            firstName={firstName}
            recentSession={recentSession}
            synthese={synthese}
            loading={loading}
          />
        )}

        <View style={{ flex: 1, minHeight: theme.spacing.xxl }} />

        <SpaceSwitcher current="pilot" />

        {__DEV__ ? (
          <Link href="/(app)/debug-capture" asChild>
            <Pressable style={{ marginBottom: theme.spacing.lg, alignItems: 'center' }}>
              <Text style={styles.minorLink}>Mode debug — capture UBX</Text>
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
          <Text style={styles.minorLink}>Se déconnecter</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function ModeEnroute() {
  return (
    <View style={{ marginTop: theme.spacing.xxl * 3 }}>
      <Text style={styles.eyebrow}>EN ROUTE</Text>
      <Text style={styles.title}>Bon trajet vers Beltoise.</Text>
      <Text style={styles.manifest}>Coupez l'app. Je conduis.</Text>
    </View>
  );
}

function ModeCountdown({ firstName }: { firstName: string }) {
  return (
    <View style={{ marginTop: theme.spacing.xxl * 3 }}>
      <Text style={styles.eyebrow}>PROCHAINE SESSION</Text>
      <Text style={styles.title}>{firstName ? `À bientôt, ${firstName}.` : 'À bientôt.'}</Text>
      <Text style={styles.manifest}>L'app vous tiendra au courant.</Text>
    </View>
  );
}

function ModePassive({
  greeting,
  firstName,
  recentSession,
  synthese,
  loading,
}: {
  greeting: string;
  firstName: string;
  recentSession: RecentSession | null;
  synthese: { marginGlobal: number } | null;
  loading: boolean;
}) {
  const greetingText = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <Text style={styles.title}>{greetingText}</Text>

      {loading ? null : recentSession ? (
        <Link href={{ pathname: '/(app)/bilan', params: { sessionId: recentSession.id } }} asChild>
          <Pressable
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: theme.spacing.xl })}
          >
            <Card>
              <SectionLabel>Votre dernier bilan</SectionLabel>
              <Text style={styles.cardTitle}>{recentSession.circuitName ?? 'Session'}</Text>
              <Text style={styles.cardMeta}>{timeAgoFr(recentSession.startedAt)}</Text>
              {synthese ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: theme.spacing.sm,
                    marginTop: theme.spacing.md,
                  }}
                >
                  <Fact
                    label="Marge globale"
                    value={String(Math.round(synthese.marginGlobal))}
                    unit="%"
                  />
                </View>
              ) : null}
            </Card>
          </Pressable>
        </Link>
      ) : (
        <Text style={[styles.manifest, { marginTop: theme.spacing.xl }]}>
          Votre première session écrira la première ligne.
        </Text>
      )}

      {/* Hub central (#20) — porte d'entrée vers l'app, accessible SANS session. */}
      <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
        <SectionLabel>Navigation</SectionLabel>
        <NavRow label="Mon bilan" hint="Votre dernière analyse" href="/(app)/bilan" />
        <NavRow
          label="Débrief présentiel"
          hint="La séance, en détail"
          href="/(app)/debrief-presentiel"
        />
        <NavRow label="Ma progression" hint="Votre fil dans le temps" href="/(app)/progression" />
        <NavRow label="Mes objectifs" hint="Vos repères personnels" href="/(app)/objectifs" />
        <NavRow label="Mon équipement" hint="Connecter le boîtier" href="/(app)/equipement" />
        <NavRow label="Carte des circuits" hint="Préparer vos sorties" href="/(app)/circuits" />
        <NavRow label="Lieux & partenaires" hint="Autour des circuits" href="/(app)/lieux" />
        <NavRow label="Notifications" hint="À traiter, à découvrir" href="/(app)/notifications" />
        <NavRow label="Réglages" hint="Compte, notifications, données" href="/(app)/settings" />
        {__DEV__ ? (
          <NavRow
            label="Aperçu du tracé 3D"
            hint="Démonstration — Haute Saintonge"
            href="/(app)/debug-circuit"
          />
        ) : null}
      </View>
    </View>
  );
}

function NavRow({ label, hint, href }: { label: string; hint: string; href: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Card
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.cardMeta}>{hint}</Text>
          </View>
          <Text style={{ color: theme.palette.creamMute, fontSize: 18 }}>›</Text>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.gold,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.lg,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  cardMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
