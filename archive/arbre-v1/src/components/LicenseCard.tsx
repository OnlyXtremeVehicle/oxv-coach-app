/**
 * LicenseCard — carte de licence OXV partageable (PR-65).
 *
 * Un insigne d'identité FACTUEL : marque + emblème dérivé de la signature + nom,
 * niveau, ancienneté, et quelques faits cumulés neutres. Capturable en image
 * (react-native-view-shot) pour le partage. Doctrine : un insigne, pas un rang —
 * aucun score, aucun best-lap, aucune comparaison. Sobre, vouvoiement, pas d'emoji.
 */

import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/brand/Logo';
import { DriverAvatar } from '@/components/signature/DriverAvatar';
import type { SignatureAxis } from '@/services/pilotSignatureService';
import { theme } from '@/theme/v2';

export interface LicenseCardProps {
  name: string;
  level: string;
  since: string | null;
  axes: SignatureAxis[];
  sessions: number;
  circuits: number;
  laps: number;
}

export const LicenseCard = forwardRef<View, LicenseCardProps>(function LicenseCard(
  { name, level, since, axes, sessions, circuits, laps },
  ref
) {
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      <View style={s.top}>
        <Logo size={22} />
        <Text style={s.kicker}>LICENCE PILOTE</Text>
      </View>

      <View style={s.body}>
        <DriverAvatar axes={axes} size={92} />
        <Text style={s.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={s.level}>
          {level}
          {since ? ` · depuis ${since}` : ''}
        </Text>
      </View>

      <View style={s.facts}>
        <CardFact value={sessions} label="séances" />
        <CardFact value={circuits} label="circuits" />
        <CardFact value={laps} label="tours" />
      </View>

      <Text style={s.foot}>oxvehicle.fr</Text>
    </View>
  );
});

function CardFact({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factValue}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.palette.line,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    shadowColor: theme.palette.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  body: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  level: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  facts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.lg,
  },
  fact: { alignItems: 'center' },
  factValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
  },
  factLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginTop: 4,
  },
  foot: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: theme.palette.faint,
    textAlign: 'center',
  },
});
