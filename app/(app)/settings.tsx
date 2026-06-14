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

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { useDetailLevel } from '@/hooks/useDetailLevel';
import { supabase } from '@/lib/supabase';
import { requestAccountDeletion } from '@/services/accountService';
import { isAnalyticsOptedOut, setAnalyticsOptOut } from '@/services/analyticsService';
import { exportAndShareMyData } from '@/services/dataExportService';
import { type NotifChannel, readNotifPref, writeNotifPref } from '@/services/notifPreferencesLogic';
import { cancelAllOxvNotifications } from '@/services/pushNotificationsService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const status = useAuthStore((s) => s.status);

  const appVersion = (Constants.expoConfig?.version ?? '0.0.0') as string;

  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  // Débrief assisté par IA (OpenAI, US) : actif sauf opt-out (S5). Défaut-ON.
  const [aiDebriefEnabled, setAiDebriefEnabled] = useState<boolean>(true);
  // Préférences de notification fines (D5), JSONB brut (préserve les clés tierces).
  const [notifPrefs, setNotifPrefs] = useState<Record<string, unknown>>({});
  // Mesure d'audience anonyme : activée sauf opt-out explicite (§9).
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(() => !isAnalyticsOptedOut());
  const [exporting, setExporting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const { level: detailLevel, toggle: toggleDetail, canToggle: canToggleDetail } = useDetailLevel();

  function toggleAnalytics(next: boolean) {
    setAnalyticsEnabled(next);
    setAnalyticsOptOut(!next);
  }

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('push_notif_enabled, ai_debrief_enabled, notification_preferences')
        .eq('id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      const row = data as {
        push_notif_enabled?: boolean | null;
        ai_debrief_enabled?: boolean | null;
        notification_preferences?: unknown;
      } | null;
      setPushEnabled(row?.push_notif_enabled !== false);
      setAiDebriefEnabled(row?.ai_debrief_enabled !== false);
      setNotifPrefs(
        row?.notification_preferences && typeof row.notification_preferences === 'object'
          ? (row.notification_preferences as Record<string, unknown>)
          : {}
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  async function togglePush(next: boolean) {
    if (!profile?.id) return;
    setPushEnabled(next);
    await supabase
      .from('users')
      .update({ push_notif_enabled: next } as never)
      .eq('id', profile.id);
    if (!next) await cancelAllOxvNotifications();
  }

  // Débrief IA (S5) : opt-out. Le gate réel est côté serveur ; ici on enregistre
  // le choix du pilote (rend vraie la promesse « désactivable dans vos paramètres »).
  async function toggleAiDebrief(next: boolean) {
    if (!profile?.id) return;
    setAiDebriefEnabled(next);
    await supabase
      .from('users')
      .update({ ai_debrief_enabled: next } as never)
      .eq('id', profile.id);
  }

  // Granularité notifs (D5) : écrit la préférence par canal dans le JSONB,
  // en préservant les autres clés. La coupure agit sur les FUTURES
  // programmations (les schedulers lisent la préférence à l'analyse de session) ;
  // une notif déjà planifiée n'est pas annulée rétroactivement (impact faible :
  // le debrief est programmé au moment de l'analyse, pas à l'avance).
  async function toggleNotifChannel(channel: NotifChannel, next: boolean) {
    if (!profile?.id) return;
    const updated = writeNotifPref(notifPrefs, channel, next);
    setNotifPrefs(updated);
    await supabase
      .from('users')
      .update({ notification_preferences: updated } as never)
      .eq('id', profile.id);
  }

  // Export de mes données (S2) : assemble le JSON et ouvre la share sheet.
  async function onExportData() {
    if (!profile?.id || exporting) return;
    setExporting(true);
    const res = await exportAndShareMyData(profile.id);
    setExporting(false);
    if (!res.ok) {
      Alert.alert('Export', "L'export n'a pas pu être préparé. Réessayez plus tard.");
    }
  }

  // Suppression de compte (S3) : double confirmation, marquage J+30, déconnexion.
  function onDeleteAccount() {
    if (!profile?.id || deleting) return;
    Alert.alert(
      'Supprimer mon compte',
      'Votre compte et vos données seront supprimés après un délai de grâce de 30 jours. Avant l’échéance, écrivez à contact@oxvehicle.fr pour annuler. Les données exigées par la loi (facturation) sont conservées séparément.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  }

  function confirmDeleteAccount() {
    if (!profile?.id) return;
    Alert.alert(
      'Confirmer la suppression',
      'Cette demande lance la suppression définitive, effective sous 30 jours. Confirmer ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!profile?.id) return;
            setDeleting(true);
            const res = await requestAccountDeletion(profile.id);
            setDeleting(false);
            if (res.ok) {
              await signOut();
            } else {
              Alert.alert('Suppression', "La demande n'a pas pu être enregistrée. Réessayez.");
            }
          },
        },
      ]
    );
  }

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
            label="Mon coach"
            hint="Gérer"
            // Cast nécessaire tant que typed-routes Expo n'a pas regen
            onPress={() => router.push('/(app)/mon-coach' as never)}
          />
          <SettingRow
            label="Mes amis pilotes"
            hint="Comparer"
            onPress={() => router.push('/(app)/amis' as never)}
          />
          <SettingRow
            label="Partager une vue"
            hint="Bientôt"
            onPress={() => router.push('/(app)/partage')}
          />
        </Section>

        {/* Préférences */}
        <Section label="PRÉFÉRENCES">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.regular,
                }}
              >
                Notifications OXV
              </Text>
              <Text
                style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
              >
                Debrief J+1 · Veille de session
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={togglePush}
              trackColor={{ false: colors.border.subtle, true: colors.accent.red }}
              thumbColor={colors.text.primary}
            />
          </View>

          {/* Granularité des notifications (D5) — visible quand le maître est actif.
              Deux canaux que l'app programme réellement, pas de canal fantôme. */}
          {pushEnabled ? (
            <>
              <ToggleRow
                indented
                label="Votre debrief (J+1)"
                caption="La notification quand votre lecture de session est prête."
                value={readNotifPref(notifPrefs, 'debrief')}
                onValueChange={(v) => toggleNotifChannel('debrief', v)}
              />
              <ToggleRow
                indented
                label="Veille de session"
                caption="Un rappel la veille d'un roulage à venir."
                value={readNotifPref(notifPrefs, 'reminder')}
                onValueChange={(v) => toggleNotifChannel('reminder', v)}
              />
            </>
          ) : null}

          {/* Mode détaillé (visible uniquement pour pilote — coach/admin sont fixés) */}
          {canToggleDetail ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderTopWidth: 0.5,
                borderTopColor: colors.border.subtle,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.regular,
                  }}
                >
                  Mode détaillé
                </Text>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.tertiary, marginTop: spacing.xs },
                  ]}
                >
                  Affiche les métriques techniques (G, deltas, temps total) sur les écrans d'analyse
                </Text>
              </View>
              <Switch
                value={detailLevel === 'detailed'}
                onValueChange={toggleDetail}
                trackColor={{ false: colors.border.subtle, true: colors.accent.red }}
                thumbColor={colors.text.primary}
              />
            </View>
          ) : null}
        </Section>

        {/* Légal */}
        <Section label="LÉGAL">
          <SettingRow label="Pacte de pilotage" hint="Consulter" />
          <SettingRow label="Conditions générales" hint="Consulter" />
          <SettingRow label="Politique de confidentialité" hint="Consulter" />
        </Section>

        {/* Données */}
        <Section label="DONNÉES">
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.regular,
                }}
              >
                Mesure d&apos;audience
              </Text>
              <Text
                style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
              >
                Statistiques anonymes d&apos;usage. Aucune donnée personnelle, aucun cookie.
              </Text>
            </View>
            <Switch
              value={analyticsEnabled}
              onValueChange={toggleAnalytics}
              trackColor={{ false: colors.border.subtle, true: colors.accent.red }}
              thumbColor={colors.text.primary}
            />
          </View>
          <ToggleRow
            label="Débrief assisté par IA"
            caption="Le récit du debrief J+1 est rédigé par une IA (OpenAI, hors UE) à partir de données non nominatives. Désactivé : le debrief est rédigé localement."
            value={aiDebriefEnabled}
            onValueChange={toggleAiDebrief}
          />
          <SettingRow
            label="Exporter mes données"
            hint={exporting ? 'Préparation…' : 'Exporter'}
            onPress={onExportData}
          />
          <SettingRow
            label="Supprimer mon compte"
            hint={deleting ? 'En cours…' : 'Supprimer'}
            onPress={onDeleteAccount}
            danger
          />
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
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
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

function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
  indented = false,
  disabled = false,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  indented?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingRight: spacing.lg,
        paddingLeft: indented ? spacing.xxl : spacing.lg,
        borderTopWidth: 0.5,
        borderTopColor: colors.border.subtle,
      }}
    >
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.regular,
          }}
        >
          {label}
        </Text>
        {caption ? (
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
          >
            {caption}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityHint={caption}
        trackColor={{ false: colors.border.subtle, true: colors.accent.red }}
        thumbColor={colors.text.primary}
      />
    </View>
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
