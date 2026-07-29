/**
 * Pilote Pro — Partage contrôlé (vitrine publique opt-in, PR-75).
 *
 * Tout est privé par défaut. Le pilote crée un lien public token-based et choisit,
 * métrique par métrique (liste blanche `SHAREABLE_METRICS`), ce qui est exposé.
 * Jamais de télémétrie brute (GPS/G/temps secteur), jamais de classement « mieux
 * que », jamais les données d'un autre pilote. Le lien est révocable d'un geste.
 * Réutilise `sharesService` (mécanisme déjà en place). Doctrine : sobre,
 * vouvoiement, pas d'emoji, or = donnée.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  type ShareLink,
  type ShareScope,
  SHAREABLE_METRICS,
  createShare,
  listMyShares,
  revokeShare,
  shareUrlFor,
} from '@/services/sharesService';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const SCOPES: { v: ShareScope; label: string }[] = [
  { v: 'last_session', label: 'Dernière séance' },
  { v: 'last_5_sessions', label: '5 dernières' },
  { v: 'full_history', label: 'Tout l’historique' },
  { v: 'progression_only', label: 'Progression seule' },
];

const METRIC_LABEL = new Map(SHAREABLE_METRICS.map((m) => [m.key, m.label]));

/** Expiration des liens de l'espace pro — pas de sélecteur ici, une valeur. */
const PRO_SHARE_EXPIRY_DAYS = 30;

function statusOf(link: ShareLink): { label: string; active: boolean } {
  if (link.revokedAt) return { label: 'Révoqué', active: false };
  if (link.expiresAt && new Date(link.expiresAt).getTime() < new Date().getTime()) {
    return { label: 'Expiré', active: false };
  }
  return { label: 'Actif', active: true };
}

export default function ProPartageScreen() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ShareScope>('last_5_sessions');
  const [metrics, setMetrics] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
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

  useFocusEffect(reload);

  function toggleMetric(key: string) {
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onCreate() {
    if (creating) return;
    setCreating(true);
    // `expiresInDays` est OBLIGATOIRE : `sharesService.ts` ne pose `expires_at`
    // que s'il le reçoit, et l'omettre créait ici des liens qui n'expiraient
    // jamais. Trente jours — l'espace pro n'offre pas de sélecteur, et la
    // décision fondateur du 29/07/2026 borne tout partage dans le temps.
    const link = await createShare({
      scope,
      expiresInDays: PRO_SHARE_EXPIRY_DAYS,
      includedMetrics: [...metrics],
    });
    setCreating(false);
    if (!link) {
      Toast.show({ type: 'error', text1: 'La création du lien a échoué.' });
      return;
    }
    haptics.success();
    setMetrics(new Set());
    reload();
    void Share.share({ message: shareUrlFor(link.token) });
  }

  async function onShareLink(link: ShareLink) {
    await Share.share({ message: shareUrlFor(link.token) });
  }

  async function onRevoke(link: ShareLink) {
    const ok = await revokeShare(link.id);
    if (ok) {
      haptics.tap();
      reload();
    } else {
      Toast.show({ type: 'error', text1: 'La révocation a échoué.' });
    }
  }

  return (
    <Screen>
      <AppBar title="PARTAGE" trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VITRINE CONTRÔLÉE</Text>
        <Text style={s.title} accessibilityRole="header">
          Vous choisissez ce qui se voit.
        </Text>
        <Text style={s.intro}>
          Tout est privé par défaut. Vous exposez métrique par métrique, et vous coupez le lien
          quand vous voulez. Jamais de données brutes, jamais un classement.
        </Text>

        {/* Créer un lien. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Nouveau lien</SectionLabel>

          <Text style={s.fieldLabel}>Portée</Text>
          <View style={s.pills}>
            {SCOPES.map((o) => {
              const on = scope === o.v;
              return (
                <Pressable
                  key={o.v}
                  onPress={() => setScope(o.v)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={o.label}
                  hitSlop={6}
                  style={[s.pill, on ? s.pillOn : null]}
                >
                  <Text style={[s.pillT, on ? s.pillTOn : null]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.fieldLabel}>Ce qui est visible</Text>
          <View style={{ gap: theme.spacing.xs }}>
            {SHAREABLE_METRICS.map((m) => {
              const on = metrics.has(m.key);
              return (
                <Pressable
                  key={m.key}
                  onPress={() => toggleMetric(m.key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={m.label}
                  hitSlop={6}
                  style={({ pressed }) => [s.metricRow, pressed && { opacity: 0.8 }]}
                >
                  <View style={[s.box, on ? s.boxOn : null]}>
                    {on ? <Text style={s.tick}>✓</Text> : null}
                  </View>
                  <Text style={s.metricLabel}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer le lien de partage"
            accessibilityState={{ disabled: creating }}
            disabled={creating}
            onPress={onCreate}
            style={({ pressed }) => [s.primaryBtn, { opacity: pressed || creating ? 0.9 : 1 }]}
          >
            {creating ? (
              <ActivityIndicator color="#050505" accessibilityLabel="Création" />
            ) : (
              <Text style={s.primaryBtnText}>Créer le lien</Text>
            )}
          </Pressable>
        </View>

        {/* Liens existants. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Vos liens</SectionLabel>
          {loading ? (
            <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
            </View>
          ) : shares.length === 0 ? (
            <Text style={s.empty}>Aucun lien pour l’instant.</Text>
          ) : (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {shares.map((link) => {
                const st = statusOf(link);
                const scopeLabel = SCOPES.find((x) => x.v === link.scope)?.label ?? link.scope;
                return (
                  <Card key={link.id}>
                    <View style={s.rowBetween}>
                      <Text style={s.shareScope}>{scopeLabel}</Text>
                      <Text style={[s.shareStatus, st.active ? s.shareStatusOn : null]}>
                        {st.label.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={s.shareMetrics}>
                      {link.includedMetrics.length > 0
                        ? link.includedMetrics.map((k) => METRIC_LABEL.get(k) ?? k).join(' · ')
                        : 'Aucune métrique exposée'}
                    </Text>
                    <Text style={s.shareMeta}>
                      {link.viewCount} vue{link.viewCount > 1 ? 's' : ''}
                    </Text>
                    {st.active ? (
                      <View style={s.actions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Partager le lien"
                          hitSlop={6}
                          onPress={() => onShareLink(link)}
                          style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.8 }]}
                        >
                          <Text style={s.actionT}>Partager</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Révoquer le lien"
                          hitSlop={6}
                          onPress={() => onRevoke(link)}
                          style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.8 }]}
                        >
                          <Text style={[s.actionT, { color: theme.palette.red }]}>Révoquer</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  pillT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  metricRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    minHeight: 44,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.palette.card2,
  },
  boxOn: { borderColor: theme.palette.edge, backgroundColor: theme.palette.card },
  tick: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.palette.cream,
  },
  metricLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    height: 54,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.xl,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: '#050505',
  },
  empty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  shareScope: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  shareStatus: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: theme.palette.faint,
  },
  shareStatusOn: { color: theme.palette.cream },
  shareMetrics: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.5,
  },
  shareMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionBtn: {
    minHeight: 40,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  actionT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
};
