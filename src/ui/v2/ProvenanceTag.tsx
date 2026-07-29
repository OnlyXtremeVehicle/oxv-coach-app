/**
 * L'étiquette de provenance, à côté d'un chiffre — jalon 4, phase 4sexies.
 *
 * ---
 *
 * POURQUOI CE COMPOSANT EXISTE
 *
 * Le registre `src/telemetry/provenance.ts` classe chaque grandeur en [M]
 * mesurée, [D] déduite ou [I] inférée. Sans consommateur, ce registre serait la
 * huitième garde posée et jamais armée de ce dépôt — et ce lot commençait
 * précisément par en constater une septième.
 *
 * Ce composant est ce consommateur.
 *
 * ---
 *
 * CE QU'IL AFFICHE, ET CE QU'IL TAIT
 *
 * Une mesure ne s'annonce pas. `[M]` n'apprend rien au pilote : il lit un
 * chiffre de son boîtier, c'est le cas normal. Étiqueter le normal use
 * l'attention et rend le signal invisible quand il compte.
 *
 * Une déduction ne s'annonce pas non plus dans le fil de lecture. `∫ v dt` est
 * une distance ; le dire à chaque ligne serait du bruit. Le détail reste
 * accessible par la méthode de la lecture.
 *
 * **Seule l'inférence s'annonce.** Elle repose sur une hypothèse qui peut être
 * fausse, et le pilote a le droit de savoir laquelle avant d'en tirer une
 * conclusion sur sa conduite.
 *
 * `toujours` force l'affichage pour les trois niveaux — utile dans un écran de
 * méthode, où l'on montre justement la mécanique.
 */

import { StyleSheet, Text, View } from 'react-native';

import { etiquette, grandeur, libelleProvenance } from '@/telemetry/provenance';
import { theme } from '@/theme/v2';

const { palette, fonts } = theme;

export interface ProvenanceTagProps {
  /** Clé du registre, `module.champ`. */
  cle: string;
  /** Afficher aussi [M] et [D]. Défaut : seules les inférences s'annoncent. */
  toujours?: boolean;
  /** Joindre l'hypothèse sous l'étiquette. Défaut : oui pour une inférence. */
  avecSource?: boolean;
}

export function ProvenanceTag({ cle, toujours = false, avecSource }: ProvenanceTagProps) {
  const g = grandeur(cle);

  // Une clé inconnue n'affiche rien plutôt qu'une étiquette vide : le registre
  // est la source, pas cet écran. Le test du registre attrape l'absence.
  if (!g) return null;
  if (!toujours && g.prov !== 'I') return null;

  const montrerSource = avecSource ?? g.prov === 'I';

  return (
    <View style={s.bloc}>
      <View style={s.ligne}>
        <Text style={[s.badge, g.prov === 'I' && s.badgeInfere]} accessibilityRole="text">
          {etiquette(g.prov)}
        </Text>
        <Text style={s.libelle}>{libelleProvenance(g.prov)}</Text>
      </View>

      {montrerSource ? (
        <Text style={s.source} accessibilityLabel={`Méthode : ${nettoyer(g.source)}`}>
          {nettoyer(g.source)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Le registre met l'hypothèse entre astérisques pour la faire ressortir à la
 * lecture du code. À l'écran, on ne rend pas du Markdown : on retire les
 * marqueurs plutôt que d'afficher des astérisques nus.
 */
function nettoyer(texte: string): string {
  return texte.replace(/\*\*/g, '');
}

const s = StyleSheet.create({
  bloc: { gap: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.creamMute,
  },
  // L'inférence est la seule qui mérite d'être vue de loin — sans alarmer :
  // crème appuyé, jamais le rouge, qui reste au chrono et à l'enregistrement.
  badgeInfere: { color: palette.cream },
  libelle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  source: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: palette.creamMute,
  },
});
