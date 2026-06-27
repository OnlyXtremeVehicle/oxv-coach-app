/**
 * SpaceSwitcher — sélecteur d'espace pour les comptes cumulant les rôles.
 * Transposition gaming.
 *
 * Visible UNIQUEMENT si `profile.is_admin === true`. Un compte « admin +
 * coach » navigue entre les trois espaces ; les comptes normaux ne voient
 * jamais ce bloc. S'appuie sur les gardes des layouts (admin/coach/app).
 * Migration legacy→v2 achevée.
 */

import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

type Space = 'pilot' | 'coach' | 'admin';

// Accents d'identité de section (navigation, PAS viz). Pilote → or (cockpit) ;
// coach → bleu nuit « posture d'écoute » ; admin → bronze. Identités de
// section préservées pour différencier visuellement les trois espaces.
const TARGETS: { space: Space; label: string; href: string; color: string }[] = [
  { space: 'pilot', label: 'Espace pilote', href: '/(app)', color: palette.gold },
  { space: 'coach', label: 'Espace coach', href: '/(coach)', color: '#1E3A5F' },
  { space: 'admin', label: 'Espace admin', href: '/(admin)', color: '#B87333' },
];

export function SpaceSwitcher({ current }: { current: Space }) {
  const isAdmin = useAuthStore((s) => s.profile?.is_admin === true);
  if (!isAdmin) return null;

  const others = TARGETS.filter((t) => t.space !== current);

  return (
    <View
      style={{
        marginTop: 40,
        paddingTop: spacing.xl,
        borderTopWidth: 0.5,
        borderTopColor: palette.line,
      }}
    >
      <Text style={[s.eyebrow, { marginBottom: spacing.md }]}>CHANGER D&apos;ESPACE</Text>
      <View style={{ gap: spacing.sm }}>
        {others.map((t) => (
          <Link key={t.space} href={t.href as never} asChild>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 0.5,
                borderColor: t.color,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{ color: t.color, fontSize: fontSize.body, fontFamily: fonts.bodyMedium }}
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

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
};
