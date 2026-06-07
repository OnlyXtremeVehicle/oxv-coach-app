/**
 * Vue Coach — hub principal : liste des pilotes assignés.
 *
 * Affiche les pilotes que le coach courant suit, filtrés par RLS via
 * `coach_pilots_view` (seulement actifs ET consentis).
 *
 * Doctrine coach :
 *   - Vouvoiement systématique (le coach est un pro, pas un pote)
 *   - Pas d'instruction au coach non plus — l'app est un miroir pour lui
 *     aussi (il voit ce que le pilote vit, il interprète seul)
 *   - Lecture seule partout (pas de bouton "modifier", "noter", etc.)
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import {
  type CoachDashboardSummary,
  type CoachPilotRow,
  listMyPilots,
  loadCoachDashboardSummary,
} from '@/services/coachService';
import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort } from '@/utils/format';

export default function CoachHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { permissions } = useCoachPermissions();
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [summary, setSummary] = useState<CoachDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMyPilots(), loadCoachDashboardSummary()]).then(([rows, s]) => {
      if (!cancelled) {
        setPilots(rows);
        setSummary(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = profile?.first_name ? `Bonjour ${profile.first_name}` : 'Bonjour';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>COACH OXV</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          {greeting}.
        </Text>
        <Text
          style={[typography.manifest, { color: colors.text.secondary, marginBottom: spacing.xxl }]}
        >
          Vos pilotes, à votre rythme.
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : pilots.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Bandeau alerte : nouvelles sessions à voir (24h) */}
            {summary && summary.lastDaySessionCount > 0 ? (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: 0.5,
                  borderColor: colors.accent.coach,
                  backgroundColor: colors.background.elevated,
                  marginBottom: spacing.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.accent.coach,
                  }}
                />
                <Text style={{ color: colors.text.primary, fontSize: fontSize.body, flex: 1 }}>
                  {summary.lastDaySessionCount === 1
                    ? '1 nouvelle session dans les dernières 24 h.'
                    : `${summary.lastDaySessionCount} nouvelles sessions dans les dernières 24 h.`}
                </Text>
              </View>
            ) : null}

            {/* Stats globales sobres */}
            {summary ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.xs,
                  marginBottom: spacing.xl,
                }}
              >
                <DashStat
                  value={summary.pilotCount.toString()}
                  label={summary.pilotCount > 1 ? 'pilotes' : 'pilote'}
                />
                <DashStat
                  value={summary.recentSessionCount.toString()}
                  label={`session${summary.recentSessionCount > 1 ? 's' : ''} sur ${summary.recentSessionsDays}j`}
                />
                <DashStat
                  value={summary.sharedAnnotationCount.toString()}
                  label={`note${summary.sharedAnnotationCount > 1 ? 's' : ''} partagée${summary.sharedAnnotationCount > 1 ? 's' : ''}`}
                />
              </View>
            ) : null}

            {/* Brouillons rappel sobre */}
            {summary && summary.draftAnnotationCount > 0 ? (
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.text.tertiary,
                    marginBottom: spacing.xl,
                    fontStyle: 'italic',
                  },
                ]}
              >
                {summary.draftAnnotationCount === 1
                  ? '1 note en brouillon en attente de partage.'
                  : `${summary.draftAnnotationCount} notes en brouillon en attente de partage.`}
              </Text>
            ) : null}

            <Text
              style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
            >
              {pilots.length} {pilots.length === 1 ? 'PILOTE' : 'PILOTES'}
            </Text>
            <View style={{ gap: spacing.md }}>
              {pilots.map((pilot) => (
                <PilotCard key={pilot.pilotId} pilot={pilot} />
              ))}
            </View>

            {/* CTA comparatif 2 pilotes — gaté par la permission view_pilots
                (§8.1) et visible si au moins 2 pilotes suivis */}
            {permissions.canViewPilots && pilots.length >= 2 ? (
              <Link href={'/(coach)/comparer-pilotes' as never} asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    marginTop: spacing.lg,
                    padding: spacing.lg,
                    borderRadius: borderRadius.md,
                    borderWidth: 0.5,
                    borderColor: colors.accent.coach,
                    alignItems: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.accent.coach,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    Comparer deux pilotes
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </>
        )}

        {/* Gestion des roulages — gatée par la permission manage_own_sessions
            (§8). Visible hors du bloc pilotes : un coach peut préparer un
            roulage avant d'avoir des pilotes à convier. */}
        {permissions.canManageOwnSessions ? (
          <Link href={'/(coach)/roulages' as never} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: spacing.lg,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.accent.coach,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.accent.coach,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
                }}
              >
                Mes roulages
              </Text>
            </Pressable>
          </Link>
        ) : null}

        {/* Tableau de bord business — gaté par can_view_business_dashboard (§10.2). */}
        {permissions.canViewBusinessDashboard ? (
          <Link href={'/(coach)/business' as never} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: spacing.md,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.accent.coach,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.accent.coach,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
                }}
              >
                Tableau de bord
              </Text>
            </Pressable>
          </Link>
        ) : null}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={signOut}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Se déconnecter
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PilotCard({ pilot }: { pilot: CoachPilotRow }) {
  const fullName = [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote';
  const level = prettyLevel(pilot.pilotLevel);

  return (
    <Link
      // Cast nécessaire le temps que les typed routes Expo se régénèrent
      href={
        {
          pathname: '/(coach)/pilote/[id]',
          params: { id: pilot.pilotId },
        } as never
      }
      asChild
    >
      <Pressable
        style={({ pressed }) => ({
          padding: spacing.xl,
          borderRadius: borderRadius.lg,
          borderWidth: 0.5,
          borderColor: colors.accent.coach,
          backgroundColor: colors.background.secondary,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.title,
            fontWeight: fontWeight.light,
            marginBottom: spacing.xs,
          }}
        >
          {fullName}
        </Text>
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          {level} · Assigné le {formatDateShort(pilot.assignedAt)}
        </Text>
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        padding: spacing.xxl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
        Aucun pilote assigné pour l'instant.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Les assignations sont gérées par l'équipe OXV. Un pilote doit aussi consentir au coaching
        avant que vous voyiez ses données.
      </Text>
    </View>
  );
}

function prettyLevel(level: string | null): string {
  switch (level) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Apprivoisé';
    case 'confirme':
      return 'Confirmé';
    case 'expert':
      return 'Expert';
    default:
      return 'Niveau —';
  }
}

function DashStat({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.titleLarge,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {value}
      </Text>
      <Text
        style={[
          typography.eyebrow,
          {
            color: colors.text.tertiary,
            marginTop: spacing.xs,
            textAlign: 'center',
          },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
