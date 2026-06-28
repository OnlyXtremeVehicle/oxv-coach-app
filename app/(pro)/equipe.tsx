/**
 * Pilote Pro — Équipe (PR-74, en attente de décision schéma).
 *
 * Déclarer son entourage (coach, préparateur, assistant) et granulariser leurs
 * accès suppose une table dédiée (`pro_team_members`) avec sa RLS et son audit —
 * un STOP-schéma à trancher avec OXV. Tant que la décision n'est pas prise, cet
 * onglet est honnête : il annonce ce qui vient, sans rien fabriquer ni stocker.
 * Doctrine : sobre, vouvoiement, pas d'emoji ; aucune hiérarchie affichée.
 */

import { Text, View } from 'react-native';

import { EmptyState } from '@/components/instruments/EmptyState';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

export default function ProEquipeScreen() {
  return (
    <Screen>
      <AppBar title="ÉQUIPE" trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE ENTOURAGE</Text>
        <Text style={s.title} accessibilityRole="header">
          Bientôt.
        </Text>

        <View style={{ marginTop: theme.spacing.lg }}>
          <EmptyState
            label="Espace Équipe à venir"
            message="Déclarer votre entourage — coach, préparateur, assistant — et choisir ce que chacun voit demande un cadre de droits et d'audit. Nous le construisons avec OXV avant de l'ouvrir."
            source="pro_team_members"
          />
        </View>

        <Card style={{ marginTop: theme.spacing.xl }}>
          <Text style={s.note}>
            Chaque accès sera explicite et révocable d&apos;un geste. Aucune donnée d&apos;équipe ne
            sera exposée sans votre décision.
          </Text>
        </Card>
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
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
};
