/**
 * Pilote Pro — Ambassadeur OXV (PR-77).
 *
 * Le pilote pose sa candidature et rédige sa bio ; OXV valide le statut. Un rôle
 * factuel, jamais un rang ni un classement. Doctrine : sobre, vouvoiement, pas
 * d'emoji, pas de marketing creux.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  type AmbassadorProfile,
  applyAsAmbassador,
  loadMyAmbassador,
  updateMyBio,
} from '@/services/ambassadorService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';

const STATUS_LABEL = {
  pending: 'Candidature en cours d’examen',
  active: 'Ambassadeur OXV',
  revoked: 'Candidature close',
} as const;

function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

export default function ProAmbassadeurScreen() {
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    loadMyAmbassador()
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setBio(p?.bio ?? '');
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(reload, [reload]);

  async function onApply() {
    if (saving) return;
    setSaving(true);
    const res = await applyAsAmbassador(bio);
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Candidature impossible.' });
      return;
    }
    haptics.success();
    Toast.show({ type: 'success', text1: 'Candidature envoyée.' });
    reload();
  }

  async function onSaveBio() {
    if (saving) return;
    setSaving(true);
    const res = await updateMyBio(bio);
    setSaving(false);
    Toast.show({
      type: res.ok ? 'success' : 'error',
      text1: res.ok ? 'Bio enregistrée.' : (res.error ?? 'Échec.'),
    });
  }

  const since = sinceLabel(profile?.since ?? null);

  return (
    <Screen>
      <AppBar title="AMBASSADEUR" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>AMBASSADEUR OXV</Text>
        <Text style={s.title} accessibilityRole="header">
          Porter les couleurs.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : !profile ? (
          <>
            <Text style={s.intro}>
              Vous roulez sous les couleurs OXV et souhaitez les représenter ? Présentez-vous en
              quelques mots. L’équipe OXV étudie chaque candidature.
            </Text>
            <View style={{ marginTop: theme.spacing.lg }}>
              <Field
                label="Votre présentation"
                value={bio}
                onChangeText={setBio}
                placeholder="Qui êtes-vous, où roulez-vous, ce qui vous lie à OXV…"
                multiline
                maxLength={600}
              />
              <View style={{ marginTop: theme.spacing.md }}>
                <Button label="Poser ma candidature" loading={saving} onPress={onApply} />
              </View>
            </View>
          </>
        ) : (
          <>
            <Card style={{ marginTop: theme.spacing.lg }}>
              <Text style={s.statusLabel}>{STATUS_LABEL[profile.status]}</Text>
              {profile.status === 'active' && since ? (
                <Text style={s.statusSince}>Depuis {since}</Text>
              ) : null}
              {profile.status === 'pending' ? (
                <Text style={s.statusHint}>
                  Merci. L’équipe OXV revient vers vous. Vous pouvez affiner votre présentation.
                </Text>
              ) : null}
              {profile.status === 'revoked' ? (
                <Text style={s.statusHint}>
                  Cette candidature est close. Pour toute question, écrivez à contact@oxvehicle.fr.
                </Text>
              ) : null}
            </Card>

            {profile.status !== 'revoked' ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <Field
                  label="Votre présentation"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Qui êtes-vous, où roulez-vous…"
                  multiline
                  maxLength={600}
                />
                <View style={{ marginTop: theme.spacing.md }}>
                  <Button
                    label="Enregistrer ma présentation"
                    variant="ghost"
                    loading={saving}
                    onPress={onSaveBio}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
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
  statusLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  statusSince: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  statusHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.sm,
  },
};
