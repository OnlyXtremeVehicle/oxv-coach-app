/**
 * BarresG — ce que la voiture a vécu dans un virage, en trois barres.
 *
 * Porté depuis `src/components/GForceBars.tsx` (kit V1) au lot J5, sur décision
 * fondateur du 29/07/2026 (« porter les deux »).
 *
 * ---
 *
 * LA COULEUR DIT LA DIMENSION, JAMAIS LA PERFORMANCE
 *
 * C'était déjà la règle du composant V1, et elle est conservée telle quelle :
 * chaque barre porte la teinte de SON AXE, pas un jugement sur la valeur.
 * Aucune barre ne devient rouge « parce que c'est beaucoup » — le rouge du
 * freinage est le rouge DU FREINAGE, celui de la branche QDI, quelle que soit
 * l'intensité.
 *
 * Le latéral reste en crème : il n'a pas de branche QDI à lui, et l'or code le
 * chrono. Une charge en virage n'est pas un chrono.
 *
 * ---
 *
 * L'ÉCHELLE EST COMMUNE AUX TROIS BARRES
 *
 * Sans quoi comparer les axes d'un coup d'œil serait un piège : trois barres
 * pleines diraient « autant partout » alors que les valeurs diffèrent. Une
 * valeur qui dépasse l'échelle sature la barre, et le chiffre — lui — reste
 * exact à côté.
 *
 * ---
 *
 * CE QUE CES CHIFFRES SONT, ET À QUELLE ÉCHELLE
 *
 * Ils viennent de `app_segment_analyses`, une ligne par (séance, virage).
 * **Il n'existe aucune donnée de G par TOUR** : la table n'a pas de colonne de
 * tour. Ces barres décrivent donc le virage sur toute la séance, et ne peuvent
 * pas être comparées entre deux tours. C'est aussi pourquoi l'écran V1
 * `virage-comparer` les avait écartées de sa comparaison.
 *
 * Une valeur absente s'affiche « — ». Jamais zéro.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, space, typo } from '@/ui/v2';

/** Échelle par défaut, en g. Couvre largement une voiture de série sur piste. */
const ECHELLE_G = 2.0;

export interface BarresGProps {
  /** G latéral maxi (positif). */
  lateralG: number | null;
  /** G de freinage maxi, en valeur absolue de la décélération. */
  freinageG: number | null;
  /** G d'accélération maxi (positif). */
  accelerationG: number | null;
  echelleMaxG?: number;
}

export function BarresG({
  lateralG,
  freinageG,
  accelerationG,
  echelleMaxG = ECHELLE_G,
}: BarresGProps) {
  return (
    <View style={styles.pile}>
      <Barre label="Latéral" valeur={lateralG} echelle={echelleMaxG} teinte={colors.text.hi} />
      <Barre
        label="Freinage"
        valeur={freinageG}
        echelle={echelleMaxG}
        teinte={colors.qdi.freinage}
      />
      <Barre
        label="Accélération"
        valeur={accelerationG}
        echelle={echelleMaxG}
        teinte={colors.qdi.acceleration}
      />
    </View>
  );
}

function Barre({
  label,
  valeur,
  echelle,
  teinte,
}: {
  label: string;
  valeur: number | null;
  echelle: number;
  teinte: string;
}) {
  const mesure = valeur !== null && Number.isFinite(valeur);
  // La barre sature à l'échelle ; le chiffre à droite, lui, reste exact.
  const part = mesure ? Math.min(Math.abs(valeur) / echelle, 1) : 0;
  const texte = mesure ? `${Math.abs(valeur).toFixed(2)} g` : '—';

  return (
    <View accessible accessibilityLabel={`${label}, ${mesure ? texte : 'non mesuré'}`}>
      <View style={styles.ligneHaut}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valeur, mesure ? { color: teinte } : null]}>{texte}</Text>
      </View>
      <View style={styles.rail}>
        {/* Aucune barre dessinée quand rien n'est mesuré : un rail vide dit
            « pas de mesure », une barre de largeur nulle dirait « zéro g ». */}
        {mesure ? (
          <View
            style={[styles.remplissage, { width: `${part * 100}%`, backgroundColor: teinte }]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pile: { gap: space.md },
  ligneHaut: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { fontFamily: typo.body, fontSize: 13, color: colors.text.mid },
  valeur: {
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.dim,
    fontVariant: ['tabular-nums'],
  },
  rail: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg.card2,
    overflow: 'hidden',
  },
  remplissage: { height: 6, borderRadius: 3 },
});
