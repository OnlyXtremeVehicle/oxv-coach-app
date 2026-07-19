/**
 * TabBar — la barre 5 portes V2 (lot L0, Livrable 7).
 *
 * miroir · data · [CentralButton] · club · vous (icône casque). Fond
 * expo-blur (tint dark, intensité 30) posé AU-DESSUS du contenu qui défile
 * dessous, hairline top. Porte active : couleur `text.hi` + scale 1.06 en
 * spring ; inactive : `text.low`. Safe-area basse respectée.
 *
 * AUCUNE dépendance à expo-router ici : la route courante et la navigation
 * sont passées par le layout (`current` / `onNavigate`). Table des portes
 * pure dans shellLogic (TAB_ITEMS, TAB_BAR_HEIGHT, tabScale) — testée.
 */

import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CentralButton } from './CentralButton';
import { haptic } from './haptics';
import { OxvIcon } from './icons';
import { useReduceMotion } from './motion';
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_OVERHANG,
  TAB_ITEMS,
  tabScale,
  type CentralButtonMode,
  type TabItem,
  type TabKey,
} from './shellLogic';
import { colors, motion, space } from './tokens';

/** Intensité du blur de fond. */
const BAR_BLUR = 30;

export interface TabBarCentralProps {
  mode: CentralButtonMode;
  /** Label court du bouton central (ex. 'J-3' en countdown). */
  label?: string;
  onPress: () => void;
}

export interface TabBarProps {
  current: TabKey;
  onNavigate: (tab: TabKey) => void;
  central: TabBarCentralProps;
}

interface TabDoorProps {
  item: TabItem;
  active: boolean;
  onPress: () => void;
}

function TabDoor({ item, active, onPress }: TabDoorProps) {
  const reduce = useReduceMotion();
  const scale = useSharedValue(tabScale(active));

  useEffect(() => {
    if (reduce) {
      scale.value = tabScale(active);
      return;
    }
    scale.value = withSpring(tabScale(active), motion.spring);
  }, [active, reduce, scale]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    haptic('tap');
    onPress();
  };

  return (
    <Pressable
      style={styles.door}
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={scaleStyle}>
        <OxvIcon name={item.icon} size={24} color={active ? colors.text.hi : colors.text.low} />
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ current, onNavigate, central }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const doors = TAB_ITEMS.map((item) => (
    <TabDoor
      key={item.key}
      item={item}
      active={item.key === current}
      onPress={() => onNavigate(item.key)}
    />
  ));

  // Les bounds de la barre incluent le débord du CentralButton
  // (TAB_BAR_OVERHANG) : sur Android, le hit-testing est clippé aux bounds
  // de CHAQUE ancêtre — sans ce débord dans la hiérarchie, le haut du cercle
  // (~10 px) était une zone morte tactile. Le fond blur reste décalé d'autant
  // (top: TAB_BAR_OVERHANG) : la hauteur VISUELLE de la barre ne change pas.
  // `box-none` sur root/row/slot : la bande de débord hors bouton laisse
  // passer les touches vers le contenu, comme avant.
  return (
    <View
      style={[styles.root, { paddingBottom: Math.max(insets.bottom, space.sm) }]}
      pointerEvents="box-none"
    >
      {/* ANDROID : repli OPAQUE déterministe (aplat bg.base 0.92), même choix
          que le header condensé — dimezisBlurView re-blur par frame sous le
          contenu qui défile en permanence sous la barre (coûteux, artefacts).
          iOS garde le vrai blur. */}
      <View style={styles.blurFrame}>
        {Platform.OS === 'android' ? (
          <View style={[StyleSheet.absoluteFillObject, styles.androidFill]} />
        ) : (
          <BlurView intensity={BAR_BLUR} tint="dark" style={StyleSheet.absoluteFillObject} />
        )}
      </View>
      <View style={styles.row} pointerEvents="box-none">
        {doors[0]}
        {doors[1]}
        <View style={styles.centralSlot} pointerEvents="box-none">
          <CentralButton mode={central.mode} label={central.label} onPress={central.onPress} />
        </View>
        {doors[2]}
        {doors[3]}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Le cadre visuel de la barre : hairline top + blur, décalé sous le débord.
  blurFrame: {
    ...StyleSheet.absoluteFillObject,
    top: TAB_BAR_OVERHANG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    overflow: 'hidden',
  },
  androidFill: {
    backgroundColor: colors.bg.base,
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT + TAB_BAR_OVERHANG,
    alignItems: 'flex-end',
  },
  door: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Étiré sur toute la rangée (débord compris) pour que le cercle entier
  // reste dans les bounds ; paddingTop recentre le bouton dans la zone 56 px.
  centralSlot: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: TAB_BAR_OVERHANG,
  },
});
