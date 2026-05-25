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
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort } from '@/utils/format';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>ADMIN OXV · COACH</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          {fullName}
        </Text>
        {coach ? (
          <Text style={[typography.caption, { color: colors.text.tertiary }]}>{coach.email}</Text>
        ) : null}

        {/* Bouton Envoyer invitation */}
        {coach ? (
          <View style={{ marginTop: spacing.lg }}>
            <Pressable
              accessibilityRole="button"
              onPress={onSendInvitation}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.sm,
                borderWidth: 0.5,
                borderColor: colors.border.medium,
                alignSelf: 'flex-start',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                Envoyer l'email d'invitation
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Bouton Assigner */}
        <View style={{ marginTop: spacing.xxl, marginBottom: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPicker(!showPicker)}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: borderRadius.md,
              backgroundColor: colors.accent.bronze,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.background.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
              }}
            >
              {showPicker ? 'Annuler' : 'Assigner un pilote'}
            </Text>
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
        <Text
          style={[
            typography.eyebrow,
            { color: colors.accent.bronze, marginTop: spacing.xxl, marginBottom: spacing.md },
          ]}
        >
          ASSIGNATIONS
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : assignments.length === 0 ? (
          <Text
            style={[
              typography.caption,
              {
                color: colors.text.tertiary,
                paddingVertical: spacing.lg,
                textAlign: 'center',
              },
            ]}
          >
            Aucune assignation pour ce coach.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                assignment={a}
                onToggleActive={(next) => onToggleActive(a, next)}
                onForceConsent={() => onForceConsent(a)}
              />
            ))}
          </View>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour à la liste des coachs
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <View
      style={{
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.accent.bronze,
        backgroundColor: colors.background.secondary,
        padding: spacing.md,
      }}
    >
      <TextInput
        value={props.search}
        onChangeText={props.onSearchChange}
        placeholder="Rechercher par nom ou email…"
        placeholderTextColor={colors.text.tertiary}
        style={{
          height: 44,
          borderRadius: borderRadius.md,
          borderWidth: 0.5,
          borderColor: colors.border.subtle,
          paddingHorizontal: spacing.md,
          color: colors.text.primary,
          fontSize: fontSize.body,
          marginBottom: spacing.md,
        }}
      />
      {props.pilots.length === 0 ? (
        <Text
          style={[
            typography.caption,
            { color: colors.text.tertiary, paddingVertical: spacing.md, textAlign: 'center' },
          ]}
        >
          Aucun pilote disponible.
        </Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {props.pilots.slice(0, 20).map((pilot) => {
            const name = [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || pilot.email;
            return (
              <Pressable
                accessibilityRole="button"
                key={pilot.id}
                onPress={() => props.onSelect(pilot.id)}
                style={({ pressed }) => ({
                  padding: spacing.md,
                  borderRadius: borderRadius.sm,
                  backgroundColor: pressed ? colors.background.primary : 'transparent',
                })}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.regular,
                  }}
                >
                  {name}
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.tertiary, marginTop: spacing.xs },
                  ]}
                >
                  {pilot.email}
                </Text>
              </Pressable>
            );
          })}
          {props.pilots.length > 20 ? (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.text.tertiary,
                  textAlign: 'center',
                  marginTop: spacing.sm,
                },
              ]}
            >
              {props.pilots.length - 20} pilotes de plus — affinez la recherche.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function AssignmentRow(props: {
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
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: assignment.active ? colors.accent.bronze : colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            {name}
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
          >
            {assignment.pilotEmail}
          </Text>
          <Text
            style={[
              typography.caption,
              {
                color: assignment.pilotConsentAt ? colors.margin.green : colors.text.tertiary,
                marginTop: spacing.xs,
              },
            ]}
          >
            {consentText} · Assigné le {formatDateShort(assignment.createdAt)}
          </Text>
        </View>
        <Switch
          value={assignment.active}
          onValueChange={props.onToggleActive}
          trackColor={{ false: colors.border.subtle, true: colors.accent.bronze }}
          thumbColor={colors.text.primary}
        />
      </View>

      {!assignment.pilotConsentAt ? (
        <Pressable
          accessibilityRole="button"
          onPress={props.onForceConsent}
          style={({ pressed }) => ({
            marginTop: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.sm,
            borderWidth: 0.5,
            borderColor: colors.border.medium,
            alignSelf: 'flex-start',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            Forcer le consentement (papier signé)
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
