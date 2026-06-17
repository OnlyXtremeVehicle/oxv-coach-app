/**
 * SpaceSwitcher — sélecteur d'espace réservé aux comptes cumulant les rôles.
 *
 * Visible UNIQUEMENT si `profile.is_admin === true` (flag booléen). Un compte
 * « admin + coach » (ex. administration@oxvehicle.fr) peut ainsi naviguer
 * entre les trois espaces ; les comptes normaux (is_admin=false) ne voient
 * jamais ce bloc — leur expérience reste mono-espace.
 *
 * On s'appuie sur les gardes existants :
 *   - (admin)/_layout : accès si profile.is_admin
 *   - (coach)/_layout : accès si role === 'coach'
 *   - (app)          : espace pilote par défaut
 */

import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

type Space = 'pilot' | 'coach' | 'admin';

const TARGETS: { space: Space; label: string; href: string; color: string }[] = [
  { space: 'pilot', label: 'Espace pilote', href: '/(app)', color: colors.accent.red },
  { space: 'coach', label: 'Espace coach', href: '/(coach)', color: colors.accent.coach },
  { space: 'admin', label: 'Espace admin', href: '/(admin)', color: colors.accent.bronze },
];

export function SpaceSwitcher({ current }: { current: Space }) {
  const isAdmin = useAuthStore((s) => s.profile?.is_admin === true);
  if (!isAdmin) return null;

  const others = TARGETS.filter((t) => t.space !== current);

  return (
    <View
      style={{
        marginTop: spacing.xxxl,
        paddingTop: spacing.xl,
        borderTopWidth: 0.5,
        borderTopColor: colors.border.subtle,
      }}
    >
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.md }]}>
        CHANGER D&apos;ESPACE
      </Text>
      <View style={{ gap: spacing.sm }}>
        {others.map((t) => (
          <Link key={t.space} href={t.href as never} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: t.color,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{ color: t.color, fontSize: fontSize.body, fontWeight: fontWeight.medium }}
              >
                {t.label}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}
