import { useFonts } from 'expo-font';
// Refonte NG (2026-07-06, compromis fondateur) : Rajdhani = chiffre roi (HUD),
// JetBrains Mono = données/labels. Geist conservé pour le texte.
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
// Refonte V3 (2026-07-10, handoff design complet) : Hanken Grotesk = texte/titres/
// UI ; JetBrains Mono = données + CHIFFRE ROI (mono, plus de Rajdhani ni serif).
import {
  HankenGrotesk_300Light,
  HankenGrotesk_400Regular,
  HankenGrotesk_400Regular_Italic,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
// Programme V2 (DA Instrument, 18/07/2026) : Michroma = display des écrans (app2).
import { Michroma_400Regular } from '@expo-google-fonts/michroma';

/**
 * Charte NG (refonte 2026-07-06) : Geist (titres/corps) + Rajdhani (CHIFFRE ROI,
 * héros HUD) + JetBrains Mono (données/labels/eyebrows) + Instrument Serif
 * (touches éditoriales : ligne-miroir, mot qualitatif, citation coach — JAMAIS
 * un chiffre d'instrument). Geist Mono conservé en secours.
 * Renvoie [loaded, error]. Tant que rien n'est chargé, on garde le splash.
 *
 * ===========================================================================
 * DIX-HUIT FICHIERS DE POLICE, PUIS DOUZE — 14/08/2026
 * ===========================================================================
 *
 * Tout ce que cette fonction monte se charge DEVANT le splash : chaque graisse
 * inutile est du temps de démarrage à froid pris à tous les pilotes.
 *
 * Syncopate (2) et Inter (4) sont sortis. Ils ne servaient qu'à
 * `lotProfilTokens`, dont les seuls importateurs vivent dans `archive/
 * arbre-v1/` — l'arbre V1, hors application. Six fichiers chargés à chaque
 * démarrage pour une table que rien de vivant ne lisait.
 *
 * Restent douze : Hanken Grotesk (7) pour le texte, JetBrains Mono (4) pour la
 * donnée et le chiffre roi, Michroma (1) pour le display des écrans app2.
 * Michroma tient encore par un fil — `typo.display` de `src/ui/v2/tokens.ts`
 * est employé par 39 écrans, et on ne bascule pas une identité sans l'avoir
 * vue (le quota de builds iOS est épuisé jusqu'au 1er septembre).
 *
 * `policesChargees.test.ts` tient l'invariant dans les deux sens : toute
 * police NOMMÉE dans `src/` ou `app/` doit être montée ici, faute de quoi
 * React Native retombe EN SILENCE sur la police système.
 */
export function useAppFonts() {
  return useFonts({
    // V3 (refonte design complète) : Hanken Grotesk + JetBrains Mono.
    HankenGrotesk_300Light,
    HankenGrotesk_400Regular,
    HankenGrotesk_400Regular_Italic,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
    // Programme V2 (DA Instrument) : display Michroma des écrans (app2).
    Michroma_400Regular,
  });
}
