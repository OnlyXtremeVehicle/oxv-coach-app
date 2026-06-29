/**
 * CornerPanel (V9 §17 Data) — aperçu d'un virage en feuille basse (bottom-sheet).
 *
 * Prévisualisation légère depuis la carte, sans quitter l'écran : nom du virage,
 * marge si la séance en porte une (texte neutre), et une porte vers le détail
 * complet. Non destructif — le détail plein écran reste accessible.
 *
 * Pas de dépendance native : Modal + Animated (slide + fondu du voile), fermeture
 * au voile ou au bouton. La feuille reste montée le temps de l'animation de
 * sortie (pas de clignotement). Doctrine : sobre, neutre (aucune couleur de
 * jugement sur la marge), vouvoiement, pas d'emoji.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import { theme } from '@/theme/v2';

export interface CornerPanelData {
  index: number;
  name: string;
  /** Libellé humain de la marge sur ce virage, ou null si indisponible. */
  zoneLabel: string | null;
}

const SHEET_OFFSET = 480;

export function CornerPanel({
  corner,
  onClose,
  onOpenDetail,
}: {
  corner: CornerPanelData | null;
  onClose: () => void;
  onOpenDetail: (index: number) => void;
}) {
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState<CornerPanelData | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (corner) {
      setShown(corner);
      setRender(true);
      Animated.timing(slide, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (render) {
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRender(false);
      });
    }
  }, [corner, render, slide]);

  if (!render || !shown) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSET, 0] });
  const backdrop = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: backdrop }]}>
          <Pressable
            style={s.backdropPress}
            accessibilityRole="button"
            accessibilityLabel="Fermer l'aperçu"
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
          <View style={s.handle} />

          <Text style={s.eyebrow}>VIRAGE {shown.index}</Text>
          <Text style={s.name} accessibilityRole="header">
            {shown.name}
          </Text>

          <View style={s.factRow}>
            <Text style={s.factLabel}>MARGE</Text>
            <Text style={s.factValue}>{shown.zoneLabel ?? 'Indisponible pour cette séance'}</Text>
          </View>

          <Text style={s.note}>
            Un aperçu. La trajectoire, l’appui et les temps de passage vivent dans le détail.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir le détail complet du virage ${shown.index}`}
            onPress={() => {
              haptics.tap();
              onOpenDetail(shown.index);
            }}
            style={({ pressed }) => [s.cta, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.ctaLabel}>Voir le détail complet</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={onClose}
            style={s.closeHit}
          >
            <Text style={s.close}>Fermer</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = {
  root: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  backdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.palette.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.palette.line,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  handle: {
    alignSelf: 'center' as const,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.palette.line,
    marginBottom: theme.spacing.lg,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  factRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  factLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  factValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.lg,
  },
  cta: {
    minHeight: 52,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.xl,
  },
  ctaLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  closeHit: {
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  close: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
