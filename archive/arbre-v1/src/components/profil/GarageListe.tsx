/**
 * Garage — liste des véhicules réels du pilote (référence profil.html,
 * bloc .voiture) : modèle Syncopate 12 uppercase à gauche, année mono 11
 * grise à droite. Données : table `vehicles` (brand, model, year).
 * Aucune valeur inventée : année absente → rien à droite.
 */

import { Text, View } from 'react-native';

import type { VehiculeGarage } from '@/lib/queries/profil';
import { lotProfilTokens as t } from '@/theme/v2';

export function GarageListe({ vehicules }: { vehicules: VehiculeGarage[] }) {
  return (
    <View>
      {vehicules.map((v) => {
        const modele = `${v.brand} ${v.model}`.trim();
        return (
          <View
            key={v.id}
            style={s.voiture}
            accessibilityRole="text"
            accessibilityLabel={v.year ? `${modele}, ${v.year}` : modele}
          >
            <Text style={s.modele} numberOfLines={1}>
              {modele}
            </Text>
            {v.year ? <Text style={s.annee}>{v.year}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const s = {
  voiture: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  modele: {
    flexShrink: 1,
    fontFamily: t.fonts.displayReg,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
  annee: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    color: t.gris,
  },
};
