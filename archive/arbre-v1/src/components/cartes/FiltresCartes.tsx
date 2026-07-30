/**
 * Filtres du Panel de cartes — rangée horizontale de puces (référence
 * panel-cartes.html, bloc .filtres) : mono 10 uppercase, bordure ligne,
 * padding 8/14, rayon 2 ; puce active = texte et bordure blancs.
 *
 * Les valeurs viennent des cartes RÉELLES (années, météos, voitures
 * distinctes) — construites par `construireFiltres` (cartesLogic).
 */

import { ScrollView, Text } from 'react-native';

import { PressableScale } from '@/components/motion';
import { type FiltreCartes, libelleFiltre, memeFiltre } from '@/lib/queries/cartesLogic';
import { lotProfilTokens as t } from '@/theme/v2';

export interface FiltresCartesProps {
  filtres: FiltreCartes[];
  actif: FiltreCartes;
  onChoisir: (filtre: FiltreCartes) => void;
}

export function FiltresCartes({ filtres, actif, onChoisir }: FiltresCartesProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.rangee}
      contentContainerStyle={s.contenu}
    >
      {filtres.map((filtre) => {
        const estActif = memeFiltre(filtre, actif);
        const libelle = libelleFiltre(filtre);
        return (
          <PressableScale
            key={`${filtre.type}-${libelle}`}
            onPress={() => onChoisir(filtre)}
            accessibilityRole="button"
            accessibilityState={{ selected: estActif }}
            accessibilityLabel={`Filtre ${libelle}`}
            pressedOpacity={0.7}
            style={[s.puce, estActif ? s.puceActive : null]}
          >
            <Text style={[s.texte, estActif ? s.texteActif : null]} numberOfLines={1}>
              {libelle}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const s = {
  rangee: {
    marginTop: 18,
    flexGrow: 0,
  },
  contenu: {
    paddingHorizontal: 20,
    gap: 8,
  },
  puce: {
    borderWidth: 1,
    borderColor: t.ligne,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 2,
    flexShrink: 0,
  },
  puceActive: {
    borderColor: t.blanc,
  },
  texte: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  texteActif: {
    color: t.blanc,
  },
};
