/**
 * Admin — Feature flags (PR-85).
 *
 * Active/désactive des fonctionnalités et déclare des versions d'algos. Ecriture
 * admin (RLS is_admin). Back-office, aucune donnée pilote. Bronze = rôle admin.
 * Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
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
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const BRONZE = '#B87333';

export default function FeatureFlagsScreen() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listFlags().then((f) => {
      if (!cancelled) {
        setFlags(f);
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

  async function onDelete(flag: FeatureFlag) {
    const res = await deleteFlag(flag.key);
    if (res.ok) {
      haptics.tap();
      reload();
    } else {
      Toast.show({ type: 'error', text1: 'La suppression a échoué.' });
    }
  }

  return (
    <Screen>
      <AppBar title="FEATURE FLAGS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
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
          {loading ? (
            <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={BRONZE} accessibilityLabel="Chargement" />
            </View>
          ) : flags.length === 0 ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              <EmptyState
                label="Aucun drapeau"
                message="Créez votre premier drapeau ci-dessus."
                source="app_feature_flags"
              />
            </View>
          ) : (
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
                      trackColor={{ false: '#26262B', true: BRONZE }}
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
    color: BRONZE,
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
