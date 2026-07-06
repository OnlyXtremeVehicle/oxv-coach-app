import { useFonts } from 'expo-font';
import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
// Refonte NG (2026-07-06, compromis fondateur) : Rajdhani = chiffre roi (HUD),
// JetBrains Mono = données/labels. Geist conservé pour le texte.
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { Rajdhani_500Medium, Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani';

/**
 * Charte NG (refonte 2026-07-06) : Geist (titres/corps) + Rajdhani (CHIFFRE ROI,
 * héros HUD) + JetBrains Mono (données/labels/eyebrows) + Instrument Serif
 * (touches éditoriales : ligne-miroir, mot qualitatif, citation coach — JAMAIS
 * un chiffre d'instrument). Geist Mono conservé en secours.
 * Renvoie [loaded, error]. Tant que rien n'est chargé, on garde le splash.
 */
export function useAppFonts() {
  return useFonts({
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
}
