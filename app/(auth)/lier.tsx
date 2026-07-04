/**
 * Lier mon compte (Lot M3) — connexion par code d'appairage du site.
 *
 * Le pilote génère un code court sur oxvehicle.fr (compte → application) puis
 * le saisit ici : l'app l'échange contre une session via l'edge `pair-app`
 * (redeem → verifyOtp magiclink). Le listener d'auth du store prend le relais
 * (profil + redirection par rôle) — aucun mot de passe à retaper.
 *
 * Deep link : `oxv://lier?code=XXXXXXXX` préremplit le code (le site peut
 * proposer « Ouvrir dans l'app »). Doctrine : sobre, vouvoiement, erreurs
 * factuelles, jamais de faux succès.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Logo } from '@/brand/Logo';
import {
  isPairingCodeComplete,
  normalizePairingCode,
  pairingErrorMessage,
} from '@/services/pairingLogic';
import { redeemPairingCode } from '@/services/pairingService';
import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';

export default function LierCompteScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Préremplissage deep link (oxv://lier?code=…) — normalisé, jamais soumis seul.
  useEffect(() => {
    if (params.code) setCode(normalizePairingCode(params.code));
  }, [params.code]);

  const canSubmit = isPairingCodeComplete(code) && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const res = await redeemPairingCode(code);
    if (!res.ok) {
      setError(pairingErrorMessage(res.error));
      setSubmitting(false);
      return;
    }
    // Succès : la session est établie — le store d'auth redirige. On laisse
    // l'indicateur actif le temps de la bascule (pas de faux état stable).
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.xl, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: theme.spacing.xxl }}>
            <Logo size={56} />
            <Text style={s.eyebrow}>LIER MON COMPTE</Text>
            <Text style={s.title}>Votre code du site.</Text>
          </View>

          <Card>
            <Text style={s.help}>
              Depuis votre compte sur oxvehicle.fr, générez un code d’appairage puis saisissez-le
              ici. Il est valable dix minutes.
            </Text>

            <Field
              label="Code d’appairage"
              placeholder="8 caractères"
              value={code}
              onChangeText={(v) => setCode(normalizePairingCode(v))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!submitting}
              error={error ?? undefined}
            />

            <View style={{ marginTop: theme.spacing.xs }}>
              <Button
                label={submitting ? 'Liaison…' : 'Lier mon compte'}
                onPress={onSubmit}
                disabled={!canSubmit}
              />
            </View>
          </Card>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Revenir à la connexion par email"
            style={{ alignItems: 'center', marginTop: theme.spacing.xl, minHeight: 44 }}
            disabled={submitting}
          >
            <Text style={s.altLink}>Se connecter avec un email</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  help: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginBottom: theme.spacing.md,
  },
  altLink: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
};
