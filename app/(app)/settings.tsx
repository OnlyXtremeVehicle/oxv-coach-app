/**
 * Écran #24 — Settings. Design V2 (charte oxv-mirror-app).
 *
 * Pacte affiché en signature en haut (les 2 phrases manifestes), suivi
 * des sections : Compte, Préférences, Données, Légal, À propos.
 *
 * V1 : les sections sont essentiellement des liens vers des sous-écrans
 * à venir (V1.1). En V1, le bouton Déconnexion fonctionne, le reste
 * affiche une caption "Bientôt".
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button, logique inchangée.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
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
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const status = useAuthStore((s) => s.status);

  const appVersion = (Constants.expoConfig?.version ?? '0.0.0') as string;

  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  // Débrief assisté par IA (OpenAI, US) : actif sauf opt-out (S5). Défaut-ON.
  const [aiDebriefEnabled, setAiDebriefEnabled] = useState<boolean>(true);
  // Assistant IA du coach (C-1) : opt-in explicite, défaut OFF (fail-closed).
  const [coachAiEnabled, setCoachAiEnabled] = useState<boolean>(false);
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
        .select(
          'push_notif_enabled, ai_debrief_enabled, coach_ai_enabled, notification_preferences'
        )
        .eq('id', profile.id)
        .maybeSingle();
      if (cancelled) return;
      const row = data as {
        push_notif_enabled?: boolean | null;
        ai_debrief_enabled?: boolean | null;
        coach_ai_enabled?: boolean | null;
        notification_preferences?: unknown;
      } | null;
      setPushEnabled(row?.push_notif_enabled !== false);
      setAiDebriefEnabled(row?.ai_debrief_enabled !== false);
      setCoachAiEnabled(row?.coach_ai_enabled === true);
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

  // Assistant IA du coach (C-1) : opt-in explicite. Autorise SON coach à
  // déclencher une pré-rédaction IA (transfert hors-UE) sur ses données. Le
  // gate réel est côté serveur (coach_ai_consent) ; ici on enregistre le choix.
  async function toggleCoachAi(next: boolean) {
    if (!profile?.id) return;
    setCoachAiEnabled(next);
    await supabase
      .from('users')
      .update({ coach_ai_enabled: next } as never)
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
    <Screen>
      <AppBar title="RÉGLAGES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {/* Signature Pacte en haut */}
        <Card style={[s.dataPanel, { marginBottom: theme.spacing.xxl }]}>
          <View style={s.headRow} accessibilityRole="header">
            <View style={s.headDot} />
            <SectionLabel>Pacte de pilotage</SectionLabel>
          </View>
          <Text style={[s.manifest, { marginTop: theme.spacing.md }]}>
            L&apos;app est un miroir. Elle vous montre. Elle ne vous dirige pas.
          </Text>
          <Text style={s.manifest}>La piste est à vous. Les décisions aussi.</Text>
          {profile?.pact_accepted_at ? (
            <Text style={[s.signedLine, { marginTop: theme.spacing.md }]}>
              Signé le{' '}
              {new Date(profile.pact_accepted_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          ) : null}
        </Card>

        {/* Compte */}
        <Section label="Compte">
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
            hint="Gérer"
            onPress={() => router.push('/(app)/partage')}
          />
          <SettingRow
            label="Pass OXV"
            hint="Ouvrir"
            onPress={() => router.push('/(app)/pass-oxv' as never)}
          />
          <SettingRow
            label="Garage"
            hint="Ouvrir"
            onPress={() => router.push('/(app)/garage' as never)}
          />
          <SettingRow
            label="Aide & support"
            hint="Ouvrir"
            onPress={() => router.push('/(app)/support' as never)}
            last
          />
        </Section>

        {/* Préférences */}
        <Section label="Préférences">
          <ToggleRow
            label="Notifications OXV"
            caption="Debrief J+1 · Veille de session"
            value={pushEnabled}
            onValueChange={togglePush}
          />

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
            <ToggleRow
              label="Mode détaillé"
              caption="Affiche les métriques techniques (G, deltas, temps total) sur les écrans d'analyse"
              value={detailLevel === 'detailed'}
              onValueChange={toggleDetail}
              last
            />
          ) : null}
        </Section>

        {/* Légal */}
        <Section label="Légal">
          <SettingRow
            label="Pacte de pilotage"
            hint="Consulter"
            onPress={() => router.push('/(app)/legal/pacte' as never)}
          />
          <SettingRow
            label="Conditions générales"
            hint="Consulter"
            onPress={() => router.push('/(app)/legal/cgu' as never)}
          />
          <SettingRow
            label="Politique de confidentialité"
            hint="Consulter"
            onPress={() => router.push('/(app)/legal/confidentialite' as never)}
            last
          />
        </Section>

        {/* Données */}
        <Section label="Données">
          <ToggleRow
            label="Mesure d'audience"
            caption="Statistiques anonymes d'usage. Aucune donnée personnelle, aucun cookie."
            value={analyticsEnabled}
            onValueChange={toggleAnalytics}
          />
          <ToggleRow
            label="Débrief assisté par IA"
            caption="Le récit du debrief J+1 est rédigé par une IA (OpenAI, hors UE) à partir de données non nominatives. Désactivé : le debrief est rédigé localement."
            value={aiDebriefEnabled}
            onValueChange={toggleAiDebrief}
          />
          <ToggleRow
            label="Assistant IA de mon coach"
            caption="Autorise votre coach à pré-rédiger ses observations avec une IA (OpenAI, hors UE) à partir de vos données non nominatives. Chaque observation est relue et validée par votre coach. Désactivé par défaut."
            value={coachAiEnabled}
            onValueChange={toggleCoachAi}
          />
          <SettingRow
            label="Exporter mes données"
            hint={exporting ? 'Préparation' : 'Exporter'}
            busy={exporting}
            onPress={onExportData}
          />
          <SettingRow
            label="Supprimer mon compte"
            hint={deleting ? 'En cours' : 'Supprimer'}
            busy={deleting}
            onPress={onDeleteAccount}
            danger
            last
          />
        </Section>

        {/* À propos */}
        <Section label="À propos">
          <SettingRow label="Version" value={appVersion} />
          <SettingRow label="Contact" value="contact@oxvehicle.fr" last />
        </Section>

        <View style={{ marginTop: theme.spacing.lg }}>
          <Button
            label="Se déconnecter"
            variant="ghost"
            onPress={signOut}
            disabled={status === 'loading'}
          />
        </View>
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: theme.spacing.xxl }}>
      <View style={[s.headRow, { marginBottom: theme.spacing.sm }]} accessibilityRole="header">
        <View style={s.headDot} />
        <SectionLabel>{label}</SectionLabel>
      </View>
      <Card style={[s.dataPanel, { padding: 0, overflow: 'hidden' }]}>{children}</Card>
    </View>
  );
}

function SettingRow({
  label,
  value,
  hint,
  onPress,
  danger = false,
  busy = false,
  last = false,
}: {
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  danger?: boolean;
  busy?: boolean;
  last?: boolean;
}) {
  const Container: React.ElementType = onPress ? Pressable : View;
  const inert = busy || !onPress;
  return (
    <Container
      onPress={inert ? undefined : onPress}
      disabled={onPress ? busy : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { busy, disabled: busy } : undefined}
      accessibilityLabel={onPress ? label : undefined}
      style={({ pressed }: { pressed?: boolean }) => ({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 48,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.palette.line,
        opacity: pressed && !inert ? 0.85 : 1,
      })}
    >
      <Text style={[s.rowLabel, danger && { color: theme.palette.red }]}>{label}</Text>
      {value ? (
        <Text style={s.rowValue}>{value}</Text>
      ) : hint ? (
        <View style={s.hintRow}>
          <Text style={[s.rowHint, danger && { color: theme.palette.red }]}>{hint}</Text>
          {onPress && !busy ? (
            <Text style={[s.chevron, danger && { color: theme.palette.red }]}>›</Text>
          ) : null}
        </View>
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
  last = false,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  indented?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 48,
        paddingVertical: theme.spacing.md,
        paddingRight: theme.spacing.md,
        paddingLeft: indented ? theme.spacing.xl : theme.spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.palette.line,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <Text style={s.rowLabel}>{label}</Text>
        {caption ? (
          <Text style={[s.caption, { marginTop: theme.spacing.xs }]}>{caption}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={caption}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ false: '#26262B', true: theme.palette.gold }}
        thumbColor={theme.palette.cream}
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

const s = {
  dataPanel: {
    backgroundColor: theme.palette.card2,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.body,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.body * 1.6,
    color: theme.palette.cream,
  },
  // Ligne « Signé le … » : porte une date → mono autorisé (voix de l'instrument).
  signedLine: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  // Légende sous un réglage : texte courant (libellé), pas du mono. Contraste AA.
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.45,
    color: theme.palette.creamMute,
  },
  rowLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  rowValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  // Renvoi de navigation (« Gérer », « Consulter ») : libellé → texte courant.
  rowHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  hintRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  chevron: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    lineHeight: 18,
    color: theme.palette.faint,
  },
};
