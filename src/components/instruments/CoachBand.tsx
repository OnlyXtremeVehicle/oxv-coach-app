/**
 * CoachBand — bande coach, SEUL espace prescriptif de l'application.
 *
 * Partout ailleurs, l'app est un miroir : elle énonce des faits, jamais des
 * consignes. Ici, et ici seulement, le coach (humain, BPJEPS) a droit aux verbes
 * d'ordre et à la causalité (« retardez le freinage », « vous perdez 0,3 s
 * parce que… »). Le marquage rouge + « De votre coach » signale sans ambiguïté
 * que ce qui suit vient d'un tiers et n'est pas une lecture automatique.
 *
 * Langage (étalon `maquette_debrief_gaming.html`) : fond rouge très sombre,
 * liseré gauche rouge vif, pastille, label mono rouge en capitales, message en
 * texte clair.
 *
 * NB couleurs : `palette.red` pour l'accent ; les deux nuances sombres ci-dessous
 * sont propres à la bande coach (absentes de la palette générale, car le rouge
 * n'apparaît nulle part ailleurs).
 *
 * Usage :
 *   <CoachBand
 *     items={[{ ref: 'Virage 7', text: 'retardez le lâcher de frein d\'un temps.' }]}
 *     coachName="J. Beltoise" />
 *   // côté coach : <CoachBand title="Espace coach" items={...} />
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, hitSlop, motion, palette, radius, spacing } from '@/theme/v2';

const COACH_BG = '#140809'; // fond rouge très sombre — spécifique bande coach
const COACH_BORDER = '#2C1418'; // bordure rouge sombre — spécifique bande coach

export interface CoachBandItem {
  /** Repère de virage / zone (ex. « Virage 7 »). Optionnel. */
  ref?: string | null;
  /** Le message prescriptif du coach. */
  text: string;
  /** Navigation optionnelle (ex. ouvrir le virage concerné). */
  onPress?: () => void;
}

export interface CoachBandProps {
  /** Messages du coach. Vide → état « en attente ». */
  items: CoachBandItem[];
  /** Titre du bandeau. Défaut « De votre coach ». */
  title?: string;
  /** Nom du coach, affiché discrètement à droite du titre. */
  coachName?: string | null;
  /** Texte affiché quand `items` est vide. */
  emptyLabel?: string;
  /** Animation d'entrée (fondu + montée légère). Défaut true. */
  animate?: boolean;
  /** Délai d'entrée (ms), pour échelonner dans une séquence. */
  delay?: number;
}

export function CoachBand({
  items,
  title = 'De votre coach',
  coachName = null,
  emptyLabel = 'En attente d’un repère de votre coach.',
  animate = true,
  delay = 0,
}: CoachBandProps) {
  const enter = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: motion.base,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animate, delay, enter]);

  const animStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  return (
    <Animated.View style={[styles.band, animStyle]}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <Text style={styles.title}>{title}</Text>
        {coachName ? <Text style={styles.coachName}>{coachName}</Text> : null}
      </View>

      {items.length > 0 ? (
        items.map((it, i) => {
          const line = (
            <Text style={styles.itemText}>
              {it.ref ? <Text style={styles.itemRef}>{it.ref} — </Text> : null}
              {it.text}
              {it.onPress ? <Text style={styles.itemChevron}> ›</Text> : null}
            </Text>
          );
          if (it.onPress) {
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                hitSlop={hitSlop}
                onPress={it.onPress}
                style={({ pressed }) => [
                  i > 0 && styles.itemSpacing,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                {line}
              </Pressable>
            );
          }
          return (
            <View key={i} style={i > 0 ? styles.itemSpacing : undefined}>
              {line}
            </View>
          );
        })
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: COACH_BG,
    borderColor: COACH_BORDER,
    borderWidth: 1,
    borderLeftColor: palette.red,
    borderLeftWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.red,
    marginRight: spacing.sm,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: palette.red,
    textTransform: 'uppercase',
  },
  coachName: {
    marginLeft: 'auto',
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: palette.faint,
    textTransform: 'uppercase',
  },
  itemText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.creamSoft,
  },
  itemSpacing: { marginTop: 6 },
  itemChevron: {
    fontFamily: fonts.body,
    color: palette.red,
  },
  itemRef: {
    fontFamily: fonts.bodySemi,
    color: palette.cream,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.faint,
  },
});
