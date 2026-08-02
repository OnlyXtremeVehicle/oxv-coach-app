/**
 * SpaceSwitcher — sélecteur d'espace pour les comptes cumulant les rôles.
 * Transposition gaming.
 *
 * Visible uniquement pour un compte administrateur — qui navigue entre les
 * trois espaces. Les comptes normaux ne voient jamais ce bloc. S'appuie sur les
 * gardes des layouts (admin/coach/app).
 *
 * La condition passe par `peutChangerEspace` : elle lisait `is_admin` seul, là
 * où la base admet `role = 'admin' OR is_admin = true`. Deux comptes en
 * production sont dans cet écart — administrateurs pour la RLS, sans porte dans
 * l'application. Voir `src/services/accesLogic.ts`.
 */

import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { peutChangerEspace } from '@/services/accesLogic';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

const { palette, roleColors, fonts, fontSize, spacing, radius } = theme;

type Space = 'pilot' | 'coach' | 'admin';

// Accents d'identité de section (navigation, PAS viz). Couleurs d'identité de
// rôle canoniques (roleColors, décision fondateur 2026-07-06) : pilote neutre
// (jamais l'or), coach rouge de marque, admin cyan.
/**
 * LES ESPACES OÙ L'ON PEUT RÉELLEMENT ENTRER.
 *
 * « Espace coach » figurait ici et menait à un refus. Ce bloc ne s'affiche que
 * pour un administrateur (`peutChangerEspace` = `estAdmin` = `role === 'admin'`),
 * et le seuil `app/(coach)/_layout.tsx` renvoie tout `role !== 'coach'` vers
 * l'espace pilote : la cible était proposée exactement au seul public qui ne
 * pouvait jamais la franchir. Un contrôle qui mène à une redirection est un
 * contrôle mort — il fait douter du compte, pas du bouton.
 *
 * L'application est MONO-RÔLE. Le jour où un compte cumulera coach et admin, la
 * cible se rajoutera ici — et pas avant.
 *
 * Relevé par la cartographie de l'espace admin du 02/08/2026.
 */
const TARGETS: { space: Space; label: string; href: string; color: string }[] = [
  { space: 'pilot', label: 'Espace pilote', href: '/(app2)', color: roleColors.pilot },
  { space: 'admin', label: 'Espace admin', href: '/(admin)', color: roleColors.admin },
];

export function SpaceSwitcher({ current }: { current: Space }) {
  const multiEspace = useAuthStore((s) => peutChangerEspace(s.profile));
  if (!multiEspace) return null;

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
