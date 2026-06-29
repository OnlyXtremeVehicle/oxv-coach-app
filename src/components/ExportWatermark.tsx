/**
 * ExportWatermark (V9 §17 Exports) — la signature gravée dans l'image partagée.
 *
 * Posée au pied de la carte trophée (OXV Moment), elle voyage AVEC l'image hors
 * de l'app : la marque, et surtout la MÉTHODE rendue visible — « lecture OXV,
 * pas un chronométrage officiel ». Quiconque voit l'image sait que c'est une
 * lecture personnelle, pas un temps homologué ni un classement (doctrine
 * d'honnêteté + miroir). Sobre, faint, mono ; le rouge reste à la marque.
 */

import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';

export function ExportWatermark() {
  return (
    <View style={s.wrap}>
      <Text style={s.brand}>ONLY XTREME VEHICLE · OXVEHICLE.FR</Text>
      <Text style={s.method}>LECTURE OXV · PAS UN CHRONOMÉTRAGE OFFICIEL</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1E',
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  brand: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 2.2,
    color: theme.palette.faint,
  },
  method: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.4,
    color: theme.palette.faint,
    marginTop: 4,
  },
});
