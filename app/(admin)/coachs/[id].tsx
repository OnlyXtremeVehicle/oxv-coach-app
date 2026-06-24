/**
 * Vue Admin — Détail d'un coach : gestion de ses assignations pilotes.
 *
 * Permet :
 *   - Lister les assignations existantes (actif/inactif, consenti/pas)
 *   - Toggle active sur une assignation
 *   - Forcer le consentement pilote (cas papier signé hors-app)
 *   - Assigner un nouveau pilote (sélection depuis liste filtrée)
 *
 * Sécurité : RLS admin_all sur coach_pilots permet ces opérations
 * uniquement aux users is_admin(). Le layout (admin) garantit déjà
 * is_admin = true (sinon redirect /(app)).
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin). Logique inchangée.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  type AssignmentRow,
  type CoachRow,
  type PilotRow,
  assignPilotToCoach,
  forcePilotConsent,
  listAssignmentsForCoach,
  listCoaches,
  listPilots,
  sendCoachInvitation,
  toggleAssignmentActive,
} from '@/services/coachAdminService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { formatDateShort } from '@/utils/format';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';
const CONSENT_GREEN = '#97C459';

export default function AdminCoachDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const adminId = useAuthStore((s) => s.profile?.id);
  const [coach, setCoach] = useState<CoachRow | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [allPilots, setAllPilots] = useState<PilotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [pilotSearch, setPilotSearch] = useState('');

  const reload = async () => {
    if (!params.id) return;
    const [allCoaches, ass, pilots] = await Promise.all([
      listCoaches(),
      listAssignmentsForCoach(params.id),
      listPilots(),
    ]);
    setCoach(allCoaches.find((c) => c.id === params.id) ?? null);
    setAssignments(ass);
    setAllPilots(pilots);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fullName = coach
    ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') || coach.email
    : 'Chargement…';

  // Pilotes assignables = ceux qui n'ont pas déjà une assignation active
  // avec ce coach
  const assignablePilots = useMemo(() => {
    const assignedIds = new Set(assignments.filter((a) => a.active).map((a) => a.pilotId));
    return allPilots.filter((p) => !assignedIds.has(p.id));
  }, [allPilots, assignments]);

  const filteredPilots = useMemo(() => {
    const term = pilotSearch.trim().toLowerCase();
    if (!term) return assignablePilots;
    return assignablePilots.filter((p) => {
      const haystack = `${p.firstName ?? ''} ${p.lastName ?? ''} ${p.email}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [assignablePilots, pilotSearch]);

  async function onAssign(pilotId: string) {
    if (!params.id || !adminId) return;
    const result = await assignPilotToCoach({
      coachId: params.id,
      pilotId,
      createdBy: adminId,
    });
    if (result.ok) {
      setShowPicker(false);
      setPilotSearch('');
      await reload();
    }
  }

  async function onToggleActive(a: AssignmentRow, next: boolean) {
    const result = await toggleAssignmentActive(a.id, next);
    if (result.ok) await reload();
  }

  async function onForceConsent(a: AssignmentRow) {
    const result = await forcePilotConsent(a.id);
    if (result.ok) await reload();
  }

  async function onSendInvitation() {
    if (!coach) return;
    Alert.alert(
      "Envoyer l'invitation",
      `Un email d'invitation sera envoyé à ${coach.email}. Le compte doit déjà être créé côté Supabase (vous le voyez ici donc c'est bon).`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          style: 'default',
          onPress: async () => {
            const result = await sendCoachInvitation({
              email: coach.email,
              firstName: coach.firstName,
              lastName: coach.lastName,
            });
            if (result.ok) {
              Alert.alert('Envoyé', `Email d'invitation envoyé à ${coach.email}.`);
            } else {
              Alert.alert('Échec', result.error ?? 'Erreur inconnue.');
            }
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <AppBar title="COACH" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN OXV · COACH</Text>
        <Text style={s.title}>{fullName}</Text>
        {coach ? <Text style={s.subEmail}>{coach.email}</Text> : null}

        {/* Bouton Envoyer invitation */}
        {coach ? (
          <View style={{ marginTop: theme.spacing.lg }}>
            <Pressable
              accessibilityRole="button"
              onPress={onSendInvitation}
              style={({ pressed }) => ({
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.sm,
                borderWidth: 1,
                borderColor: theme.palette.edge,
                alignSelf: 'flex-start',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={s.ghostBtnTxt}>Envoyer l&apos;email d&apos;invitation</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Bouton Assigner */}
        <View style={{ marginTop: theme.spacing.xxl, marginBottom: theme.spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPicker(!showPicker)}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: theme.radius.md,
              backgroundColor: BRONZE,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={s.primaryBtnTxt}>{showPicker ? 'Annuler' : 'Assigner un pilote'}</Text>
          </Pressable>
        </View>

        {/* Picker pilotes */}
        {showPicker ? (
          <PilotPicker
            pilots={filteredPilots}
            search={pilotSearch}
            onSearchChange={setPilotSearch}
            onSelect={onAssign}
          />
        ) : null}

        {/* Liste assignations */}
        <Text style={[s.sectionLabel, { marginTop: theme.spacing.xxl }]}>ASSIGNATIONS</Text>

        {loading ? (
          <Text style={s.loading}>Chargement…</Text>
        ) : assignments.length === 0 ? (
          <Text style={s.centerMute}>Aucune assignation pour ce coach.</Text>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {assignments.map((a) => (
              <AssignmentCard
                key={a.id}
                assignment={a}
                onToggleActive={(next) => onToggleActive(a, next)}
                onForceConsent={() => onForceConsent(a)}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

// ============================================================================
// Sous-composants
// ============================================================================

function PilotPicker(props: {
  pilots: PilotRow[];
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (pilotId: string) => void;
}) {
  return (
    <Card style={{ borderColor: BRONZE }}>
      <Field
        label="Rechercher un pilote"
        value={props.search}
        onChangeText={props.onSearchChange}
        placeholder="Nom ou email"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {props.pilots.length === 0 ? (
        <Text style={s.centerMute}>Aucun pilote disponible.</Text>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          {props.pilots.slice(0, 20).map((pilot) => {
            const name = [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || pilot.email;
            return (
              <Pressable
                accessibilityRole="button"
                key={pilot.id}
                onPress={() => props.onSelect(pilot.id)}
                style={({ pressed }) => ({
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.sm,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
                })}
              >
                <Text style={s.pilotName}>{name}</Text>
                <Text style={s.pilotEmail}>{pilot.email}</Text>
              </Pressable>
            );
          })}
          {props.pilots.length > 20 ? (
            <Text style={[s.centerMute, { marginTop: theme.spacing.sm }]}>
              {props.pilots.length - 20} pilotes de plus — affinez la recherche.
            </Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}

function AssignmentCard(props: {
  assignment: AssignmentRow;
  onToggleActive: (next: boolean) => void;
  onForceConsent: () => void;
}) {
  const { assignment } = props;
  const name =
    [assignment.pilotFirstName, assignment.pilotLastName].filter(Boolean).join(' ') ||
    assignment.pilotEmail;
  const consentText = assignment.pilotConsentAt
    ? `Consenti le ${formatDateShort(assignment.pilotConsentAt)}`
    : 'Pas encore consenti';

  return (
    <Card style={{ borderColor: assignment.active ? BRONZE : theme.palette.line }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, marginRight: theme.spacing.md }}>
          <Text style={s.pilotName}>{name}</Text>
          <Text style={s.pilotEmail}>{assignment.pilotEmail}</Text>
          <Text
            style={[
              s.consent,
              { color: assignment.pilotConsentAt ? CONSENT_GREEN : theme.palette.creamMute },
            ]}
          >
            {consentText} · Assigné le {formatDateShort(assignment.createdAt)}
          </Text>
        </View>
        <Switch
          value={assignment.active}
          onValueChange={props.onToggleActive}
          trackColor={{ false: theme.palette.line, true: BRONZE }}
          thumbColor={theme.palette.cream}
        />
      </View>

      {!assignment.pilotConsentAt ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onForceConsent}
          style={({ pressed }) => ({
            marginTop: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.sm,
            borderWidth: 1,
            borderColor: theme.palette.edge,
            alignSelf: 'flex-start',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.ghostBtnTxt}>Forcer le consentement (papier signé)</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
  },
  subEmail: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginBottom: theme.spacing.md,
  },
  primaryBtnTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#000',
  },
  ghostBtnTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamSoft,
  },
  pilotName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  pilotEmail: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  consent: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: theme.spacing.xs,
  },
  loading: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  centerMute: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.md,
    textAlign: 'center' as const,
  },
};
