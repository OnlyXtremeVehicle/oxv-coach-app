import { Stack, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <Screen scroll={false}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.xl,
          }}
        >
          <Text style={s.eyebrow}>404</Text>
          <Text style={s.title}>Cet écran n&apos;existe pas.</Text>
          <View style={{ marginTop: theme.spacing.xl, alignSelf: 'stretch' }}>
            <Button label="Retour à l'accueil" onPress={() => router.replace('/')} />
          </View>
        </View>
      </Screen>
    </>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
};
