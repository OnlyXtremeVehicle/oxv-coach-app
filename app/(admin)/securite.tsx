/**
 * SÉCURITÉ DU COMPTE — enrôlement du second facteur (TOTP).
 *
 * ===========================================================================
 * POURQUOI CET ÉCRAN EXISTE
 * ===========================================================================
 *
 * La politique de confidentialité affichée aux pilotes annonce une
 * « authentification forte pour les comptes administrateurs (2FA TOTP
 * obligatoire) ». Vérifié en production le 12/08/2026 : **zéro facteur enrôlé
 * sur les trois comptes administrateurs.** Ni écran d'enrôlement, ni contrôle
 * du niveau d'assurance. « Obligatoire » ne désignait aucun mécanisme.
 *
 * ===========================================================================
 * CE QUE CET ÉCRAN NE PEUT PAS FAIRE
 * ===========================================================================
 *
 * **Enrôler à la place de quelqu'un.** Un facteur posé par un tiers est un
 * secret que ce tiers connaît — ce n'est plus un second facteur. Le titulaire
 * scanne le code avec SON application et confirme avec un code qu'il est seul
 * à lire. L'écran porte la mécanique ; le geste lui appartient.
 *
 * ===========================================================================
 * DOCTRINE
 * ===========================================================================
 *
 * Sobre, vouvoyé, sans emoji. Le secret en clair est proposé en repli — un
 * QR ne se scanne pas toujours — et n'est JAMAIS journalisé : un journal part
 * chez un tiers, et c'est un secret d'authentification.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  commencerEnrolement,
  confirmerEnrolement,
  listerFacteurs,
  lireNiveauAssurance,
  retirerFacteur,
  type EnrolementCommence,
  type FacteurInscrit,
} from '@/services/mfaService';
// R3 — CET ÉCRAN EST DE LA CONSOLE, ET PORTAIT LE KIT PILOTE.
//
// Il importait `colors, PressScale, radius, space, typo` de `@/ui/v2` : l'un des
// cinq franchissements de R3 mesurés le 03/09/2026, et l'un des trois directs.
//
// `PressableScale` est l'équivalent v1 de `PressScale`, déjà employé par
// `app/(admin)/points-carte.tsx` — même groupe de routes. Les quatre sites
// d'appel ci-dessous ne passaient aucun style : la substitution est directe.
//
// L'écran CHANGE d'apparence, et c'est l'intention. Il peignait `#14151A`, le
// fond du pilote ; il prend `#0B0B0D`, celui de la console, comme ses trente-
// deux voisins.
import { PressableScale } from '@/components/motion';
import { theme } from '@/theme/v2';

const { palette, spacing, radius, fonts } = theme;

type Phase = 'chargement' | 'aucun' | 'enrolement' | 'inscrit';

export default function SecuriteScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('chargement');
  const [facteurs, setFacteurs] = useState<FacteurInscrit[]>([]);
  const [enrolement, setEnrolement] = useState<EnrolementCommence | null>(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [niveau, setNiveau] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    const [f, n] = await Promise.all([listerFacteurs(), lireNiveauAssurance()]);
    setFacteurs(f);
    setNiveau(n.courant);
    setPhase(f.some((x) => x.verifie) ? 'inscrit' : 'aucun');
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const demarrer = async (): Promise<void> => {
    if (occupe) return;
    setOccupe(true);
    setErreur(null);
    const res = await commencerEnrolement();
    setOccupe(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setEnrolement(res.data);
    setPhase('enrolement');
  };

  const confirmer = async (): Promise<void> => {
    if (occupe || !enrolement) return;
    setOccupe(true);
    setErreur(null);
    const res = await confirmerEnrolement(enrolement.factorId, code);
    setOccupe(false);
    if (!res.ok) {
      setErreur(res.error ?? 'Code refusé.');
      return;
    }
    setEnrolement(null);
    setCode('');
    await recharger();
  };

  const retirer = async (id: string): Promise<void> => {
    if (occupe) return;
    setOccupe(true);
    setErreur(null);
    const res = await retirerFacteur(id);
    setOccupe(false);
    if (!res.ok) {
      setErreur(res.error ?? 'Retrait impossible.');
      return;
    }
    await recharger();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.xl,
        paddingHorizontal: spacing.xl,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
    >
      <Text style={styles.eyebrow}>COMPTE ADMINISTRATEUR</Text>
      <Text style={styles.titre} accessibilityRole="header">
        SÉCURITÉ
      </Text>

      {phase === 'chargement' ? <Text style={styles.corps}>Lecture…</Text> : null}

      {phase === 'aucun' ? (
        <View style={styles.bloc}>
          <Text style={styles.corps}>
            Ce compte n’a pas de second facteur. Un mot de passe seul protège l’accès à l’ensemble
            des données des pilotes, y compris leur cardio.
          </Text>
          <Text style={styles.note}>
            Il vous faut une application d’authentification — Google Authenticator, Aegis,
            1Password, ou celle de votre gestionnaire de mots de passe.
          </Text>
          <PressableScale onPress={demarrer} accessibilityLabel="Ajouter un second facteur">
            <View style={styles.bouton}>
              <Text style={styles.boutonTexte}>
                {occupe ? 'Préparation…' : 'Ajouter un second facteur'}
              </Text>
            </View>
          </PressableScale>
        </View>
      ) : null}

      {phase === 'enrolement' && enrolement ? (
        <View style={styles.bloc}>
          <Text style={styles.corps}>
            Scannez ce code avec votre application d’authentification, puis saisissez le code à six
            chiffres qu’elle affiche.
          </Text>

          <View style={styles.qr}>
            <QRCode value={enrolement.uri} size={200} backgroundColor="#FFFFFF" />
          </View>

          {/* REPLI — un QR ne se scanne pas toujours. Le secret est affiché, jamais
              journalisé : c'est un secret d'authentification, et un journal part
              chez un tiers. */}
          <Text style={styles.note}>Si le code ne se scanne pas, saisissez cette clé :</Text>
          <Text style={styles.secret} selectable>
            {enrolement.secret}
          </Text>

          <TextInput
            style={styles.champ}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={palette.eyebrow}
            keyboardType="number-pad"
            maxLength={6}
            accessibilityLabel="Code à six chiffres"
          />

          <PressableScale onPress={confirmer} accessibilityLabel="Confirmer le second facteur">
            <View style={styles.bouton}>
              <Text style={styles.boutonTexte}>{occupe ? 'Vérification…' : 'Confirmer'}</Text>
            </View>
          </PressableScale>

          <Text style={styles.note}>
            Tant que ce pas n’est pas franchi, le facteur ne protège rien.
          </Text>
        </View>
      ) : null}

      {phase === 'inscrit' ? (
        <View style={styles.bloc}>
          <Text style={styles.corps}>
            Ce compte porte un second facteur.
            {niveau === 'aal2'
              ? ' Votre session l’a présenté.'
              : ' Votre session ne l’a pas encore présenté.'}
          </Text>
          {facteurs
            .filter((f) => f.verifie)
            .map((f) => (
              <View key={f.id} style={styles.ligne}>
                <Text style={styles.corps}>{f.nom}</Text>
                <PressableScale
                  onPress={() => void retirer(f.id)}
                  accessibilityLabel={`Retirer ${f.nom}`}
                >
                  <Text style={styles.retirer}>Retirer</Text>
                </PressableScale>
              </View>
            ))}
          {/* Un facteur qu'on ne peut pas retirer est un compte perdu avec son
              téléphone. Le retrait exige une session déjà élevée — Supabase le
              vérifie, ce n'est pas à cet écran de le refaire. */}
          <Text style={styles.note}>
            Enrôlez un second appareil, ou conservez un accès de récupération hors ligne. Sans cela,
            la perte du téléphone ferme le compte.
          </Text>
        </View>
      ) : null}

      {erreur ? (
        <Text style={styles.erreur} accessibilityLiveRegion="polite">
          {erreur}
        </Text>
      ) : null}

      <PressableScale onPress={() => router.back()} accessibilityLabel="Retour">
        <Text style={styles.retour}>Retour</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night },
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
    marginBottom: spacing.xl,
  },
  bloc: { marginBottom: spacing.xl },
  corps: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    color: palette.cream,
    marginBottom: spacing.md,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  qr: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  secret: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 1.4,
    color: palette.cream,
    marginBottom: spacing.lg,
  },
  champ: {
    fontFamily: fonts.mono,
    fontSize: 20,
    letterSpacing: 4,
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
  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  retirer: { fontFamily: fonts.bodyMedium, fontSize: 14, color: palette.creamMute },
  erreur: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.creamMute,
    marginBottom: spacing.lg,
  },
  retour: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: palette.creamMute,
    marginTop: spacing.lg,
  },
});
