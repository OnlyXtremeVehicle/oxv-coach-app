/**
 * Notifications — zone Compte (maquette refonte-v2 §7bis #9d,
 * `screens/41-notifications.png`). Reskin fidèle au langage refonte-v2.
 *
 * La maquette montre 4 toggles. On ne garde QUE ceux qui pilotent un canal
 * réellement programmé par l'app (doctrine « données réelles » : aucun contrôle
 * sans effet). Le backend réel des préférences notif vit dans `users` :
 *   - `push_notif_enabled` (bool) — MAÎTRE opt-in, gate de tout (isChannelEnabled).
 *   - `notification_preferences` (JSONB) — 2 canaux fins que l'app schedule :
 *       · `debrief`  → maquette « Ton bilan est prêt · chaque séance »
 *       · `reminder` → maquette « Rituel d'avant-séance · la veille »
 *   - `notif_offers` (bool) — consentement marketing partenaires (colonne réelle,
 *       défaut false) → maquette « Offres partenaires ».
 *
 * Décisions honnêtes (notées dans sharedChangesNeeded) :
 *   - Maquette « Message de ton coach » : AUCUN canal push coach n'est câblé
 *     (pushNotificationsService ne programme que debrief + reminder ; nul envoi
 *     coach). Un toggle sans persistance = interdit → ligne MASQUÉE.
 *   - État réel du push token (`expo_push_token` présent/absent) exposé en
 *     lecture seule — indicateur factuel, pas un contrôle mort.
 *
 * Doctrine : vouvoiement (les PNG tutoient), ton sec, descriptif jamais
 * prescriptif. « On vous parle peu, et seulement quand ça compte. »
 * Persistance : mêmes services/colonnes que Réglages (#24) — logique inchangée.
 */

import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { type NotifChannel, readNotifPref, writeNotifPref } from '@/services/notifPreferencesLogic';
import { cancelAllOxvNotifications } from '@/services/pushNotificationsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

/** Ligne lue depuis `users` — uniquement les colonnes réellement gérées ici. */
type NotifRow = {
  push_notif_enabled?: boolean | null;
  notification_preferences?: unknown;
  notif_offers?: boolean | null;
  expo_push_token?: string | null;
};

export default function NotificationsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const userId = profile?.id;

  const [loaded, setLoaded] = useState(false);
  // Maître opt-in (users.push_notif_enabled) — défaut-ON (colonne NOT NULL).
  const [pushEnabled, setPushEnabled] = useState(true);
  // Canaux fins (users.notification_preferences JSONB) — préserve les clés tierces.
  const [notifPrefs, setNotifPrefs] = useState<Record<string, unknown>>({});
  // Consentement marketing partenaires (users.notif_offers) — défaut-OFF.
  const [offersEnabled, setOffersEnabled] = useState(false);
  // État réel du canal push distant : token Expo enregistré ou non (lecture seule).
  const [pushTokenPresent, setPushTokenPresent] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('push_notif_enabled, notification_preferences, notif_offers, expo_push_token')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      const row = data as NotifRow | null;
      setPushEnabled(row?.push_notif_enabled !== false);
      setNotifPrefs(
        row?.notification_preferences && typeof row.notification_preferences === 'object'
          ? (row.notification_preferences as Record<string, unknown>)
          : {}
      );
      setOffersEnabled(row?.notif_offers === true);
      setPushTokenPresent(
        typeof row?.expo_push_token === 'string' && row.expo_push_token.length > 0
      );
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Maître opt-in : coupe tout scheduling futur et annule le déjà planifié.
  async function togglePush(next: boolean) {
    if (!userId) return;
    setPushEnabled(next);
    await supabase
      .from('users')
      .update({ push_notif_enabled: next } as never)
      .eq('id', userId);
    if (!next) await cancelAllOxvNotifications();
  }

  // Canal fin (D5) : écrit dans le JSONB en préservant les autres clés. Agit sur
  // les FUTURES programmations (les schedulers relisent la préférence à l'analyse).
  async function toggleChannel(channel: NotifChannel, next: boolean) {
    if (!userId) return;
    const updated = writeNotifPref(notifPrefs, channel, next);
    setNotifPrefs(updated);
    await supabase
      .from('users')
      .update({ notification_preferences: updated } as never)
      .eq('id', userId);
  }

  // Consentement marketing (colonne réelle notif_offers). Défaut-OFF (RGPD opt-in).
  async function toggleOffers(next: boolean) {
    if (!userId) return;
    setOffersEnabled(next);
    await supabase
      .from('users')
      .update({ notif_offers: next } as never)
      .eq('id', userId);
  }

  return (
    <Screen>
      <AppBar title="Notifications" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        {/* Phrase de sobriété (maquette, transposée au vouvoiement). */}
        <Text style={s.intro} accessibilityRole="text">
          On vous parle peu, et seulement quand ça compte.
        </Text>

        {/* Le miroir se tait quand vous roulez (Principe 3) — rappel factuel. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Ce que vous recevez</SectionLabel>
        </View>
        <Card style={s.panel}>
          {/* Maître : coupe toutes les notifications OXV. */}
          <ToggleRow
            label="Notifications OXV"
            caption="Bilan prêt et veille de séance. Rien pendant que vous roulez."
            value={pushEnabled}
            onValueChange={togglePush}
            disabled={!loaded}
          />

          {/* Canaux fins — visibles seulement si le maître est actif (sinon ils
              n'auraient aucun effet). Deux canaux réellement programmés. */}
          {pushEnabled ? (
            <>
              <ToggleRow
                indented
                label="Votre bilan est prêt"
                caption="Une notification le lendemain, quand votre lecture de séance est prête."
                value={readNotifPref(notifPrefs, 'debrief')}
                onValueChange={(v) => toggleChannel('debrief', v)}
                disabled={!loaded}
              />
              <ToggleRow
                indented
                last
                label="La veille d'une séance"
                caption="Un rappel calme la veille d'un roulage à venir."
                value={readNotifPref(notifPrefs, 'reminder')}
                onValueChange={(v) => toggleChannel('reminder', v)}
                disabled={!loaded}
              />
            </>
          ) : null}
        </Card>

        {/* Marketing — consentement partenaires (colonne réelle notif_offers). */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Partenaires</SectionLabel>
        </View>
        <Card style={s.panel}>
          <ToggleRow
            last
            label="Offres partenaires"
            caption="Propositions de nos partenaires. Coupé par défaut, rien sans votre accord."
            value={offersEnabled}
            onValueChange={toggleOffers}
            disabled={!loaded}
          />
        </Card>

        {/* État réel du canal push distant — lecture seule, pas un contrôle.
            La maquette n'a pas de ligne équivalente ; on expose l'état réel du
            token plutôt qu'un toggle mort. */}
        <View style={s.stateRow}>
          <View
            style={[
              s.stateDot,
              { backgroundColor: pushTokenPresent ? theme.palette.green : theme.palette.faint },
            ]}
          />
          <Text style={s.stateText}>
            {pushTokenPresent
              ? 'Cet appareil est prêt à recevoir vos notifications.'
              : 'Cet appareil ne reçoit pas encore de notification. Autorisez-les dans les réglages du téléphone.'}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

/* ─────────────────────────── ligne à bascule ─────────────────────────── */

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
      style={[
        s.row,
        { paddingLeft: indented ? theme.spacing.xl : theme.spacing.lg },
        !last && s.rowBorder,
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <Text style={s.rowLabel}>{label}</Text>
        {caption ? <Text style={s.caption}>{caption}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={caption}
        accessibilityState={{ checked: value, disabled }}
        trackColor={{ false: '#26262B', true: theme.palette.green }}
        thumbColor={theme.palette.cream}
      />
    </View>
  );
}

/* ──────────────────────────────── styles ─────────────────────────────── */

const s = {
  intro: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    lineHeight: theme.fontSize.bodyLg * 1.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  // Panneau maquette : surface #111113 (Card), rows au ras (padding 0).
  panel: {
    marginTop: theme.spacing.sm,
    padding: 0,
    overflow: 'hidden' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 52,
    paddingRight: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.separator,
  },
  rowLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.45,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  stateRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  stateText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.55,
    color: theme.palette.creamMute,
  },
};
