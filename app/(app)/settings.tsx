/**
 * Écran #24 — Settings.
 *
 * Pacte affiché en signature en haut (les 2 phrases manifestes), suivi
 * des sections : Compte, Préférences, Données, Légal, À propos.
 *
 * V1 : les sections sont essentiellement des liens vers des sous-écrans
 * à venir (V1.1). En V1, le bouton Déconnexion fonctionne, le reste
 * affiche une caption "Bientôt".
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const status = useAuthStore((s) => s.status);

  const appVersion = (Constants.expoConfig?.version ?? '0.0.0') as string;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>PARAMÈTRES</Text>

        {/* Signature Pacte en haut */}
        <View
          style={{
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            backgroundColor: colors.background.secondary,
            marginTop: spacing.lg,
            marginBottom: spacing.xxxl,
          }}
        >
          <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>PACTE DE PILOTAGE</Text>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.light,
              fontStyle: 'italic',
              lineHeight: fontSize.body * 1.6,
              marginBottom: spacing.sm,
            }}
          >
            L'app est un miroir. Elle vous montre. Elle ne vous dirige pas.
          </Text>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.light,
              fontStyle: 'italic',
              lineHeight: fontSize.body * 1.6,
            }}
          >
            La piste est à vous. Les décisions aussi.
          </Text>
          {profile?.pact_accepted_at ? (
            <Text
              style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.md }]}
            >
              Signé le{' '}
              {new Date(profile.pact_accepted_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          ) : null}
        </View>

        {/* Compte */}
        <Section label="COMPTE">
          <SettingRow label="Email" value={profile?.email ?? '—'} />
          <SettingRow label="Niveau pilote" value={prettyLevel(profile?.pilot_level)} />
          <SettingRow
            label="Partager une vue"
            hint="Bientôt"
            onPress={() => router.push('/(app)/partage')}
          />
        </Section>

        {/* Légal */}
        <Section label="LÉGAL">
          <SettingRow label="Pacte de pilotage" hint="Consulter" />
          <SettingRow label="Conditions générales" hint="Consulter" />
          <SettingRow label="Politique de confidentialité" hint="Consulter" />
        </Section>

        {/* Données */}
        <Section label="DONNÉES">
          <SettingRow label="Exporter mes données" hint="Bientôt" />
          <SettingRow label="Supprimer mon compte" hint="Bientôt" danger />
        </Section>

        {/* À propos */}
        <Section label="À PROPOS">
          <SettingRow label="Version" value={appVersion} />
          <SettingRow label="Contact" value="contact@oxvehicle.fr" />
        </Section>

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          disabled={status === 'loading'}
          style={({ pressed }) => ({
            marginTop: spacing.xxxl,
            height: 52,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            Se déconnecter
          </Text>
        </Pressable>

        <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.md, color: colors.text.tertiary }]}>
        {label}
      </Text>
      <View
        style={{
          borderRadius: borderRadius.lg,
          borderWidth: 0.5,
          borderColor: colors.border.subtle,
          backgroundColor: colors.background.secondary,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function SettingRow({
  label,
  value,
  hint,
  onPress,
  danger = false,
}: {
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const Container: React.ElementType = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => ({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: danger ? colors.system.error : colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.regular,
        }}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.caption,
          }}
        >
          {value}
        </Text>
      ) : hint ? (
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>{hint} ›</Text>
      ) : null}
    </Container>
  );
}

function prettyLevel(level: string | null | undefined): string {
  switch (level) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Apprivoisé';
    case 'confirme':
      return 'Confirmé';
    case 'expert':
      return 'Expert';
    default:
      return '—';
  }
}
