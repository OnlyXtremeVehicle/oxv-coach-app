/**
 * Écran Partage — création et gestion des liens de partage publics.
 *
 * Pas dans la numérotation officielle des 26 écrans pilote — c'est un
 * sous-écran de Settings (visible aussi depuis le Bilan en V1.1).
 *
 * Flow :
 *   1. Choisir un scope (4 options)
 *   2. Choisir une durée (3 options)
 *   3. Tap "Créer le lien" → génère token + ouvre la sheet partage native
 *   4. Liste des liens actifs en dessous, avec bouton "Révoquer"
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  SHAREABLE_METRICS,
  type ShareLink,
  type ShareScope,
  createShare,
  listMyShares,
  revokeShare,
  sanitizeIncludedMetrics,
  shareUrlFor,
} from '@/services/sharesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { timeAgoFr } from '@/utils/time';

interface ScopeOption {
  id: ShareScope;
  label: string;
  description: string;
}

const SCOPES: ScopeOption[] = [
  { id: 'last_session', label: 'Dernière session', description: 'Le bilan le plus récent.' },
  { id: 'last_5_sessions', label: '5 dernières sessions', description: 'Une vue resserrée.' },
  { id: 'progression_only', label: 'Progression seule', description: 'La courbe long terme.' },
  { id: 'full_history', label: 'Historique complet', description: 'Tout votre parcours.' },
];

const DURATIONS: { days: number | null; label: string }[] = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: null, label: 'Sans limite' },
];

export default function PartageScreen() {
  const [scope, setScope] = useState<ShareScope>('last_session');
  const [duration, setDuration] = useState<number | null>(7);
  // Défaut = ensemble VIDE : le pilote construit son partage activement (RGPD §2.2).
  const [metrics, setMetrics] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleMetric = (key: string) =>
    setMetrics((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMyShares().then((rows) => {
      if (!cancelled) {
        setShares(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = async () => {
    if (submitting || metrics.length === 0) return;
    setSubmitting(true);
    const link = await createShare({
      scope,
      expiresInDays: duration ?? undefined,
      includedMetrics: sanitizeIncludedMetrics(metrics),
    });
    setSubmitting(false);
    if (!link) {
      Alert.alert('Création impossible', 'Réessayez quand votre connexion sera de retour.');
      return;
    }
    setShares((prev) => [link, ...prev]);
    try {
      await Share.share({
        message: shareUrlFor(link.token),
        url: shareUrlFor(link.token),
        title: 'OXV Mirror — Partage',
      });
    } catch {
      // L'utilisateur a fermé la sheet, pas d'erreur à remonter.
    }
  };

  const onRevoke = async (link: ShareLink) => {
    Alert.alert('Révoquer ce lien ?', 'Il deviendra inaccessible immédiatement.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Révoquer',
        style: 'destructive',
        onPress: async () => {
          const ok = await revokeShare(link.id);
          if (!ok) {
            Alert.alert('Révocation impossible', 'Réessayez plus tard.');
            return;
          }
          setShares((prev) =>
            prev.map((s) => (s.id === link.id ? { ...s, revokedAt: new Date().toISOString() } : s))
          );
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>PARTAGER</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          Une vue, à vos conditions.
        </Text>

        <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>SCOPE</Text>
        <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
          {SCOPES.map((opt) => {
            const active = scope === opt.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={opt.id}
                onPress={() => setScope(opt.id)}
                style={({ pressed }) => ({
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: active ? 1 : 0.5,
                  borderColor: active ? colors.accent.red : colors.border.subtle,
                  backgroundColor: active ? 'rgba(200, 16, 46, 0.08)' : colors.background.secondary,
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
                  {opt.label}
                </Text>
                <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                  {opt.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>DURÉE</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxxl }}>
          {DURATIONS.map((d) => {
            const active = duration === d.days;
            return (
              <Pressable
                accessibilityRole="button"
                key={d.label}
                onPress={() => setDuration(d.days)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: active ? colors.accent.red : colors.border.subtle,
                  backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : 'transparent',
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? colors.text.primary : colors.text.secondary,
                    fontSize: fontSize.caption,
                    fontWeight: active ? fontWeight.medium : fontWeight.regular,
                  }}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[typography.eyebrow, { marginBottom: spacing.xs }]}>MÉTRIQUES PARTAGÉES</Text>
        <Text
          style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.md }]}
        >
          Vous ne partagez que ce que vous cochez. Rien n'est exposé par défaut.
        </Text>
        <View style={{ gap: spacing.sm, marginBottom: spacing.xxxl }}>
          {SHAREABLE_METRICS.map((m) => {
            const on = metrics.includes(m.key);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.label}
                key={m.key}
                onPress={() => toggleMetric(m.key)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: on ? 1 : 0.5,
                  borderColor: on ? colors.accent.red : colors.border.subtle,
                  backgroundColor: on ? 'rgba(200, 16, 46, 0.08)' : colors.background.secondary,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 1.5,
                    borderColor: on ? colors.accent.red : colors.border.medium,
                    backgroundColor: on ? colors.accent.red : 'transparent',
                  }}
                />
                <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting || metrics.length === 0 }}
          onPress={onCreate}
          disabled={submitting || metrics.length === 0}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent.red,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: spacing.sm,
            marginBottom: spacing.xxl,
            opacity: metrics.length === 0 ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          {submitting ? <ActivityIndicator color={colors.text.primary} /> : null}
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
              letterSpacing: 0.5,
            }}
          >
            {submitting ? 'Génération…' : 'Créer le lien'}
          </Text>
        </Pressable>

        <Text
          style={[typography.eyebrow, { marginBottom: spacing.md, color: colors.text.tertiary }]}
        >
          VOS LIENS ACTIFS
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.text.secondary} />
        ) : shares.length === 0 ? (
          <Text style={[typography.caption, { color: colors.text.tertiary }]}>
            Aucun lien partagé pour l'instant.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {shares.map((link) => (
              <ShareCard key={link.id} link={link} onRevoke={() => onRevoke(link)} />
            ))}
          </View>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShareCard({ link, onRevoke }: { link: ShareLink; onRevoke: () => void }) {
  const revoked = Boolean(link.revokedAt);
  const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;
  const status = revoked ? 'révoqué' : expired ? 'expiré' : 'actif';

  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        opacity: revoked || expired ? 0.5 : 1,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.xs,
        }}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.regular,
          }}
        >
          {scopeLabel(link.scope)}
        </Text>
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>{status}</Text>
      </View>
      <Text
        style={{
          color: colors.text.tertiary,
          fontSize: fontSize.caption,
          fontFamily: 'Menlo',
          marginBottom: spacing.sm,
        }}
        numberOfLines={1}
      >
        {shareUrlFor(link.token)}
      </Text>
      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
        Créé {timeAgoFr(new Date(link.createdAt))} · {link.viewCount} vue
        {link.viewCount > 1 ? 's' : ''} · {link.includedMetrics.length} métrique
        {link.includedMetrics.length > 1 ? 's' : ''}
      </Text>
      {!revoked && !expired ? (
        <Pressable accessibilityRole="button" onPress={onRevoke} style={{ marginTop: spacing.sm }}>
          <Text style={{ color: colors.system.error, fontSize: fontSize.caption }}>Révoquer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function scopeLabel(scope: ShareScope): string {
  switch (scope) {
    case 'last_session':
      return 'Dernière session';
    case 'last_5_sessions':
      return '5 dernières sessions';
    case 'progression_only':
      return 'Progression seule';
    case 'full_history':
      return 'Historique complet';
  }
}
