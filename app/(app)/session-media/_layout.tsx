import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

export default function SessionMediaLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
      }}
    />
  );
}
