import { useFonts } from 'expo-font';
import { Syncopate_400Regular, Syncopate_700Bold } from '@expo-google-fonts/syncopate';
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

/**
 * Charge les polices de la charte V2 (Syncopate / Inter / JetBrains Mono).
 * Renvoie [loaded, error]. Tant que rien n'est chargé, on garde le splash.
 */
export function useAppFonts() {
  return useFonts({
    Syncopate_400Regular,
    Syncopate_700Bold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
}
