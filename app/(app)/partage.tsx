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
 *
 * Reskin V2 : Screen + AppBar, Segmented (durée), Card/SectionLabel/Button,
 * typo/couleurs @/theme/v2. Logique de partage RGPD (scope, métriques cochées,
 * création, révocation) inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from 'react-native';
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
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { Segmented } from '@/ui/Segmented';
import { StatusLine, cockpitHalo } from '@/ui/Cockpit';
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
    <Screen>
      <AppBar title="PARTAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <StatusLine label="Partage · à vos conditions" />
        <Text style={s.title}>Une vue, à vos conditions.</Text>

        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <SectionLabel>SCOPE</SectionLabel>
          {SCOPES.map((opt) => {
            const active = scope === opt.id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: active, checked: active }}
                accessibilityLabel={`${opt.label}. ${opt.description}`}
                key={opt.id}
                onPress={() => setScope(opt.id)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Card
                  style={{
                    borderColor: active ? theme.palette.edge : theme.palette.line,
                    backgroundColor: active ? 'rgba(255,255,255,0.07)' : theme.palette.card,
                  }}
                >
                  <Text style={s.scopeLabel}>{opt.label}</Text>
                  <Text style={s.scopeDesc}>{opt.description}</Text>
                </Card>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
          <SectionLabel>DURÉE</SectionLabel>
          <Segmented
            options={DURATIONS.map((d) => d.label)}
            value={DURATIONS.find((d) => d.days === duration)?.label ?? DURATIONS[0].label}
            onChange={(label) => {
              const found = DURATIONS.find((d) => d.label === label);
              if (found) setDuration(found.days);
            }}
          />
        </View>

        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <SectionLabel>MÉTRIQUES PARTAGÉES</SectionLabel>
          <Text style={s.metricsHint}>
            Vous ne partagez que ce que vous cochez. Rien n&apos;est exposé par défaut.
          </Text>
          {SHAREABLE_METRICS.map((m) => {
            const on = metrics.includes(m.key);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={m.label}
                key={m.key}
                onPress={() => toggleMetric(m.key)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <Card
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    borderColor: on ? theme.palette.edge : theme.palette.line,
                    backgroundColor: on ? 'rgba(255,255,255,0.07)' : theme.palette.card,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: theme.radius.sm,
                      borderWidth: 1.5,
                      borderColor: on ? theme.palette.cream : theme.palette.edge,
                      backgroundColor: on ? theme.palette.cream : 'transparent',
                    }}
                  />
                  <Text style={s.metricLabel}>{m.label}</Text>
                </Card>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginBottom: theme.spacing.xxl }}>
          <Button
            label={submitting ? 'Génération…' : 'Créer le lien'}
            onPress={onCreate}
            loading={submitting}
            disabled={metrics.length === 0}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel>VOS LIENS ACTIFS</SectionLabel>
          {loading ? (
            <ActivityIndicator
              color={theme.palette.creamMute}
              accessibilityLabel="Chargement de vos liens"
            />
          ) : shares.length === 0 ? (
            <Text style={s.emptyLinks}>Aucun lien partagé pour l&apos;instant.</Text>
          ) : (
            shares.map((link) => (
              <ShareCard key={link.id} link={link} onRevoke={() => onRevoke(link)} />
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

function ShareCard({ link, onRevoke }: { link: ShareLink; onRevoke: () => void }) {
  const revoked = Boolean(link.revokedAt);
  const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;
  const status = revoked ? 'révoqué' : expired ? 'expiré' : 'actif';

  return (
    <Card style={{ opacity: revoked || expired ? 0.5 : 1, ...cockpitHalo }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.xs,
        }}
      >
        <Text style={s.shareScope}>{scopeLabel(link.scope)}</Text>
        <Text style={s.shareStatus}>{status}</Text>
      </View>
      <Text style={s.shareUrl} numberOfLines={1}>
        {shareUrlFor(link.token)}
      </Text>
      <Text style={s.shareMeta}>
        Créé {timeAgoFr(new Date(link.createdAt))} ·{' '}
        <Text style={s.shareMetaNum}>{link.viewCount}</Text> vue{link.viewCount > 1 ? 's' : ''} ·{' '}
        <Text style={s.shareMetaNum}>{link.includedMetrics.length}</Text> métrique
        {link.includedMetrics.length > 1 ? 's' : ''}
      </Text>
      {!revoked && !expired ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Révoquer ce lien"
          hitSlop={theme.hitSlop}
          onPress={onRevoke}
          style={({ pressed }) => [s.revokeHit, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.revoke}>Révoquer</Text>
        </Pressable>
      ) : null}
    </Card>
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

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xxl,
  },
  scopeLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  scopeDesc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  metricsHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  metricLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  emptyLinks: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  shareScope: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  shareStatus: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  shareUrl: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.sm,
  },
  shareMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  shareMetaNum: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  revokeHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  revoke: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
  },
};
