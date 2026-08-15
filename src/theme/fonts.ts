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
// Michroma est SORTI le 15/08/2026 (décision fondateur, QCM — consolidation
// complète). Hanken Grotesk + JetBrains Mono seulement : 11 fichiers au splash.

/**
 * Charte au 15/08/2026 : **Hanken Grotesk** (titres, corps, UI) + **JetBrains
 * Mono** (données, labels, eyebrows, et le CHIFFRE ROI). Deux familles, rien
 * d'autre.
 *
 * Ce paragraphe nommait encore Geist, Rajdhani, Instrument Serif et Geist Mono
 * — quatre familles retirées du dépôt, dont deux depuis la refonte V3 du
 * 10/07. Il décrivait une charte morte au-dessus d'un chargeur qui montait
 * autre chose. Corrigé en même temps que le compte.
 *
 * Renvoie [loaded, error]. Tant que rien n'est chargé, on garde le splash.
 *
 * ===========================================================================
 * DIX-HUIT FICHIERS DE POLICE, PUIS ONZE — 14 ET 15/08/2026
 * ===========================================================================
 *
 * Tout ce que cette fonction monte se charge DEVANT le splash : chaque graisse
 * inutile est du temps de démarrage à froid pris à tous les pilotes.
 *
 * Le 14/08, Syncopate (2) et Inter (4) sont sortis : ils ne servaient qu'à
 * `lotProfilTokens`, dont les seuls importateurs vivent dans `archive/
 * arbre-v1/` — l'arbre V1, hors application.
 *
 * Le 15/08, Michroma (1) est sorti à son tour, sur DÉCISION DU FONDATEUR, qui
 * va plus loin que la recommandation d'alors — « regardez PROFIL et les cartes
 * avant de le figer ». Il reste onze graisses : Hanken Grotesk (7) et
 * JetBrains Mono (4).
 *
 * CE CHANGEMENT N'A PAS ÉTÉ VU. `typo.display` est employé par 39 écrans, dont
 * tout le flux REC et tout l'espace Club, et le quota de builds iOS est épuisé
 * jusqu'au 1er septembre. **Premier geste du premier build de septembre :
 * regarder PROFIL, les cartes et un écran du flux REC.** La réversion est
 * d'une ligne par fichier.
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
    // (Syncopate, Inter, Michroma sortis — consolidation fondateur des 14 et 15/08.)
  });
}
