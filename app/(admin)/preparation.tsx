/**
 * Admin vue 1 — Préparation.
 *
 * Liste des pilotes inscrits à la prochaine session OXV, leur statut
 * KYC, et leur équipement affecté. V1 : structure visuelle, données
 * réelles à wirer avec une vraie session OXV (table `registrations`).
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin) ; le bouton de promotion garde l'accent coach. Logique
 * de données et de promotion inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { promoteToCoach } from '@/services/coachAdminService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';
// Couleurs sémantiques de statut KYC (factuelles, doublées d'un libellé).
const STATUS = { green: '#97C459', yellow: '#EF9F27', red: '#C8102E' };

interface PilotEntry {
  id: string;
  fullName: string;
  email: string;
  kycStatus: string;
  level: string | null;
}

export default function PreparationScreen() {
  const [pilots, setPilots] = useState<PilotEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, kyc_status, pilot_level')
      .eq('role', 'pilot')
      .order('last_name', { ascending: true })
      .limit(50);
    setPilots(
      (data ?? []).map((row) => ({
        id: row.id,
        fullName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.email || '—',
        email: row.email ?? '',
        kycStatus: row.kyc_status ?? 'pending',
        level: row.pilot_level,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  function confirmPromote(pilot: PilotEntry) {
    Alert.alert(
      'Promouvoir en coach',
      `${pilot.fullName} aura les droits coach OXV. Il pourra voir les sessions des pilotes qui lui seront assignés (avec leur consentement). Continuer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Promouvoir',
          style: 'default',
          onPress: async () => {
            const result = await promoteToCoach(pilot.id);
            if (result.ok) await reload();
            else Alert.alert('Échec', result.error ?? 'Erreur inconnue.');
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <AppBar title="PRÉPARATION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN · PRÉPARATION</Text>
        <Text style={s.title}>Pilotes ({pilots.length})</Text>

        {loading ? (
          <ActivityIndicator color={BRONZE} />
        ) : pilots.length === 0 ? (
          <Text style={s.empty}>Aucun pilote inscrit.</Text>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {pilots.map((p) => (
              <Card key={p.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{p.fullName}</Text>
                  <Text style={s.meta}>
                    {p.email} · niveau {p.level ?? '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: theme.spacing.xs }}>
                  <Text style={[s.kyc, { color: kycColor(p.kycStatus) }]}>
                    {p.kycStatus.toUpperCase()}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => confirmPromote(p)}
                    style={({ pressed }) => ({
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: theme.spacing.xs,
                      borderRadius: theme.radius.sm,
                      borderWidth: 1,
                      borderColor: theme.palette.coach,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={s.promote}>↦ coach</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function kycColor(status: string): string {
  switch (status) {
    case 'validated':
      return STATUS.green;
    case 'rejected':
      return STATUS.red;
    case 'expired':
      return STATUS.yellow;
    default:
      return theme.palette.creamMute;
  }
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
    marginBottom: theme.spacing.xxl,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  kyc: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 1,
  },
  promote: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: theme.palette.coach,
  },
  empty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
};
