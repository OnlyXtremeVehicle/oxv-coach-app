import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { Logo } from '@/brand/Logo';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
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
            <TextInput
              placeholder="Adresse email"
              placeholderTextColor={theme.palette.creamMute}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              style={s.input}
              editable={!loading}
            />

            <TextInput
              placeholder="Mot de passe"
              placeholderTextColor={theme.palette.creamMute}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              style={[s.input, { marginTop: theme.spacing.sm }]}
              editable={!loading}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <View style={{ marginTop: theme.spacing.lg }}>
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
  input: {
    height: 52,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderColor: theme.palette.line,
    color: theme.palette.cream,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginTop: theme.spacing.md,
  },
};
