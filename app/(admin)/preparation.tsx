/**
 * Admin vue 1 — Préparation.
 *
 * Liste des pilotes inscrits à la prochaine session OXV, leur statut
 * KYC, et leur équipement affecté. V1 : structure visuelle, données
 * réelles à wirer avec une vraie session OXV (table `registrations`).
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin) ; promotion via Button (kit) avec état loading pendant
 * l'appel async. Logique de données et de promotion inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { supabase } from '@/lib/supabase';
import { promoteToCoach } from '@/services/coachAdminService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';
// Pastille de statut KYC : second signal seulement (le libellé porte le sens,
// lisible AA). La couleur n'est jamais le signal unique d'un statut.
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
  const [failed, setFailed] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const reload = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, kyc_status, pilot_level')
      .eq('role', 'pilot')
      .order('last_name', { ascending: true })
      .limit(50);
    if (error) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setFailed(false);
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
            setPromotingId(pilot.id);
            try {
              const result = await promoteToCoach(pilot.id);
              if (result.ok) await reload();
              else Alert.alert('Échec', result.error ?? 'Erreur inconnue.');
            } finally {
              setPromotingId(null);
            }
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
        <Text style={s.title} accessibilityRole="header">
          Pilotes (<Text style={s.titleNum}>{pilots.length}</Text>)
        </Text>

        {loading ? (
          <ActivityIndicator color={BRONZE} accessibilityLabel="Chargement des pilotes" />
        ) : failed ? (
          <Card style={{ borderColor: theme.palette.line, paddingVertical: theme.spacing.xl }}>
            <Text style={s.errorTitle}>Liste indisponible</Text>
            <Text style={s.errorHint}>
              La lecture des pilotes a échoué. Vérifiez la connexion, puis rouvrez cet écran.
            </Text>
          </Card>
        ) : pilots.length === 0 ? (
          <EmptyState
            label="Préparation"
            message="Aucun pilote inscrit à la prochaine session."
            source="registrations"
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {pilots.map((p) => (
              <Card key={p.id}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{p.fullName}</Text>
                    <Text style={s.meta}>
                      {p.email} · niveau <Text style={s.metaNum}>{p.level ?? '—'}</Text>
                    </Text>
                  </View>
                  <View style={s.kycWrap}>
                    <View
                      style={[s.kycDot, { backgroundColor: kycColor(p.kycStatus) }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                    <Text style={s.kyc}>{kycLabel(p.kycStatus)}</Text>
                  </View>
                </View>
                <View style={{ marginTop: theme.spacing.md }}>
                  <Button
                    label="Promouvoir en coach"
                    variant="ghost"
                    loading={promotingId === p.id}
                    disabled={promotingId !== null && promotingId !== p.id}
                    onPress={() => confirmPromote(p)}
                  />
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

// Libellé KYC lisible (le statut est un mot, pas un chiffre → hors mono).
function kycLabel(status: string): string {
  switch (status) {
    case 'validated':
      return 'KYC validé';
    case 'rejected':
      return 'KYC rejeté';
    case 'expired':
      return 'KYC expiré';
    default:
      return 'KYC en attente';
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
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  titleNum: { fontFamily: theme.fonts.mono },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
  },
  errorTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  errorHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  // Niveau pilote (chiffre) en mono ; le reste de la méta reste du corps.
  metaNum: { fontFamily: theme.fonts.mono, color: theme.palette.creamSoft },
  // Statut KYC : le LIBELLÉ porte le sens et reste lisible (AA) ; la couleur
  // n'est qu'un second signal, portée par une petite pastille (hors mono).
  kycWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  kycDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  kyc: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.creamSoft,
  },
};
