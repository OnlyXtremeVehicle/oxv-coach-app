/**
 * Admin vue 1 — Préparation.
 *
 * Liste des pilotes inscrits à la prochaine session OXV, leur statut
 * KYC, et leur équipement affecté. V1 : structure visuelle, données
 * réelles à wirer avec une vraie session OXV (table `registrations`).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, kyc_status, pilot_level')
        .eq('role', 'pilot')
        .order('last_name', { ascending: true })
        .limit(50);
      if (cancelled) return;
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>
          ADMIN · PRÉPARATION
        </Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          Pilotes ({pilots.length})
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accent.bronze} />
        ) : pilots.length === 0 ? (
          <Text style={[typography.caption, { color: colors.text.tertiary }]}>
            Aucun pilote inscrit.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {pilots.map((p) => (
              <View
                key={p.id}
                style={{
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: 0.5,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.background.secondary,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text.primary,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.regular,
                    }}
                  >
                    {p.fullName}
                  </Text>
                  <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                    {p.email} · niveau {p.level ?? '—'}
                  </Text>
                </View>
                <Text
                  style={{
                    color: kycColor(p.kycStatus),
                    fontSize: fontSize.caption,
                    fontWeight: fontWeight.medium,
                    fontFamily: 'Menlo',
                    letterSpacing: 1,
                  }}
                >
                  {p.kycStatus.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function kycColor(status: string): string {
  switch (status) {
    case 'validated':
      return colors.margin.green;
    case 'rejected':
      return colors.margin.red;
    case 'expired':
      return colors.margin.yellow;
    default:
      return colors.text.tertiary;
  }
}
