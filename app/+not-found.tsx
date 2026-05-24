import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>404</Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.xl }]}>
          Cet écran n'existe pas.
        </Text>
        <Link href="/" replace>
          <Text style={[typography.body, { color: colors.accent.red }]}>Retour à l'accueil</Text>
        </Link>
      </View>
    </>
  );
}
