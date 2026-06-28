/**
 * Vue Admin — hub avec 3 entrées Préparation / En cours / Analytique.
 * Reskin V2 : Screen + AppBar (Logo), Card/SectionLabel du kit. Accent
 * bronze conservé (couleur de rôle admin). Logique inchangée.
 */

import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine). Liserés et accents.
const BRONZE = '#B87333';

const VIEWS: { href: string; label: string; description: string }[] = [
  {
    href: '/(admin)/preparation',
    label: 'Préparation',
    description: 'Affectations équipement, vérifications avant session.',
  },
  {
    href: '/(admin)/en-cours',
    label: 'En cours',
    description: 'État Bluetooth en temps réel pendant la session.',
  },
  {
    href: '/(admin)/qualite-data',
    label: 'Qualité data',
    description: 'Sessions à surveiller : frames manquantes, analyse absente, débrief non généré.',
  },
  {
    href: '/(admin)/analytique',
    label: 'Analytique',
    description: 'Métriques globales post-session, export.',
  },
  {
    href: '/(admin)/circuit',
    label: 'Inspecteur circuit',
    description: 'Topologie du circuit, virages, heatmap historique des marges.',
  },
  {
    href: '/(admin)/coachs',
    label: 'Coachs',
    description: 'Assignations coach ↔ pilote, gestion des consentements.',
  },
  {
    href: '/(admin)/sessions-media',
    label: 'Médias',
    description: 'Dépôt des photos / vidéos prises sur piste par session.',
  },
  {
    href: '/(admin)/routes-certification',
    label: 'Belles routes',
    description: 'Demandes de certification de routes à examiner.',
  },
  {
    href: '/(admin)/points-carte',
    label: 'Points de la carte',
    description: 'Lieux, partenaires et événements de La carte OXV.',
  },
];

export default function AdminHubScreen() {
  return (
    <Screen>
      <AppBar title="ADMIN OXV" leading={<Logo size={26} />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>COORDINATION</Text>
        <Text style={s.title} accessibilityRole="header">
          Coordination de la session
        </Text>

        <View style={{ gap: theme.spacing.md }}>
          {VIEWS.map((v) => (
            <Card
              key={v.href}
              onPress={() => router.push(v.href as never)}
              accessibilityLabel={`${v.label}. ${v.description}`}
              style={{ borderColor: BRONZE }}
            >
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>{v.label}</Text>
                <Text style={s.cardChevron}>›</Text>
              </View>
              <Text style={s.cardMeta}>{v.description}</Text>
            </Card>
          ))}
        </View>

        <SpaceSwitcher current="admin" />

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sortir de l'admin"
            onPress={() => router.replace('/(app)')}
            hitSlop={theme.hitSlop}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={s.minorLink}>Sortir de l&apos;admin</Text>
          </Pressable>
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
  cardHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardChevron: {
    color: theme.palette.faint,
    fontSize: 17,
  },
  cardMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.5,
  },
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
