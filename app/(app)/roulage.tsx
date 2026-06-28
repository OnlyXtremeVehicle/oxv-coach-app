/**
 * Écran #S6 — Roulage (enregistrement en cours).
 * Refonte gaming « cockpit factuel » (charte v2) — doctrine du silence.
 *
 * « Silence en piste » : pendant que le véhicule roule, aucun écran n'est
 * consulté. Le cockpit s'éteint — pas d'instrument, pas de chiffre à fixer.
 * Un seul signe de vie : l'enregistrement qui pulse (onde concentrique rouge).
 * Le langage gaming rend ce silence volontaire, pas vide.
 *
 * Le rouge est ici légitime : c'est le signal d'enregistrement (REC), pas
 * une donnée de performance. Le service captureSessionService écrit les
 * trames en base en arrière-plan tant que l'app est au premier plan.
 * « Terminer le roulage » clôt la session et bascule vers le flux de bilan.
 *
 * Logique de capture inchangée. Pas de chrono défilant : rien à fixer.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { success as hapticSuccess } from '@/lib/haptics';
import { captureLinkMessage } from '@/services/captureLinkStatusLogic';
import {
  abortCaptureSession,
  onCaptureLinkStatus,
  stopCaptureSession,
  type CaptureLinkStatus,
} from '@/services/captureSessionService';
import { useSessionStore } from '@/store/useSessionStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Onde d'enregistrement : cœur pulsant + ondes concentriques (REC). */
function RecordingPulse({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const w1 = useRef(new Animated.Value(0)).current;
  const w2 = useRef(new Animated.Value(0)).current;
  const w3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    const corePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    corePulse.start();

    const waveVals = [w1, w2, w3];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loops: Animated.CompositeAnimation[] = [];
    waveVals.forEach((v, i) => {
      // Décalage initial échelonné → onde continue.
      const t = setTimeout(() => {
        const lp = Animated.loop(
          Animated.timing(v, {
            toValue: 1,
            duration: 2600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        );
        loops.push(lp);
        lp.start();
      }, i * 867);
      timers.push(t);
    });

    return () => {
      corePulse.stop();
      timers.forEach(clearTimeout);
      loops.forEach((l) => l.stop());
      [pulse, w1, w2, w3].forEach((v) => v.setValue(0));
    };
  }, [active, pulse, w1, w2, w3]);

  if (!active) {
    return <View style={s.coreStatic} />;
  }

  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  const waveStyle = (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 3.4] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
  });

  return (
    <View style={s.recBox}>
      <Animated.View style={[s.wave, waveStyle(w1)]} />
      <Animated.View style={[s.wave, waveStyle(w2)]} />
      <Animated.View style={[s.wave, waveStyle(w3)]} />
      <Animated.View
        style={[s.core, { transform: [{ scale: coreScale }], opacity: coreOpacity }]}
      />
    </View>
  );
}

export default function RoulageScreen() {
  const status = useSessionStore((s) => s.status);
  const [ending, setEnding] = useState(false);
  // Statut du lien BLE de la capture (recording/interrupted/lost). Affiché
  // honnêtement : on ne laisse jamais croire qu'on enregistre si le boîtier a
  // décroché (PR-08). onCaptureLinkStatus émet l'état courant à l'abonnement.
  const [linkStatus, setLinkStatus] = useState<CaptureLinkStatus>('recording');
  useEffect(() => onCaptureLinkStatus(setLinkStatus), []);

  async function onFinish() {
    if (ending) return;
    setEnding(true);
    const res = await stopCaptureSession();
    hapticSuccess();
    if (res.ok && res.sessionId) {
      router.replace({
        pathname: '/(app)/pilotage-fini',
        params: { sessionId: res.sessionId, ubxUri: res.ubxUri ?? '' },
      });
    } else {
      // Capture déjà close ou erreur : on ne bloque pas le pilote.
      router.replace('/(app)');
    }
  }

  async function onAbort() {
    if (ending) return;
    setEnding(true);
    await abortCaptureSession();
    router.replace('/(app)');
  }

  const recording = status === 'recording';
  // Message honnête de lien (null = nominal → on garde l'écran de silence).
  const linkMsg = captureLinkMessage(linkStatus);

  return (
    <Screen scroll={false}>
      <AppBar title="ROULAGE" />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* En piste — doctrine du silence (canon §6) : voyant REC qui pulse, trois
            fragments éditoriaux. AUCUNE donnée, AUCUN chrono, AUCUN tour affiché.
            Exception d'HONNÊTETÉ : si le lien BLE décroche, on le DIT (sans rouge,
            le rouge restant réservé au REC actif). */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <RecordingPulse active={recording} />
          {linkMsg ? (
            <>
              <Text style={[s.enPiste, { color: palette.creamMute }]}>{linkMsg.title}</Text>
              <Text style={s.silence}>{linkMsg.sub}</Text>
            </>
          ) : (
            <>
              <Text style={s.enPiste}>EN PISTE</Text>
              <Text style={s.manifest}>L&apos;app s&apos;efface.</Text>
              <Text style={s.silence}>Aucun écran. Aucun son. Conduisez.</Text>
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Terminer le roulage"
          accessibilityState={{ disabled: ending, busy: ending }}
          disabled={ending}
          onPress={onFinish}
          style={({ pressed }) => [s.finish, (pressed || ending) && { opacity: 0.85 }]}
        >
          {ending ? (
            <ActivityIndicator color={palette.cream} />
          ) : (
            <Text style={s.finishTxt}>Terminer le roulage</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Annuler sans enregistrer"
          accessibilityState={{ disabled: ending }}
          disabled={ending}
          onPress={onAbort}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={s.abortTxt}>Annuler sans enregistrer</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  recBox: {
    width: 140,
    height: 140,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.xl,
  },
  wave: {
    position: 'absolute' as const,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: palette.red,
  },
  core: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.red,
    shadowColor: palette.red,
    shadowOpacity: 0.9,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  coreStatic: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.creamMute,
    marginBottom: spacing.xl,
  },
  enPiste: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 5,
    textTransform: 'uppercase' as const,
    color: palette.red,
    marginBottom: spacing.lg,
  },
  silence: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.faint,
    textAlign: 'center' as const,
    marginTop: spacing.lg,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    textAlign: 'center' as const,
  },
  finish: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: palette.red,
    marginBottom: spacing.md,
  },
  finishTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.cream,
  },
  abortTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
};
