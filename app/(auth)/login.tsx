import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Logo } from '@/brand/Logo';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loading = status === 'loading';
  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const onSubmit = async () => {
    if (!canSubmit) return;
    await signIn(email.trim(), password);
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
            <Text style={s.eyebrow}>OXV MIRROR</Text>
            <Text style={s.title}>Entrez.</Text>
          </View>

          <Card>
            <Field
              label="Adresse email"
              placeholder="vous@exemple.fr"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              editable={!loading}
            />

            <Field
              label="Mot de passe"
              placeholder="Votre mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!loading}
              error={error}
            />

            <View style={{ marginTop: theme.spacing.xs }}>
              <Button
                label={loading ? 'Connexion…' : 'Entrer'}
                onPress={onSubmit}
                disabled={!canSubmit}
              />
            </View>
          </Card>
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
    fontSize: theme.fontSize.display,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
};
