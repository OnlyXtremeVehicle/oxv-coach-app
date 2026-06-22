import { useFonts } from 'expo-font';
import {
  Geist_300Light,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';

/**
 * Charte refonte (docs/refonte-app) : Geist (titres/corps) + Geist Mono
 * (eyebrows, données, méta — registre HUD/télémétrie).
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
  });
}
