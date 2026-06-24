import { Stack } from 'expo-router';

import { theme } from '@/theme/v2';

export default function SessionMediaLayout() {
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
