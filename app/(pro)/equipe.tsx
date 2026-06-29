/**
 * Pilote Pro — Espace Équipe (PR-74).
 *
 * Le pro déclare son entourage (coach, préparateur, assistant) et le révoque d'un
 * geste. IMPORTANT : déclarer un membre ne lui donne AUCUN accès à vos données —
 * c'est une liste, pas un partage. Le partage réel de télémétrie sera une étape
 * dédiée et consentie. Aucune hiérarchie affichée. Doctrine : sobre, vouvoiement,
 * pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import { type ProTeamMember, addMember, listMyTeam, revokeMember } from '@/services/proTeamService';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function ProEquipeScreen() {
  const [members, setMembers] = useState<ProTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listMyTeam().then((rows) => {
      if (!cancelled) {
        setMembers(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  async function onAdd() {
    if (saving) return;
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Le nom est requis.' });
      return;
    }
    setSaving(true);
    const res = await addMember({ memberName: name, memberEmail: email, roleLabel: role });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Ajout impossible.' });
      return;
    }
    haptics.success();
    setName('');
    setEmail('');
    setRole('');
    reload();
  }

  async function onRevoke(m: ProTeamMember) {
    const res = await revokeMember(m.id);
    if (res.ok) {
      haptics.tap();
      reload();
    } else {
      Toast.show({ type: 'error', text1: 'La révocation a échoué.' });
    }
  }

  const active = members.filter((m) => !m.revokedAt);

  return (
    <Screen>
      <AppBar title="ÉQUIPE" trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE ENTOURAGE</Text>
        <Text style={s.title} accessibilityRole="header">
          Qui vous entoure.
        </Text>
        <Text style={s.intro}>
          Déclarez votre entourage et révoquez d’un geste. Déclarer une personne ne lui donne aucun
          accès à vos données — c’est une liste, pas un partage.
        </Text>

        {/* Ajouter un membre. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Ajouter</SectionLabel>
          <Field label="Nom" value={name} onChangeText={setName} placeholder="Prénom Nom" />
          <Field
            label="Email"
            optional
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.fr"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="Rôle"
            optional
            value={role}
            onChangeText={setRole}
            placeholder="Coach, préparateur, assistant…"
          />
          <View style={{ marginTop: theme.spacing.md }}>
            <Button label="Ajouter à mon équipe" loading={saving} onPress={onAdd} />
          </View>
        </View>

        {/* Membres déclarés. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Votre équipe</SectionLabel>
          {loading ? (
            <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
            </View>
          ) : active.length === 0 ? (
            <Text style={s.empty}>Personne pour l’instant.</Text>
          ) : (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {active.map((m) => (
                <Card key={m.id}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.memberName} numberOfLines={1}>
                        {m.memberName ?? m.memberEmail ?? 'Membre'}
                      </Text>
                      <Text style={s.memberMeta}>
                        {m.roleLabel}
                        {m.memberEmail ? ` · ${m.memberEmail}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Révoquer ${m.memberName ?? 'ce membre'}`}
                      hitSlop={6}
                      onPress={() => onRevoke(m)}
                      style={({ pressed }) => [s.revokeBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.revokeT}>Révoquer</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <Text style={s.note}>
          Aucune donnée d’équipe n’est exposée sans votre décision. Le partage de vos lectures
          viendra plus tard, geste par geste.
        </Text>
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
  empty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  memberName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  memberMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  revokeBtn: {
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  revokeT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.red,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.xxl,
  },
};
