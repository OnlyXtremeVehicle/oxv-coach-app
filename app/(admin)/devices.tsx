/**
 * Admin — Boîtiers (parc + affectations, PR-25).
 *
 * Gère le parc de boîtiers OXV (RaceBox) : ajout, état de santé, et volume
 * d'affectations par boîtier. Admin-only (RLS is_admin). Un boîtier est un
 * équipement — aucune donnée pilote. Bronze = rôle admin. Doctrine : sobre,
 * vouvoiement, pas d'emoji.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  type AdminDevice,
  addDevice,
  listDevices,
  setDeviceHealth,
  setDeviceIdentity,
} from '@/services/adminDevicesService';
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

function healthLabel(h: string): string {
  if (h === 'ok') return 'Opérationnel';
  if (h === 'maintenance') return 'En maintenance';
  return h;
}

export default function AdminDevicesScreen() {
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [label, setLabel] = useState('');
  const [serial, setSerial] = useState('');
  const [saving, setSaving] = useState(false);
  // Renommage flotte (M7.2)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlias, setEditAlias] = useState('');
  const [editFleet, setEditFleet] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);

  const onSaveIdentity = async (d: AdminDevice) => {
    if (savingIdentity) return;
    setSavingIdentity(true);
    const fleet = editFleet.trim() === '' ? null : Number(editFleet);
    const res = await setDeviceIdentity(d.id, editAlias, fleet);
    if (res.ok) {
      setDevices((prev) =>
        prev.map((x) =>
          x.id === d.id ? { ...x, alias: editAlias.trim() || null, fleetNumber: fleet } : x
        )
      );
      setEditingId(null);
    } else {
      // Sans cette branche, un refus laissait le formulaire ouvert et inchangé :
      // ni toast, ni message. L'administrateur croyait avoir enregistré le nom
      // d'un boîtier. Relevé par la cartographie du 02/08/2026.
      Toast.show({ type: 'error', text1: res.error ?? "Le boîtier n'a pas été enregistré." });
    }
    setSavingIdentity(false);
  };

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listDevices()
      .then((d) => {
        if (!cancelled) {
          setDevices(d);
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

  async function onAdd() {
    if (!label.trim()) {
      Toast.show({ type: 'error', text1: 'Le nom du boîtier est requis.' });
      return;
    }
    setSaving(true);
    const res = await addDevice({ label, serial, type: 'racebox' });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Ajout impossible.' });
      return;
    }
    haptics.success();
    setLabel('');
    setSerial('');
    reload();
  }

  async function onToggleHealth(d: AdminDevice) {
    const next = d.healthStatus === 'ok' ? 'maintenance' : 'ok';
    const res = await setDeviceHealth(d.id, next);
    if (res.ok) {
      haptics.tap();
      reload();
    } else {
      Toast.show({ type: 'error', text1: 'Mise à jour impossible.' });
    }
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : devices.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="BOÎTIERS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN · PARC</Text>
        <Text style={s.title} accessibilityRole="header">
          Boîtiers OXV
        </Text>

        {/* Ajouter un boîtier. */}
        <View style={{ marginTop: theme.spacing.lg }}>
          <SectionLabel>Ajouter</SectionLabel>
          <Field label="Nom" value={label} onChangeText={setLabel} placeholder="Ex. RaceBox 03" />
          <Field
            label="Numéro de série"
            optional
            value={serial}
            onChangeText={setSerial}
            placeholder="Ex. RB-XXXX"
            autoCapitalize="characters"
          />
          <View style={{ marginTop: theme.spacing.md }}>
            <Button label="Ajouter au parc" loading={saving} onPress={onAdd} />
          </View>
        </View>

        {/* Parc. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Le parc</SectionLabel>
          <View style={{ marginTop: theme.spacing.sm }}>
            <StateWrapper
              state={state}
              skeletonLines={5}
              emptyLabel="Parc vide"
              emptyMessage="Ajoutez votre premier boîtier ci-dessus."
              emptySource="devices"
              errorCause="Le parc n'a pas pu être chargé."
              onRetry={reload}
            >
              <View style={{ gap: theme.spacing.sm }}>
                {devices.map((d) => {
                  const ok = d.healthStatus === 'ok';
                  const editing = editingId === d.id;
                  return (
                    <Card key={d.id}>
                      <View style={s.rowBetween}>
                        <Text style={s.deviceLabel} numberOfLines={1}>
                          {d.alias ? `${d.alias} · ${d.label}` : d.label}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`État : ${healthLabel(d.healthStatus)}. Basculer.`}
                          hitSlop={6}
                          onPress={() => onToggleHealth(d)}
                          style={({ pressed }) => [s.healthPill, pressed && { opacity: 0.8 }]}
                        >
                          <View
                            style={[s.dot, { backgroundColor: ok ? theme.palette.green : ADMIN }]}
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                          />
                          <Text style={s.healthText}>{healthLabel(d.healthStatus)}</Text>
                        </Pressable>
                      </View>
                      <Text style={s.deviceMeta}>
                        {d.serial ? `${d.serial} · ` : ''}
                        {d.type}
                        {d.batteryStatus ? ` · ${d.batteryStatus}` : ''}
                      </Text>
                      <Text style={s.deviceAssign}>
                        {d.assignmentCount} affectation{d.assignmentCount > 1 ? 's' : ''}
                        {d.fleetNumber != null ? ` · flotte n° ${d.fleetNumber}` : ''}
                      </Text>

                      {/* Renommage flotte (M7.2) : alias lisible jour J + n° aligné
                        sur l'étiquette physique du boîtier. */}
                      {editing ? (
                        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                          <Field
                            label="Alias jour J"
                            value={editAlias}
                            onChangeText={setEditAlias}
                            placeholder="Ex. OXV 07"
                          />
                          <Field
                            label="Numéro de flotte"
                            value={editFleet}
                            onChangeText={(v) => setEditFleet(v.replace(/[^0-9]/g, ''))}
                            placeholder="Ex. 7"
                            keyboardType="number-pad"
                          />
                          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                            <View style={{ flex: 1 }}>
                              <Button
                                label="Enregistrer"
                                onPress={() => onSaveIdentity(d)}
                                disabled={savingIdentity}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button
                                label="Annuler"
                                variant="ghost"
                                onPress={() => setEditingId(null)}
                                disabled={savingIdentity}
                              />
                            </View>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Renommer ${d.alias ?? d.label}`}
                          onPress={() => {
                            setEditingId(d.id);
                            setEditAlias(d.alias ?? '');
                            setEditFleet(d.fleetNumber != null ? String(d.fleetNumber) : '');
                          }}
                          style={{ marginTop: theme.spacing.sm, minHeight: 32 }}
                        >
                          <Text style={s.renameLink}>Renommer (alias jour J)</Text>
                        </Pressable>
                      )}
                    </Card>
                  );
                })}
              </View>
            </StateWrapper>
          </View>
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
  deviceLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  healthPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 36,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.palette.line,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  healthText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  deviceMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  deviceAssign: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
  renameLink: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
};
