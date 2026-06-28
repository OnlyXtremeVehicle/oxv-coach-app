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

/**
 * Charte refonte (docs/refonte-app) : Geist (titres/corps) + Geist Mono
 * (eyebrows, données, méta — registre HUD/télémétrie) + Instrument Serif
 * (touches éditoriales : grands titres hero, mot qualitatif du bilan en
 * italique, citation coach, dates hero — JAMAIS un chiffre d'instrument,
 * cf. `04_DESIGN_CANON §2`).
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
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
}
