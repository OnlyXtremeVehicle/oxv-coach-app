/**
 * Barre de comparaison — fixe en bas du Panel de cartes (référence
 * panel-cartes.html, bloc .barre-comparaison).
 *
 * `position: fixed` de la référence → absolute bottom 0 dans l'écran ; le
 * scroll de l'écran garde un paddingBottom = hauteur barre + safe area
 * (spec §6). `backdrop-filter: blur` → expo-blur ABSENT des dépendances :
 * fond rgba(10,10,10,0.94) simple, comme prévu par la spec (aucune
 * dépendance ajoutée).
 *
 * Apparaît dès 1 carte sélectionnée ; le bouton « Comparer » n'est actif
 * qu'à exactement 2 (comparaison self vs self exclusivement).
 */

import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPresence, PressableScale } from '@/components/motion';
import { lotProfilTokens as t } from '@/theme/v2';

export interface BarreComparaisonProps {
  visible: boolean;
  /** Numéros zero-paddés des cartes sélectionnées (« 024 », « 021 »). */
  numeros: string[];
  /** true à exactement 2 cartes — active le bouton. */
  prete: boolean;
  onComparer: () => void;
}

export function BarreComparaison({ visible, numeros, prete, onComparer }: BarreComparaisonProps) {
  const insets = useSafeAreaInsets();
  const n = numeros.length;

  return (
    <AnimatedPresence visible={visible} style={s.ancrage}>
      <View style={[s.barre, { paddingBottom: 22 + insets.bottom }]}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.selectionForte}>
            {n} {n > 1 ? 'cartes sélectionnées' : 'carte sélectionnée'}
          </Text>
          <Text style={s.selection}>{numeros.join(' · ')}</Text>
        </View>
        <PressableScale
          onPress={onComparer}
          disabled={!prete}
          accessibilityRole="button"
          accessibilityState={{ disabled: !prete }}
          accessibilityLabel="Comparer les deux cartes sélectionnées"
          pressedOpacity={0.7}
          style={[s.bouton, !prete ? s.boutonInactif : null]}
        >
          <Text style={s.boutonTexte}>Comparer</Text>
        </PressableScale>
      </View>
    </AnimatedPresence>
  );
}

const s = {
  ancrage: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
  },
  barre: {
    backgroundColor: 'rgba(10,10,10,0.94)',
    borderTopWidth: 1,
    borderTopColor: t.ligne,
    paddingTop: 14,
    paddingHorizontal: 20,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 14,
  },
  selectionForte: {
    fontFamily: t.fonts.monoBold,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
  selection: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 16,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  bouton: {
    backgroundColor: t.rouge,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 2,
    flexShrink: 0,
  },
  boutonInactif: {
    opacity: 0.4,
  },
  boutonTexte: {
    fontFamily: t.fonts.display,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
};
