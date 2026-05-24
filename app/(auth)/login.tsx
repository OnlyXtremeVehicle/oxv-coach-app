import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/useAuthStore';
import { colors, spacing, typography, borderRadius, fontWeight, fontSize } from '@/theme/tokens';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>OXV COACH</Text>
          <Text style={[typography.screenTitle, { marginBottom: spacing.huge }]}>Entrez.</Text>

          <TextInput
            placeholder="Adresse email"
            placeholderTextColor={colors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={inputStyle}
            editable={!loading}
          />

          <TextInput
            placeholder="Mot de passe"
            placeholderTextColor={colors.text.tertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            style={[inputStyle, { marginTop: spacing.md }]}
            editable={!loading}
          />

          {error ? (
            <Text
              style={{
                color: colors.system.error,
                fontSize: fontSize.caption,
                marginTop: spacing.md,
              }}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              marginTop: spacing.xl,
              height: 52,
              borderRadius: borderRadius.lg,
              backgroundColor: canSubmit ? colors.accent.red : colors.background.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
                letterSpacing: 0.5,
              }}
            >
              {loading ? 'Connexion…' : 'Entrer'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = {
  height: 52,
  borderRadius: borderRadius.md,
  paddingHorizontal: spacing.lg,
  backgroundColor: colors.background.secondary,
  borderWidth: 1,
  borderColor: colors.border.subtle,
  color: colors.text.primary,
  fontSize: fontSize.body,
} as const;
