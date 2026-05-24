import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

import { initBle, teardownBle } from '@/ble/initBle';
import { initFlic, teardownFlic } from '@/ble/initFlic';
import { BleErrorModal } from '@/components/BleErrorModal';
import { OfflineBanner } from '@/components/OfflineBanner';
import { initGeolocation, teardownGeolocation } from '@/lib/initGeolocation';
import { initNetInfo, teardownNetInfo } from '@/lib/netinfo';
import { initSentry } from '@/lib/sentry';
import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/tokens';

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {
  // SplashScreen peut être indisponible en mode dev client, on ignore.
});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    initialize();
    initNetInfo();
    initBle();
    initFlic();
    initGeolocation().catch(() => undefined);
    return () => {
      teardownNetInfo();
      teardownBle();
      teardownFlic();
      teardownGeolocation();
    };
  }, [initialize]);

  useEffect(() => {
    if (status !== 'idle' && status !== 'loading') {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.primary },
            animation: 'fade',
          }}
        />
        <OfflineBanner />
        <BleErrorModal />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
