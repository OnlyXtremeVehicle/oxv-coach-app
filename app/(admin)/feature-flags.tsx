/**
 * Admin — Feature flags (PR-85).
 *
 * Active/désactive des fonctionnalités et déclare des versions d'algos. Ecriture
 * admin (RLS is_admin). Back-office, aucune donnée pilote. Bronze = rôle admin.
 * Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  type FeatureFlag,
  deleteFlag,
  listFlags,
  upsertFlag,
} from '@/services/featureFlagsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

export default function FeatureFlagsScreen() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listFlags()
      .then((f) => {
        if (!cancelled) {
          setFlags(f);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(reload, [reload]);

  async function onToggle(flag: FeatureFlag, enabled: boolean) {
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled } : f)));
    const res = await upsertFlag({ key: flag.key, enabled, description: flag.description });
    if (!res.ok) {
      Toast.show({ type: 'error', text1: 'Échec de la mise à jour.' });
      reload();
    }
  }

  async function onCreate() {
    const key = newKey.trim();
    if (!key) {
      Toast.show({ type: 'error', text1: 'La clé est requise.' });
      return;
    }
    setSaving(true);
    const res = await upsertFlag({ key, enabled: false, description: newDesc });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Création impossible.' });
      return;
    }
    haptics.success();
    setNewKey('');
    setNewDesc('');
    reload();
  }

  /**
   * SUPPRIMER UN DRAPEAU N'EST PAS UN GESTE ORDINAIRE.
   *
   * Ces drapeaux commandent des fonctions vivantes de l'espace pilote —
   * biométrie, décharges, convois, paiements, statut fondateur. En effacer un
   * d'un seul toucher éteint une fonction pour tout le monde, sans retour
   * possible depuis cet écran : il faut le recréer à la main, avec la bonne
   * clé, et personne ne se souvient de son état exact.
   *
   * Relevé par la cartographie du 02/08/2026.
   */
  async function onDelete(flag: FeatureFlag) {
    Alert.alert(
      'Supprimer ce drapeau',
      `« ${flag.key} » sera retiré. La fonction qu'il commande prendra sa valeur par défaut ` +
        'pour tous les comptes, immédiatement. Ce retrait ne se défait pas depuis cet écran.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteFlag(flag.key);
            if (res.ok) {
              haptics.tap();
              reload();
            } else {
              Toast.show({ type: 'error', text1: 'La suppression a échoué.' });
            }
          },
        },
      ]
    );
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : flags.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="FEATURE FLAGS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN · SYSTÈME</Text>
        <Text style={s.title} accessibilityRole="header">
          Drapeaux
        </Text>

        {/* Nouveau drapeau. */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionLabel>Nouveau drapeau</SectionLabel>
          <Field
            label="Clé"
            value={newKey}
            onChangeText={setNewKey}
            placeholder="ex. coach_ai_v2"
            autoCapitalize="none"
          />
          <Field
            label="Description"
            optional
            value={newDesc}
            onChangeText={setNewDesc}
            placeholder="À quoi sert ce drapeau"
            maxLength={200}
          />
          <View style={{ marginTop: theme.spacing.md }}>
            <Button label="Créer (désactivé)" loading={saving} onPress={onCreate} />
          </View>
        </View>

        {/* Liste. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Drapeaux existants</SectionLabel>
          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Aucun drapeau"
            emptyMessage="Créez votre premier drapeau ci-dessus."
            errorCause="La liste des drapeaux n'a pas pu être chargée."
            onRetry={reload}
          >
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {flags.map((f) => (
                <Card key={f.key}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                      <Text style={s.flagKey}>{f.key}</Text>
                      {f.description ? <Text style={s.flagDesc}>{f.description}</Text> : null}
                    </View>
                    <Switch
                      value={f.enabled}
                      onValueChange={(v) => onToggle(f, v)}
                      accessibilityRole="switch"
                      accessibilityLabel={f.key}
                      trackColor={{ false: '#26262B', true: ADMIN }}
                      thumbColor={theme.palette.cream}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Supprimer ${f.key}`}
                    hitSlop={6}
                    onPress={() => onDelete(f)}
                    style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={s.deleteT}>Supprimer</Text>
                  </Pressable>
                </Card>
              ))}
            </View>
          </StateWrapper>
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
    color: ADMIN,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  flagKey: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  flagDesc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.45,
  },
  deleteBtn: {
    alignSelf: 'flex-start' as const,
    marginTop: theme.spacing.sm,
    minHeight: 32,
    justifyContent: 'center' as const,
  },
  deleteT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.red,
  },
};
