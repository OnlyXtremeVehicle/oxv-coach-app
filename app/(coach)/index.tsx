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
 *
 * Reskin V2 : Screen + AppBar (Logo), Card/SectionLabel/Fact du kit. Accent
 * coach = theme.palette.coach (crème neutre). Logique inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import {
  type CoachDashboardSummary,
  type CoachPilotRow,
  listMyPilots,
  loadCoachDashboardSummary,
} from '@/services/coachService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
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
    Promise.all([listMyPilots(), loadCoachDashboardSummary()])
      .then(([rows, s]) => {
        if (!cancelled) {
          setPilots(rows);
          setSummary(s);
          setLoading(false);
        }
      })
      .catch(() => {
        // Réseau coupé : on sort du loading (la liste vide est gérée par EmptyState).
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = profile?.first_name ? `Bonjour ${profile.first_name}` : 'Bonjour';

  return (
    <Screen>
      <AppBar title="COACH OXV" leading={<Logo size={26} />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          {greeting}.
        </Text>
        <Text style={s.manifest}>Vos pilotes, à votre rythme.</Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xl }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : pilots.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Bandeau alerte : nouvelles sessions à voir (24h) */}
            {summary && summary.lastDaySessionCount > 0 ? (
              <Card
                style={{
                  borderColor: theme.palette.coach,
                  marginTop: theme.spacing.xl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                }}
              >
                <View
                  style={s.alertDot}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={s.alertText}>
                  {summary.lastDaySessionCount === 1
                    ? '1 nouvelle session dans les dernières 24 h.'
                    : `${summary.lastDaySessionCount} nouvelles sessions dans les dernières 24 h.`}
                </Text>
              </Card>
            ) : null}

            {/* Stats globales sobres */}
            {summary ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.xl,
                }}
              >
                <Fact
                  value={summary.pilotCount.toString()}
                  label={summary.pilotCount > 1 ? 'pilotes' : 'pilote'}
                />
                <Fact
                  value={summary.recentSessionCount.toString()}
                  label={`session${summary.recentSessionCount > 1 ? 's' : ''} sur ${summary.recentSessionsDays}j`}
                />
                <Fact
                  value={summary.sharedAnnotationCount.toString()}
                  label={`note${summary.sharedAnnotationCount > 1 ? 's' : ''} partagée${summary.sharedAnnotationCount > 1 ? 's' : ''}`}
                />
              </View>
            ) : null}

            {/* File de lecture — sessions à lire en priorité (§6.2) */}
            <Card
              onPress={() => router.push('/(coach)/file-lecture' as never)}
              accessibilityLabel="File de lecture. Les sessions de vos pilotes à lire en priorité."
              style={{ marginTop: theme.spacing.xl, borderColor: theme.palette.coach }}
            >
              <Text style={s.queueTitle}>File de lecture</Text>
              <Text style={s.queueHint}>Les sessions de vos pilotes, à lire en priorité.</Text>
            </Card>

            {/* Brouillons rappel sobre */}
            {summary && summary.draftAnnotationCount > 0 ? (
              <Text style={s.draftNote}>
                {summary.draftAnnotationCount === 1
                  ? '1 note en brouillon en attente de partage.'
                  : `${summary.draftAnnotationCount} notes en brouillon en attente de partage.`}
              </Text>
            ) : null}

            <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
              <SectionLabel>
                {`${pilots.length} ${pilots.length === 1 ? 'PILOTE' : 'PILOTES'}`}
              </SectionLabel>
              {pilots.map((pilot) => (
                <PilotCard key={pilot.pilotId} pilot={pilot} />
              ))}
            </View>

            {/* CTA comparatif 2 pilotes — gaté par la permission view_pilots
                (§8.1) et visible si au moins 2 pilotes suivis */}
            {permissions.canViewPilots && pilots.length >= 2 ? (
              <CoachLink label="Comparer deux pilotes" href="/(coach)/comparer-pilotes" />
            ) : null}
          </>
        )}

        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          {/* Ma fiche coach — profil vu par les pilotes (édition + publication). */}
          <CoachLink label="Mon profil" href="/(coach)/profil" />

          {/* Disponibilités (Phase 1 marketplace) — côté offre : le coach ouvre
              les créneaux que les pilotes demandent depuis sa fiche. Accessible
              à tout coach. */}
          <CoachLink label="Disponibilités" href="/(coach)/disponibilites" />

          {/* Demandes de séance reçues (Phase 1 marketplace) — boucle de
              réponse. Accessible à tout coach : c'est sa boîte de réception. */}
          <CoachLink label="Demandes" href="/(coach)/demandes" />

          {/* Mes repères de virage (§10.3c-A) — outil pédagogique de base,
              disponible pour tout coach. */}
          <CoachLink label="Mes repères de virage" href="/(coach)/reperes" />

          {/* Gabarits de commentaire (§10.3c-C) — confort de saisie, tout coach. */}
          <CoachLink label="Mes gabarits" href="/(coach)/gabarits" />

          {/* Assistant IA (C-1) — pré-rédige une observation, validée par le
              coach. Filtrage doctrinal serveur, consentement pilote requis. */}
          <CoachLink label="Assistant IA" href="/(coach)/assistant" />

          {/* Ma lecture (§10.3c-D) — pondérations du coach, tout coach. */}
          <CoachLink label="Ma lecture" href="/(coach)/lecture" />

          {/* Vue AR coach (E0.1) — outil du coach au bord de piste (lunettes
              Ray-Ban Display). Preview/prototype : non publiable au public tant
              que Meta n'a pas ouvert la GA. Le pilote roule en silence : rien
              côté pilote. Faits uniquement. Disponible pour tout coach. */}
          <CoachLink label="Vue AR (aperçu)" href="/(coach)/ar" />

          {/* Gestion des roulages — gatée par la permission manage_own_sessions
              (§8). Visible hors du bloc pilotes : un coach peut préparer un
              roulage avant d'avoir des pilotes à convier. */}
          {permissions.canManageOwnSessions ? (
            <CoachLink label="Mes roulages" href="/(coach)/roulages" />
          ) : null}

          {/* Tableau de bord business — gaté par can_view_business_dashboard (§10.2). */}
          {permissions.canViewBusinessDashboard ? (
            <CoachLink label="Tableau de bord" href="/(coach)/business" />
          ) : null}
        </View>

        <SpaceSwitcher current="coach" />

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          style={({ pressed }) => ({
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: theme.spacing.lg,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.minorLink}>Se déconnecter</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function CoachLink({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Card
          style={{
            borderColor: theme.palette.coach,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={s.linkLabel}>{label}</Text>
          <Text
            style={{ color: theme.palette.creamMute, fontSize: 18 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            ›
          </Text>
        </Card>
      </Pressable>
    </Link>
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
        accessibilityRole="button"
        accessibilityLabel={`${fullName}, ${level}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Card style={{ borderColor: theme.palette.coach }}>
          <Text style={s.pilotName}>{fullName}</Text>
          <Text style={s.pilotMeta}>
            {level} · Assigné le {formatDateShort(pilot.assignedAt)}
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  return (
    <Card
      style={{
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
        marginTop: theme.spacing.xl,
      }}
    >
      <Text style={s.emptyTitle} accessibilityRole="header">
        Aucun pilote assigné pour l&apos;instant.
      </Text>
      <Text style={s.emptyHint}>
        Les assignations sont gérées par l&apos;équipe OXV. Un pilote doit aussi consentir au
        coaching avant que vous voyiez ses données.
      </Text>
    </Card>
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

const s = {
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
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.coach,
  },
  queueTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  queueHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  alertText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  draftNote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xl,
  },
  linkLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  pilotName: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  pilotMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
