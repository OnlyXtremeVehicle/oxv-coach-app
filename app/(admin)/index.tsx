/**
 * Vue Admin — hub avec 3 entrées Préparation / En cours / Analytique.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';

import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

const VIEWS: { href: string; label: string; description: string }[] = [
  {
    href: '/(admin)/preparation',
    label: 'Préparation',
    description: 'Affectations équipement, vérifications avant session.',
  },
  {
    href: '/(admin)/en-cours',
    label: 'En cours',
    description: 'État Bluetooth en temps réel pendant la session.',
  },
  {
    href: '/(admin)/analytique',
    label: 'Analytique',
    description: 'Métriques globales post-session, export.',
  },
];

export default function AdminHubScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>ADMIN OXV</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          Coordination de la session
        </Text>

        <View style={{ gap: spacing.md }}>
          {VIEWS.map((v) => (
            <Link key={v.href} href={v.href as never} asChild>
              <Pressable
                style={({ pressed }) => ({
                  padding: spacing.xl,
                  borderRadius: borderRadius.lg,
                  borderWidth: 0.5,
                  borderColor: colors.accent.bronze,
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
                  {v.label}
                </Text>
                <Text style={[typography.caption, { color: colors.text.secondary }]}>
                  {v.description}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.replace('/(app)')}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Sortir de l'admin
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
