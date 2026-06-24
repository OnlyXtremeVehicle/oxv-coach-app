import { Stack } from 'expo-router';

import { theme } from '@/theme/v2';

export default function DuelLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.palette.night },
        animation: 'fade',
      }}
    />
  );
}
