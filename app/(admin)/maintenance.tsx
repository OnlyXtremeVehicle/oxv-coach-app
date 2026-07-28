/**
 * Admin — Maintenance & version (PR-45/46).
 *
 * Kill-switch distant (maintenance_mode + message) et gate de version native
 * minimale. Ce que l'admin règle ici s'applique à TOUTE l'app via le
 * MaintenanceGate. Admin-only (RLS is_admin). Bronze = couleur de rôle admin.
 * Doctrine : sobre, vouvoiement, pas d'emoji ; le rouge ne sert qu'à signaler
 * que le kill-switch est ARMÉ (acte, pas perf).
 */

import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { loadAppConfig, updateAppConfig } from '@/services/appConfigService';
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

export default function MaintenanceScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [message, setMessage] = useState('');
  const [minVersion, setMinVersion] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadAppConfig()
      .then((c) => {
        if (cancelled || !c) {
          setLoading(false);
          return;
        }
        setMaintenance(c.maintenanceMode);
        setMessage(c.maintenanceMessage ?? '');
        setMinVersion(c.minSupportedVersion ?? '');
        setLoading(false);
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
  }, [reloadKey]);

  const state: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  async function onSave() {
    if (saving) return;
    setSaving(true);
    const res = await updateAppConfig({
      maintenanceMode: maintenance,
      maintenanceMessage: message.trim() ? message.trim() : null,
      minSupportedVersion: minVersion.trim() ? minVersion.trim() : null,
    });
    setSaving(false);
    Toast.show({
      type: res.ok ? 'success' : 'error',
      text1: res.ok ? 'Configuration enregistrée.' : (res.error ?? 'Échec de l’enregistrement.'),
    });
  }

  return (
    <Screen>
      <AppBar title="MAINTENANCE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <StateWrapper
          state={state}
          skeletonLines={5}
          errorCause="La configuration n’a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <Text style={s.eyebrow}>ADMIN · SYSTÈME</Text>
          <Text style={s.title} accessibilityRole="header">
            Maintenance & version
          </Text>

          {maintenance ? (
            <Card style={{ borderColor: theme.palette.red, marginTop: theme.spacing.lg }}>
              <Text style={s.armed}>
                Kill-switch ARMÉ — l’app est actuellement bloquée pour tous.
              </Text>
            </Card>
          ) : null}

          <View style={{ marginTop: theme.spacing.xl }}>
            <SectionLabel>Mode maintenance</SectionLabel>
            <View style={s.toggleRow}>
              <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                <Text style={s.rowLabel}>Bloquer l’application</Text>
                <Text style={s.rowHint}>
                  Affiche un voile « pause technique » à tous les utilisateurs.
                </Text>
              </View>
              <Switch
                value={maintenance}
                onValueChange={setMaintenance}
                accessibilityRole="switch"
                accessibilityLabel="Bloquer l'application"
                trackColor={{ false: '#26262B', true: theme.palette.red }}
                thumbColor={theme.palette.cream}
              />
            </View>
            <Field
              label="Message affiché"
              optional
              value={message}
              onChangeText={setMessage}
              placeholder="OXV revient très vite…"
              multiline
              maxLength={300}
            />
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionLabel>Version minimale</SectionLabel>
            <Field
              label="Version native minimale"
              optional
              value={minVersion}
              onChangeText={setMinVersion}
              placeholder="1.2.0"
              helper="En dessous, l’app demande une mise à jour obligatoire. Laisser vide pour désactiver."
              autoCapitalize="none"
            />
          </View>

          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Enregistrer" loading={saving} onPress={onSave} />
          </View>
        </StateWrapper>
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
  armed: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    lineHeight: theme.fontSize.small * 1.5,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  rowLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  rowHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.45,
  },
};
