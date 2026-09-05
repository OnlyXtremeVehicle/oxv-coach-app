/**
 * SecondFacteurRequis — la session n'a pas présenté son second facteur.
 *
 * Affiché par le layout admin quand le compte PORTE un facteur vérifié mais que
 * la session courante est restée au premier niveau d'assurance.
 *
 * ===========================================================================
 * CE N'EST PAS UN ÉCRAN D'ERREUR
 * ===========================================================================
 *
 * Rien n'a échoué : le compte est correctement protégé, et c'est précisément
 * pour cela qu'on demande le code. Le ton suit — on explique, on ne s'excuse
 * pas, et on ne reproche rien.
 *
 * **Il n'est jamais montré à un compte SANS facteur.** Ce serait demander un
 * code qu'aucune application ne peut produire, et enfermer dehors la personne
 * qui pourrait en poser un. `sansSecondFacteur` et `doitPresenterFacteur` ne
 * sont jamais vrais ensemble — un test le vérifie sur les neuf combinaisons.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eleverSession, listerFacteurs, type FacteurInscrit } from '@/services/mfaService';
// R3 — CET ÉCRAN EST DE L'UNIVERS CONSOLE, PAS DE L'UNIVERS PILOTE.
//
// Il importait `colors, PressScale, radius, space, typo` de `@/ui/v2`, le kit
// PILOTE, alors qu'il n'est monté que par `app/(admin)/_layout.tsx:86`. C'était
// l'un des cinq franchissements de R3 mesurés le 03/09/2026, et le plus
// insidieux des deux transitifs : le franchissement ne se voyait pas depuis
// l'écran, seulement depuis ce fichier.
//
// `PressableScale` est l'équivalent v1 de `PressScale` — même échelle, même
// traitement du mouvement réduit — et il est déjà employé par
// `app/(admin)/points-carte.tsx`. Les deux sites d'appel ci-dessous ne passaient
// aucun style, donc la substitution est directe.
//
// L'écran CHANGE d'apparence, et c'est l'intention : il portait les couleurs du
// pilote (`#14151A`) et prend celles de la console (`#0B0B0D`).
import { PressableScale } from '@/components/motion';
import { theme } from '@/theme/v2';

const { palette, spacing, radius, fonts } = theme;

export function SecondFacteurRequis() {
  const insets = useSafeAreaInsets();
  const [facteur, setFacteur] = useState<FacteurInscrit | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let annule = false;
    void listerFacteurs().then((f) => {
      if (!annule) setFacteur(f.find((x) => x.verifie) ?? null);
    });
    return () => {
      annule = true;
    };
  }, []);

  const valider = useCallback(async () => {
    if (occupe || !facteur) return;
    setOccupe(true);
    setErreur(null);
    const res = await eleverSession(facteur.id, code);
    setOccupe(false);
    if (!res.ok) {
      setErreur(res.error ?? 'Code refusé.');
      return;
    }
    // La session est élevée : on repasse par la porte, qui laissera passer.
    router.replace('/(admin)' as never);
  }, [occupe, facteur, code]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl }]}>
      <Text style={styles.eyebrow}>ESPACE ADMINISTRATEUR</Text>
      <Text style={styles.titre} accessibilityRole="header">
        SECOND FACTEUR
      </Text>

      <Text style={styles.corps}>
        Cet espace ouvre l’ensemble des données des pilotes. Saisissez le code à six chiffres de
        votre application d’authentification.
      </Text>

      <TextInput
        style={styles.champ}
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        placeholderTextColor={palette.eyebrow}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        accessibilityLabel="Code à six chiffres"
      />

      <PressableScale onPress={valider} accessibilityLabel="Valider le code">
        <View style={styles.bouton}>
          <Text style={styles.boutonTexte}>{occupe ? 'Vérification…' : 'Valider'}</Text>
        </View>
      </PressableScale>

      {erreur ? (
        <Text style={styles.erreur} accessibilityLiveRegion="polite">
          {erreur}
        </Text>
      ) : null}

      {/* La sortie existe TOUJOURS. Un écran de sécurité sans porte de sortie
          se contourne par la force — on redémarre l'application — et il aura
          juste fait perdre du temps à quelqu'un qui voulait travailler. */}
      <PressableScale
        onPress={() => router.replace('/(app2)' as never)}
        accessibilityLabel="Revenir à l’espace pilote"
      >
        <Text style={styles.sortie}>Revenir à l’espace pilote</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  titre: {
    fontFamily: fonts.bodySemi,
    fontSize: 26,
    letterSpacing: 1,
    color: palette.cream,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  corps: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.cream,
    marginBottom: spacing.xl,
  },
  champ: {
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: 5,
    color: palette.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorderProminent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bouton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorderProminent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  boutonTexte: { fontFamily: fonts.bodyMedium, fontSize: 15, color: palette.cream },
  erreur: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  sortie: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: palette.creamMute,
    marginTop: spacing.xl,
  },
});
