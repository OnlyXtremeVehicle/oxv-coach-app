/**
 * AppBar — barre de titre, langage refonte-v2 (règle fondateur 2026-07-12 :
 * le graphique v2 fait loi ; l'héritage est retravaillé, pas collé).
 *
 * Deux modes, calqués sur les maquettes :
 *  - ÉCRAN DE DÉTAIL (`onBack`) : chevron dans une PASTILLE RONDE (34 px,
 *    surface-2) à gauche, TITRE CENTRÉ (sentence-case Hanken semibold),
 *    action réelle à droite via `trailing` (pastille assortie côté écran).
 *  - ÉCRAN RACINE (`leading`, ex. logo) : layout à gauche, comme les hubs.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

function Chevron() {
  return <View style={styles.chev} />;
}

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leading?: React.ReactNode; // ex. <Logo /> sur les écrans racines
  trailing?: React.ReactNode;
};

export function AppBar({ title, subtitle, onBack, leading, trailing }: Props) {
  // Détail (retour) : titre CENTRÉ entre les pastilles (maquettes §7.2-§7.8).
  if (onBack) {
    return (
      <View style={styles.bar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={12}
          style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}
        >
          <Chevron />
        </Pressable>
        <View pointerEvents="none" style={styles.centerWrap}>
          <Text numberOfLines={1} style={styles.titleCentered}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.sub, { textAlign: 'center' }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightSlot}>{trailing ?? null}</View>
      </View>
    );
  }

  // Racine : leading (logo) à gauche, titre aligné, action à droite.
  return (
    <View style={styles.bar}>
      {leading ?? null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {trailing ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 50,
  },
  // Pastille ronde de retour (maquette : cercle sombre surface-2).
  roundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  chev: {
    width: 9,
    height: 9,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: theme.palette.creamSoft,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  // Titre centré ABSOLU : reste au centre optique quelle que soit la largeur
  // des pastilles gauche/droite (padding 56 > pastille + gap).
  centerWrap: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: 8,
    bottom: 12,
    justifyContent: 'center',
  },
  titleCentered: {
    fontFamily: theme.fonts.display,
    fontSize: 15,
    letterSpacing: 0.2,
    color: theme.palette.cream,
    textAlign: 'center',
  },
  rightSlot: { marginLeft: 'auto', zIndex: 1 },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 1.3,
    color: theme.palette.cream,
  },
  sub: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginTop: 3,
  },
});
