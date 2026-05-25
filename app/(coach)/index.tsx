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

import { type CoachPilotRow, listMyPilots } from '@/services/coachService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort } from '@/utils/format';

export default function CoachHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMyPilots().then((rows) => {
      if (!cancelled) {
        setPilots(rows);
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
          </>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={signOut}>
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
