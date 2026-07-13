/**
 * Données & sécurité — zone Compte (maquette refonte-v2 §7bis #9c,
 * `screens/40-donnees-securite.png`).
 *
 * L'écran RGPD du pilote : sécurité du compte + droits sur ses données.
 * (La route portait avant l'écran de préservation post-capture, déplacé
 * tel quel vers `preservation.tsx` — collision résolue 2026-07-13.)
 *
 * Fidélité maquette, données réelles uniquement :
 *   - « SÉCURITÉ DU COMPTE » : la maquette montre un toggle 2FA et une ligne
 *     « Changer le mot de passe ». AUCUN backend 2FA n'existe, et aucun flux
 *     de changement/réinitialisation de mot de passe n'existe dans l'app
 *     (l'auth = signIn email+mot de passe, ou liaison par code du site).
 *     Ces deux lignes sont donc MASQUÉES (jamais un contrôle qui ne fait
 *     rien). Reste l'identifiant réel du compte (users.email).
 *   - « VOS DONNÉES » : Exporter mes données (dataExportService, réel) ·
 *     Centre de consentement (écran réel `/consentements` — remplace
 *     honnêtement « Appareils connectés », sans backend de liste d'appareils) ·
 *     Supprimer mon compte (accountService, J+30, rouge doux #E2685A).
 *   - Rassurance à coche verte : « Votre télémétrie vous appartient… ».
 *
 * Doctrine : vouvoiement, ton sec, aucun chiffre inventé, rouge doux
 * (palette.coachAlert) pour la suppression — pas le rouge de marque.
 */

import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { requestAccountDeletion } from '@/services/accountService';
import { exportAndShareMyData } from '@/services/dataExportService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function DonneesSecuriteScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const userId = profile?.id;

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Export de mes données (RGPD art. 20) : JSON réel + share sheet native.
  async function onExport() {
    if (!userId || exporting) return;
    setExporting(true);
    const res = await exportAndShareMyData(userId);
    setExporting(false);
    if (!res.ok) {
      Alert.alert('Export', "L'export n'a pas pu être préparé. Réessayez plus tard.");
    }
  }

  // Suppression de compte (RGPD art. 17) : double confirmation, marquage J+30,
  // puis déconnexion — même flux réel que Réglages.
  function onDelete() {
    if (!userId || deleting) return;
    Alert.alert(
      'Supprimer mon compte',
      'Votre compte et vos données seront supprimés après un délai de grâce de 30 jours. Avant l’échéance, écrivez à contact@oxvehicle.fr pour annuler. Les données exigées par la loi (facturation) sont conservées séparément.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', style: 'destructive', onPress: confirmDelete },
      ]
    );
  }

  function confirmDelete() {
    if (!userId) return;
    Alert.alert(
      'Confirmer la suppression',
      'Cette demande lance la suppression définitive, effective sous 30 jours. Confirmer ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setDeleting(true);
            const res = await requestAccountDeletion(userId);
            setDeleting(false);
            if (res.ok) {
              await signOut();
            } else {
              Alert.alert('Suppression', "La demande n'a pas pu être enregistrée. Réessayez.");
            }
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <AppBar title="Données & sécurité" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {/* SÉCURITÉ DU COMPTE — uniquement le réel (2FA et mot de passe : aucun
            backend/flux, lignes de la maquette masquées, cf. en-tête). */}
        <View style={{ marginTop: theme.spacing.sm }}>
          <SectionLabel>Sécurité du compte</SectionLabel>
        </View>
        <Card style={s.panel}>
          <Row icon={<PersonIcon />} label="Identifiant" value={profile?.email ?? '—'} last />
        </Card>

        {/* VOS DONNÉES — export réel, consentements réels, suppression réelle. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <SectionLabel>Vos données</SectionLabel>
        </View>
        <Card style={s.panel}>
          <Row
            icon={<DownloadIcon />}
            label="Exporter mes données"
            hint={exporting ? 'Préparation…' : undefined}
            busy={exporting}
            onPress={onExport}
          />
          <Row
            icon={<ShieldIcon />}
            label="Centre de consentement"
            onPress={() => router.push('/(app)/consentements' as never)}
          />
          <Row
            icon={<TrashIcon />}
            label="Supprimer mon compte"
            hint={deleting ? 'En cours…' : undefined}
            busy={deleting}
            onPress={onDelete}
            danger
            last
          />
        </Card>

        {/* Rassurance — coche verte (maquette), transposée au vouvoiement. */}
        <View style={s.assureRow}>
          <CheckCircleIcon />
          <Text style={s.assureText}>
            Votre télémétrie vous appartient. Elle n&apos;est jamais vendue, et partagée uniquement
            avec votre accord.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

/* ─────────────────────────── ligne de réglage ─────────────────────────── */

function Row({
  icon,
  label,
  value,
  hint,
  onPress,
  busy = false,
  danger = false,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  busy?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  const Container: React.ElementType = onPress ? Pressable : View;
  return (
    <Container
      onPress={busy || !onPress ? undefined : onPress}
      disabled={onPress ? busy : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? label : undefined}
      accessibilityState={onPress ? { busy, disabled: busy } : undefined}
      style={({ pressed }: { pressed?: boolean }) => [
        s.row,
        !last && s.rowBorder,
        pressed && onPress && !busy ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={s.rowIcon}>{icon}</View>
      <Text style={[s.rowLabel, danger && { color: theme.palette.coachAlert }]}>{label}</Text>
      <View style={s.rowTrailing}>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
        {onPress && !busy ? (
          <Text style={[s.chevron, danger && { color: theme.palette.coachAlert }]}>›</Text>
        ) : null}
      </View>
    </Container>
  );
}

/* ─────────── icônes fines (react-native-svg, trait 1.4, 17 px) ─────────── */

const ICON = 17;

function PersonIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={5.2} r={2.6} stroke={theme.palette.creamMute} strokeWidth={1.4} />
      <Path
        d="M2.9 13.6c0-2.5 2.3-3.9 5.1-3.9s5.1 1.4 5.1 3.9"
        stroke={theme.palette.creamMute}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function DownloadIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 2.5v7M4.9 6.7L8 9.8l3.1-3.1M3 13.2h10"
        stroke={theme.palette.creamMute}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.8l4.6 1.9v3.4c0 3-1.9 5.2-4.6 6.4-2.7-1.2-4.6-3.4-4.6-6.4V3.7L8 1.8z"
        stroke={theme.palette.creamMute}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M5.9 7.7l1.5 1.5 2.7-2.8"
        stroke={theme.palette.creamMute}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon() {
  // Rouge doux (brief #9c) : palette.coachAlert #E2685A — pas le rouge de marque.
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2.8 4.4h10.4M6.4 4.4V2.9h3.2v1.5M4.4 4.4l.7 8.7h5.8l.7-8.7M6.6 7v3.6M9.4 7v3.6"
        stroke={theme.palette.coachAlert}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={8} r={6.3} stroke={theme.palette.green} strokeWidth={1.4} />
      <Path
        d="M5.3 8.1l1.8 1.8 3.6-3.7"
        stroke={theme.palette.green}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ──────────────────────────────── styles ─────────────────────────────── */

const s = {
  // Panneau maquette : surface #111113 (Card), rows au ras (padding 0).
  panel: {
    marginTop: theme.spacing.sm,
    padding: 0,
    overflow: 'hidden' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.separator,
  },
  rowIcon: {
    width: ICON + 2,
    alignItems: 'center' as const,
  },
  rowLabel: {
    flex: 1,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  rowTrailing: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  // Valeur factuelle (email du compte) : voix de l'instrument → mono.
  rowValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  rowHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  chevron: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    lineHeight: 18,
    color: theme.palette.faint,
  },
  assureRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
  },
  assureText: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.55,
    color: theme.palette.creamMute,
  },
};
