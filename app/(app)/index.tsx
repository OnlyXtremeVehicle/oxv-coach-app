import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { colors, spacing, typography, fontSize, fontWeight, borderRadius } from '@/theme/tokens';

export default function HomeScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const status = useAuthStore((s) => s.status);

  const greeting = profile?.first_name ? `Bienvenue, ${profile.first_name}.` : 'Bienvenue.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
        <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>OXV COACH</Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.md }]}>{greeting}</Text>
        <Text style={[typography.manifest]}>
          Connexion établie. Cette semaine pose les fondations.
        </Text>

        <View style={{ flex: 1 }} />

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          disabled={status === 'loading'}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            Se déconnecter
          </Text>
        </Pressable>

        {__DEV__ ? (
          <Link href="/(app)/debug-capture" asChild>
            <Pressable style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                Mode debug — capture UBX
              </Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
