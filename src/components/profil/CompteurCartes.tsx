/**
 * Compteur de cartes — l'ODOMÈTRE, élément signature du profil (référence
 * profil.html, bloc .compteur). Seule statistique publique du profil.
 *
 * Pixel-perfect : carte surface #141414, liseré rouge 3 px à gauche, eyebrow
 * mono 10, cellules chiffres JetBrainsMono_700Bold 44 px (fond noir, bordure
 * ligne, min 44), unité Syncopate 13, sous-ligne mono 10 #555555.
 *
 * Zero-pad 3 digits (spec §6) ; à 1000+ le padStart passe naturellement à
 * 4 cellules. PRESSABLE : c'est LE point d'entrée du Panel de cartes.
 */

import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { lotProfilTokens as t } from '@/theme/v2';

export interface CompteurCartesProps {
  total: number;
  /** Sous-ligne circuit (« Circuit de Haute Saintonge · … ») — null : masquée. */
  sousLigne: string | null;
  onPress: () => void;
}

export function CompteurCartes({ total, sousLigne, onPress }: CompteurCartesProps) {
  const borne = Math.max(0, Math.floor(total));
  const digits = String(borne).padStart(3, '0').split('');

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${borne} cartes de session. Ouvrir le panel de cartes.`}
      pressedOpacity={0.7}
      pressedScale={0.98}
      style={s.carte}
    >
      <View style={s.liseret} pointerEvents="none" />
      <Text style={s.eyebrow}>Cartes de session</Text>
      <View style={s.odometre}>
        <View style={s.digits}>
          {digits.map((d, i) => (
            <Text key={`${i}-${d}`} style={s.digit}>
              {d}
            </Text>
          ))}
        </View>
        <Text style={s.unite}>Cartes</Text>
      </View>
      {sousLigne ? <Text style={s.sousLigne}>{sousLigne}</Text> : null}
    </PressableScale>
  );
}

const s = {
  carte: {
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    backgroundColor: t.surface,
    padding: 20,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  liseret: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: t.rouge,
  },
  eyebrow: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  odometre: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: 12,
    marginTop: 10,
  },
  digits: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  digit: {
    fontFamily: t.fonts.monoBold,
    fontSize: 44,
    lineHeight: 44,
    color: t.blanc,
    backgroundColor: t.noir,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 44,
    textAlign: 'center' as const,
    overflow: 'hidden' as const,
  },
  unite: {
    fontFamily: t.fonts.displayReg,
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  sousLigne: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    color: t.grisSombre,
    letterSpacing: 0.8,
    marginTop: 12,
  },
};
