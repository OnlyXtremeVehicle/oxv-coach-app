/**
 * ROULAGE — écran 6/8 du flux de capture v2 (lot V2-L2, PORTE REC).
 * Route : /(app2)/rec/roulage (segment immersif — la TabBar s'efface).
 *
 * LE PLUS SOBRE, et c'est du design : fond base pur, un point REC qui pulse,
 * « REC » en mono. RIEN d'autre — AUCUN chrono, AUCUN chiffre, AUCUNE biométrie.
 * Le silence total EST l'expérience premium (Principe 3 — silence en piste).
 * Seule exception d'HONNÊTETÉ (PR-08, reprise telle quelle de la v1) : si le
 * lien BLE décroche, on le DIT sobrement — jamais laisser croire qu'on
 * enregistre quand le boîtier a lâché. Sans rouge : le rouge reste au REC actif.
 *
 * RÈGLE CARDINALE : la capture est INCHANGÉE. « Terminer le run » appelle
 * EXACTEMENT ce que la v1 appelle (stopCaptureSession → bilan), l'annulation
 * discrète appelle abortCaptureSession. Keep-awake est géré par le service v1
 * (non dupliqué ici). Aucune écriture dans la state machine.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { captureLinkMessage } from '@/services/captureLinkStatusLogic';
import {
  abortCaptureSession,
  onCaptureLinkStatus,
  stopCaptureSession,
  type CaptureLinkStatus,
} from '@/services/captureSessionService';
import { useSessionStore } from '@/store/useSessionStore';
import {
  colors,
  motionTokens,
  PressScale,
  radius,
  space,
  typo,
  useDoorTransition,
  useReduceMotion,
} from '@/ui/v2';

import { REC_ROUTES } from '@/features/rec/captureStepLogic';

/** Point REC : un disque accent qui respire (motion.pulse). Statique si figé. */
function RecPulse({ active }: { active: boolean }) {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active || reduce) {
      cancelAnimation(pulse);
      // 1 et non 0. `dotStyle` calcule `0.5 + 0.5 * pulse.value` : figer à 0
      // laissait le voyant à 50 % d'opacité, soit 1,55 de contraste sur le
      // fond — invisible en plein soleil, et précisément chez l'utilisateur
      // qui a demandé l'absence de mouvement. À 1, le voyant est plein et
      // immobile : 3,10, ce qu'exige un indicateur graphique (WCAG 1.4.11).
      pulse.value = 1;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: motionTokens.pulse, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(pulse);
  }, [active, reduce, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * pulse.value,
    transform: [{ scale: 0.88 + 0.16 * pulse.value }],
  }));

  if (!active) {
    return <View style={styles.dotStatic} />;
  }
  return <Animated.View style={[styles.dot, dotStyle]} />;
}

export default function RoulageScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const status = useSessionStore((s) => s.status);
  const [ending, setEnding] = useState(false);

  // Statut du lien BLE (recording/interrupted/lost) — affiché honnêtement.
  const [linkStatus, setLinkStatus] = useState<CaptureLinkStatus>('recording');
  useEffect(() => onCaptureLinkStatus(setLinkStatus), []);

  const recording = status === 'recording';
  const linkMsg = captureLinkMessage(linkStatus);
  // Le point REC ne pulse en rouge que si l'enregistrement tient réellement.
  const recActive = recording && linkMsg === null;

  async function onFinish() {
    if (ending) return;
    setEnding(true);
    // MÊME appel que la v1 (capture inchangée) : clôt la session, persiste,
    // rend sessionId + ubxUri pour le bilan.
    const res = await stopCaptureSession();
    if (res.ok && res.sessionId) {
      /**
       * LE COMPTE DE TRAMES SUIT LA SÉANCE — posé le 13/08/2026.
       *
       * `stopCaptureSession` rend `totalFrames` depuis toujours, et cet écran
       * le jetait. Une séance à ZÉRO trame arrivait donc au bilan exactement
       * comme une séance pleine, et le pilote devait DÉDUIRE le vide d'un écran
       * qui ne montrait rien. C'est ce qui s'est passé la nuit du 13/08.
       *
       * Il est transmis pour que l'écran de fin puisse le DIRE. Une séance sans
       * données doit s'annoncer, pas se deviner.
       */
      router.replace({
        pathname: REC_ROUTES.fin,
        params: {
          sessionId: res.sessionId,
          ubxUri: res.ubxUri ?? '',
          totalFrames: String(res.totalFrames ?? 0),
        },
      } as never);
    } else {
      /**
       * LE REFUS SE DIT AVANT DE PARTIR.
       *
       * `{ ok: false }` survient réellement : après une clôture pour lien perdu
       * (timeout de quinze minutes), ou sur un second appui. Le pilote appuyait
       * sur « Terminer », se retrouvait à l'accueil, et n'apprenait jamais que
       * sa séance avait été close un quart d'heure plus tôt.
       */
      Toast.show({
        type: 'info',
        text1: 'Séance déjà clôturée.',
        text2: res.error ?? 'Elle a été fermée automatiquement.',
      });
      router.replace('/(app2)' as never);
    }
  }

  async function onAbort() {
    if (ending) return;
    setEnding(true);
    await abortCaptureSession();
    router.replace('/(app2)' as never);
  }

  return (
    <Animated.View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom + space.xl },
        door,
      ]}
    >
      {/* En piste — doctrine du silence : voyant REC, rien à fixer. Exception
          d'honnêteté si le lien décroche (sans rouge). */}
      <View style={styles.center}>
        <RecPulse active={recActive} />
        {linkMsg !== null ? (
          // Le décrochage du lien survient PENDANT que le pilote roule, écran
          // détourné. Groupé et annoncé : sans région live, un utilisateur de
          // lecteur d'écran revenant sur l'écran croirait que l'enregistrement
          // tient encore.
          <View
            style={styles.linkBlock}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${linkMsg.title}. ${linkMsg.sub}`}
          >
            <Text style={styles.linkTitle}>{linkMsg.title}</Text>
            <Text style={styles.linkSub}>{linkMsg.sub}</Text>
          </View>
        ) : (
          <Text style={styles.rec}>REC</Text>
        )}
      </View>

      <PressScale
        onPress={onFinish}
        disabled={ending}
        accessibilityLabel="Terminer le run"
        accessibilityState={{ busy: ending }}
        containerStyle={styles.finishContainer}
        style={[styles.finish, ending && styles.dimmed]}
      >
        <Text style={styles.finishLabel}>{ending ? 'Fin de séance…' : 'Terminer le run'}</Text>
      </PressScale>

      <PressScale
        onPress={onAbort}
        disabled={ending}
        accessibilityLabel="Annuler sans enregistrer"
        containerStyle={styles.abortContainer}
        style={styles.abort}
      >
        <Text style={styles.abortLabel}>Annuler sans enregistrer</Text>
      </PressScale>
    </Animated.View>
  );
}

const DOT = 30;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.accent,
  },
  // Lien figé : point neutre (le rouge reste réservé au REC actif).
  dotStatic: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.text.mid,
  },
  // Contraste renforcé (jalon 3, règle 1) : sur les écrans du flux REC, lus en
  // plein soleil, le 7:1 de l'AAA est un PLANCHER. `accent` ne mesure que 3,10
  // sur le fond — le rouge reste au VOYANT, qui est un indicateur graphique et
  // relève du 3:1 de la règle 1.4.11, tenu.
  rec: {
    fontFamily: typo.mono,
    fontSize: 15,
    letterSpacing: 6,
    textTransform: 'uppercase',
    color: colors.text.hi, // 15,03 — était accent, 3,10
  },
  // Le groupe d'accessibilité reprend À L'IDENTIQUE ce que le conteneur
  // `center` appliquait aux deux textes (gap + centrage) : le rendu ne bouge
  // pas d'un pixel, seule la lecture change.
  linkBlock: {
    alignItems: 'center',
    gap: space.xl,
  },
  linkTitle: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  // 7:1 plancher : `text.low` ne mesure que 6,11 sur ce fond.
  linkSub: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.mid, // 8,15 — était text.low, 6,11
    textAlign: 'center',
    maxWidth: 280,
  },

  // « Terminer le run » — discret, hairline, jamais un CTA criard.
  finishContainer: {
    width: '100%',
  },
  finish: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
  dimmed: {
    opacity: 0.6,
  },

  // Annulation — un murmure sous le bouton principal.
  abortContainer: {
    alignSelf: 'center',
    marginTop: space.md,
  },
  abort: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  // 7:1 plancher, et le tertiaire est interdit sur ces écrans : `text.dim` ne
  // mesure que 4,38. Rendre MOINS visible l'abandon d'une capture serait de
  // toute façon un mauvais arbitrage — c'est un geste qu'on doit trouver du
  // premier coup d'œil quand quelque chose se passe mal.
  abortLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.mid, // 8,15 — était text.dim, 4,38
  },
});
