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
import { colors, PressScale, radius, space, typo } from '@/ui/v2';

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
    <View style={[styles.root, { paddingTop: insets.top + space.xxl }]}>
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
        placeholderTextColor={colors.text.low}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        accessibilityLabel="Code à six chiffres"
      />

      <PressScale onPress={valider} accessibilityLabel="Valider le code">
        <View style={styles.bouton}>
          <Text style={styles.boutonTexte}>{occupe ? 'Vérification…' : 'Valider'}</Text>
        </View>
      </PressScale>

      {erreur ? (
        <Text style={styles.erreur} accessibilityLiveRegion="polite">
          {erreur}
        </Text>
      ) : null}

      {/* La sortie existe TOUJOURS. Un écran de sécurité sans porte de sortie
          se contourne par la force — on redémarre l'application — et il aura
          juste fait perdre du temps à quelqu'un qui voulait travailler. */}
      <PressScale
        onPress={() => router.replace('/(app2)' as never)}
        accessibilityLabel="Revenir à l’espace pilote"
      >
        <Text style={styles.sortie}>Revenir à l’espace pilote</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base, paddingHorizontal: space.xl },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  titre: {
    fontFamily: typo.bodySemi,
    fontSize: 26,
    letterSpacing: 1,
    color: colors.text.hi,
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  corps: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text.hi,
    marginBottom: space.xl,
  },
  champ: {
    fontFamily: typo.mono,
    fontSize: 22,
    letterSpacing: 5,
    color: colors.text.hi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    textAlign: 'center',
    marginBottom: space.md,
  },
  bouton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  boutonTexte: { fontFamily: typo.bodyMedium, fontSize: 15, color: colors.text.hi },
  erreur: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.mid,
    marginTop: space.md,
  },
  sortie: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.mid,
    marginTop: space.xl,
  },
});
