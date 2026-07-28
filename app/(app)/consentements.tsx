/**
 * Centre de consentement unifié (PR-38).
 *
 * Une seule page où le pilote voit et retire chacun de ses consentements :
 * transfert IA hors UE (débrief J+1, assistant IA du coach), mesure d'audience,
 * ce qu'il partage (coach, vues partagées, amis), et ses droits RGPD (export,
 * suppression). « Retirer un consentement est aussi simple que de le donner. »
 *
 * Pas de seconde source de vérité : les toggles IA passent par consentService,
 * exactement comme les Réglages. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { isAnalyticsOptedOut, setAnalyticsOptOut } from '@/services/analyticsService';
import { requestAccountDeletion } from '@/services/accountService';
import { loadAiConsents, setAiDebriefConsent, setCoachAiConsent } from '@/services/consentService';
import { exportAndShareMyData } from '@/services/dataExportService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function ConsentementsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const userId = profile?.id;

  const [aiDebrief, setAiDebrief] = useState(true);
  const [coachAi, setCoachAi] = useState(false);
  const [analytics, setAnalytics] = useState(() => !isAnalyticsOptedOut());
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadAiConsents(userId).then((c) => {
      if (cancelled) return;
      setAiDebrief(c.aiDebriefEnabled);
      setCoachAi(c.coachAiEnabled);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggleAiDebrief(next: boolean) {
    if (!userId) return;
    setAiDebrief(next);
    await setAiDebriefConsent(userId, next);
  }

  async function toggleCoachAi(next: boolean) {
    if (!userId) return;
    setCoachAi(next);
    await setCoachAiConsent(userId, next);
  }

  function toggleAnalytics(next: boolean) {
    setAnalytics(next);
    setAnalyticsOptOut(!next);
  }

  async function onExport() {
    if (!userId || exporting) return;
    setExporting(true);
    const res = await exportAndShareMyData(userId);
    setExporting(false);
    if (!res.ok) {
      Alert.alert('Export', "L'export n'a pas pu être préparé. Réessayez plus tard.");
    }
  }

  function onDelete() {
    if (!userId || deleting) return;
    Alert.alert(
      'Supprimer mon compte',
      'Votre compte et vos données seront supprimés après un délai de grâce de 30 jours. Avant l’échéance, écrivez à contact@oxvehicle.fr pour annuler. Les données exigées par la loi (facturation) sont conservées séparément.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            setDeleting(true);
            const res = await requestAccountDeletion(userId);
            setDeleting(false);
            if (!res.ok) {
              Alert.alert('Suppression', "La demande n'a pas pu être enregistrée. Réessayez.");
            }
          },
        },
      ]
    );
  }

  return (
    <Screen>
      <AppBar title="CONSENTEMENTS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOS CHOIX</Text>
        <Text style={s.title} accessibilityRole="header">
          Vous gardez la main.
        </Text>
        <Text style={s.intro}>
          Chaque consentement ci-dessous est le vôtre. Le retirer est aussi simple que de le donner,
          à tout moment.
        </Text>

        {/* Transfert hors UE — les deux usages IA. */}
        <Section label="Transfert de données hors UE">
          <ToggleRow
            label="Débrief assisté par IA"
            caption="Le récit du débrief J+1 est rédigé par une IA (OpenAI, hors UE) à partir de données non nominatives. Désactivé : le débrief est rédigé localement, en France."
            value={aiDebrief}
            onValueChange={toggleAiDebrief}
          />
          <ToggleRow
            label="Assistant IA de mon coach"
            caption="Autorise votre coach à pré-rédiger ses observations avec une IA (OpenAI, hors UE) à partir de vos données non nominatives. Chaque observation est relue et validée par votre coach. Désactivé par défaut."
            value={coachAi}
            onValueChange={toggleCoachAi}
            last
          />
        </Section>

        {/* Mesure d'audience. */}
        <Section label="Mesure d'audience">
          <ToggleRow
            label="Statistiques d'usage anonymes"
            caption="Aide à comprendre l'usage de l'app. Aucune donnée personnelle, aucun cookie. Désactivable sans conséquence."
            value={analytics}
            onValueChange={toggleAnalytics}
            last
          />
        </Section>

        {/* Ce que vous partagez — liens vers les écrans canoniques. */}
        <Section label="Ce que vous partagez">
          <LinkRow
            label="Mon coach"
            caption="Affiliation et accès de votre coach à vos sessions."
            onPress={() => router.push('/(app)/mon-coach' as never)}
          />
          <LinkRow
            label="Vues partagées"
            caption="Les bilans que vous avez choisi de partager."
            onPress={() => router.push('/(app)/partage' as never)}
          />
          <LinkRow
            label="Amis pilotes"
            caption="Vos comparaisons consenties entre pilotes."
            onPress={() => router.push('/(app)/amis' as never)}
            last
          />
        </Section>

        {/* Droits RGPD. */}
        <Section label="Vos données">
          <LinkRow
            label="Exporter mes données"
            caption="Recevez une copie de vos données au format ouvert."
            hint={exporting ? 'Préparation' : 'Exporter'}
            busy={exporting}
            onPress={onExport}
          />
          <LinkRow
            label="Supprimer mon compte"
            caption="Suppression définitive après 30 jours."
            hint={deleting ? 'En cours' : 'Supprimer'}
            busy={deleting}
            danger
            onPress={onDelete}
            last
          />
        </Section>

        <Text style={s.footer}>Une question sur vos données ? Écrivez à contact@oxvehicle.fr.</Text>
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <SectionLabel>{label}</SectionLabel>
      <Card style={{ marginTop: theme.spacing.sm, padding: 0, overflow: 'hidden' }}>
        {children}
      </Card>
    </View>
  );
}

function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
  last = false,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last ? null : s.rowBorder]}>
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <Text style={s.rowLabel}>{label}</Text>
        {caption ? <Text style={s.caption}>{caption}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={caption}
        accessibilityState={{ checked: value }}
        trackColor={{ false: '#26262B', true: theme.palette.green }}
        thumbColor={theme.palette.cream}
      />
    </View>
  );
}

function LinkRow({
  label,
  caption,
  hint,
  busy = false,
  danger = false,
  onPress,
  last = false,
}: {
  label: string;
  caption?: string;
  hint?: string;
  busy?: boolean;
  danger?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={busy ? undefined : onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        s.row,
        last ? null : s.rowBorder,
        pressed && !busy && { opacity: 0.85 },
      ]}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <Text style={[s.rowLabel, danger && { color: theme.palette.red }]}>{label}</Text>
        {caption ? <Text style={s.caption}>{caption}</Text> : null}
      </View>
      <View style={s.hintRow}>
        <Text style={[s.rowHint, danger && { color: theme.palette.red }]}>{hint ?? 'Gérer'}</Text>
        {!busy ? <Text style={[s.chevron, danger && { color: theme.palette.red }]}>›</Text> : null}
      </View>
    </Pressable>
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
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.line,
  },
  rowLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.45,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  hintRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
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
  footer: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.xxl,
  },
};
