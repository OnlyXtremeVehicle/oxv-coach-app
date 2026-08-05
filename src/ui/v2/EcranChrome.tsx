/**
 * Coquille d'écran V2 — le chevron de retour et les quatre styles d'en-tête.
 *
 * ---
 *
 * POURQUOI CE MODULE EXISTE
 *
 * Le kit V2 n'a ni `Screen` ni `AppBar` : chaque écran compose son en-tête —
 * chevron, titre en capitales, espaceur symétrique. C'est un choix assumé, et
 * il produit une duplication réelle : dix écrans portent aujourd'hui leur
 * propre `BackChevron`, tracé à l'identique.
 *
 * Ce module ne prétend pas régler cette duplication. Il est né d'un besoin
 * précis : la scission de `rec/equipement` en deux écrans, le 05/08/2026, qui
 * aurait produit une onzième copie.
 *
 * **Ne migrez pas les dix autres en passant.** Chacun a ses variantes de
 * marges, et les toucher ensemble ferait un lot à part entière, avec sa propre
 * vérification visuelle sur appareil.
 *
 * ---
 *
 * LE REGISTRE D'ICÔNES N'A PAS DE FLÈCHE
 *
 * D'où le tracé local. Ce n'est pas un oubli : le registre OXV ne porte que des
 * icônes de domaine — chrono, casque, drapeau. Un chevron de navigation n'en
 * est pas une.
 */

import Svg, { Path } from 'react-native-svg';
import { StyleSheet } from 'react-native';

// `type` est exporté sous l'alias `typo` par le baril ; ici on importe le
// module directement pour ne pas créer de cycle avec `index.ts`.
import { colors, space, type as typo } from './tokens';

/** Chevron de retour. 22 × 22, trait de 1,8. */
export function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Les quatre clés d'en-tête, identiques d'un écran à l'autre.
 *
 * `headerSpacer` vaut exactement la largeur du chevron : c'est lui qui centre
 * le titre. Le retirer décale le titre de onze points vers la gauche, ce qui ne
 * se voit qu'en comparant deux écrans côte à côte.
 */
export const chromeStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerSpacer: {
    width: 22,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
});
