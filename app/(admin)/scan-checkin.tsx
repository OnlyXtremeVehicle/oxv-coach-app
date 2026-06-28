/**
 * Admin — Scan de présence (check-in par QR) (PR-39b).
 *
 * Lit le QR du Pass OXV (`oxv:checkin:<registrationId>`) et pointe la présence
 * (`setRegistrationStatus(..., 'checked_in')`). Admin-only (RLS). La caméra ne se
 * teste que sur device → validation au build. Le check-in manuel reste disponible
 * dans le détail de l'événement.
 *
 * Doctrine : sobre, factuel. Bronze = rôle admin.
 */

import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { setRegistrationStatus } from '@/services/eventsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const BRONZE = '#B87333';
const CHECKIN_PREFIX = 'oxv:checkin:';

type Feedback = { kind: 'ok' | 'error'; message: string } | null;

export default function AdminScanCheckinScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [paused, setPaused] = useState(false);
  const handling = useRef(false);

  const onScan = useCallback(async (data: string) => {
    if (handling.current) return;
    if (!data.startsWith(CHECKIN_PREFIX)) {
      handling.current = true;
      setPaused(true);
      setFeedback({ kind: 'error', message: 'Code non reconnu.' });
      return;
    }
    const registrationId = data.slice(CHECKIN_PREFIX.length).trim();
    handling.current = true;
    setPaused(true);
    const res = await setRegistrationStatus(registrationId, 'checked_in');
    setFeedback(
      res.ok
        ? { kind: 'ok', message: 'Présence pointée.' }
        : { kind: 'error', message: res.error ?? 'Pointage impossible.' }
    );
  }, []);

  function resetScan() {
    setFeedback(null);
    setPaused(false);
    handling.current = false;
  }

  return (
    <Screen scroll={false}>
      <AppBar title="SCAN PRÉSENCE" onBack={() => router.back()} />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <Text style={[s.eyebrow, { color: BRONZE }]}>CHECK-IN PAR QR</Text>

        {!permission ? (
          <Text style={s.muted}>Initialisation de la caméra…</Text>
        ) : !permission.granted ? (
          <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
            <Text style={s.muted}>
              L&apos;accès caméra est nécessaire pour scanner les codes de présence.
            </Text>
            <Button label="Autoriser la caméra" onPress={requestPermission} />
          </View>
        ) : (
          <View style={{ flex: 1, marginTop: theme.spacing.lg }}>
            <View style={s.cameraWrap}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={paused ? undefined : (r) => onScan(r.data)}
              />
            </View>

            {feedback ? (
              <View
                style={[
                  s.feedback,
                  { borderColor: feedback.kind === 'ok' ? BRONZE : theme.palette.red },
                ]}
              >
                <Text
                  style={[
                    s.feedbackTxt,
                    { color: feedback.kind === 'ok' ? theme.palette.cream : theme.palette.red },
                  ]}
                >
                  {feedback.message}
                </Text>
                <Button label="Scanner à nouveau" variant="ghost" onPress={resetScan} />
              </View>
            ) : (
              <Text style={s.hint}>Présentez le code de présence du pilote devant la caméra.</Text>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.body * 1.5,
  },
  cameraWrap: {
    flex: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.lg,
  },
  feedback: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    alignItems: 'center' as const,
  },
  feedbackTxt: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
  },
};
