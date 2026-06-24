import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);

  // Dès que la session est authentifiée, on sort du groupe (auth) : l'index
  // racine prend le relais pour le routage par rôle / onboarding. Sans cette
  // redirection, l'écran de login reste affiché après une connexion réussie
  // (la session est bien créée, mais aucune navigation ne se déclenche).
  if (status === 'authenticated') {
    return <Redirect href="/" />;
  }

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
