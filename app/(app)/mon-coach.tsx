/**
 * Écran "Mon coach" — gestion du consentement RGPD au coaching.
 *
 * Le pilote voit ici les coachs qu'OXV lui a assignés. Pour chacun, il
 * peut consentir (autoriser le coach à voir ses sessions) ou retirer son
 * consentement (le coach cesse immédiatement de voir).
 *
 * Doctrine :
 *   - Le consentement est libre. L'app n'insiste pas, ne moralise pas.
 *   - Pas d'instruction à donner son accord — c'est strictement neutre.
 *   - Le pilote peut révoquer à tout moment, sans justification.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button, typo/couleurs
 * @/theme/v2 (accent coach neutre). Logique de consentement inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import * as haptics from '@/lib/haptics';
import {
  type MyCoachAssignment,
  giveConsent,
  listMyCoaches,
  revokeConsent,
} from '@/services/pilotConsentService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

export default function MonCoachScreen() {
  const [coaches, setCoaches] = useState<MyCoachAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const rows = await listMyCoaches();
      setCoaches(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    listMyCoaches()
      .then((rows) => {
        if (!cancelled) {
          setCoaches(rows);
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

  async function onToggle(assignment: MyCoachAssignment, next: boolean) {
    const result = next ? await giveConsent(assignment.id) : await revokeConsent(assignment.id);
    if (result.ok) {
      // Confirmation tactile : un consentement RGPD mérite un retour clair
      if (next) haptics.success();
      else haptics.tap();
      await reload();
    }
  }

  const activeAssignments = coaches.filter((c) => c.active);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="MON COACH" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="MON COACH" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Le regard d&apos;un autre.</Text>
        <Text style={s.manifest}>Vous décidez qui voit vos sessions.</Text>

        {activeAssignments.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {activeAssignments.map((assignment) => (
              <CoachCard
                key={assignment.id}
                assignment={assignment}
                onToggle={(next) => onToggle(assignment, next)}
              />
            ))}
          </View>
        )}

        {/* Accès aux invitations de roulages (§8). Le pilote convié par un
            coach gère ici sa présence. */}
        <Link href={'/(app)/roulages' as never} asChild>
          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Mes invitations aux roulages" variant="ghost" />
          </View>
        </Link>

        <ExplainerCard />
      </View>
    </Screen>
  );
}

function CoachCard({
  assignment,
  onToggle,
}: {
  assignment: MyCoachAssignment;
  onToggle: (next: boolean) => void;
}) {
  const fullName =
    [assignment.coachFirstName, assignment.coachLastName].filter(Boolean).join(' ') ||
    assignment.coachEmail;
  const consented = assignment.pilotConsentAt !== null;
  const consentText = consented
    ? `Vous avez consenti le ${formatDateLong(assignment.pilotConsentAt!)}`
    : "Vous n'avez pas encore consenti";

  return (
    <Card style={[s.dataPanel, consented ? { borderColor: theme.palette.gold } : null]}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, marginRight: theme.spacing.lg }}>
          <Text style={s.coachName}>{fullName}</Text>
          <Text
            style={[
              s.coachMeta,
              { color: consented ? theme.palette.gold : theme.palette.creamMute },
            ]}
          >
            {consentText}
          </Text>
          <Text style={[s.coachMeta, { marginTop: theme.spacing.xs }]}>
            Assigné par OXV le {formatDateLong(assignment.createdAt)}
          </Text>
        </View>
        <Switch
          value={consented}
          onValueChange={onToggle}
          trackColor={{ false: theme.palette.line, true: theme.palette.gold }}
          thumbColor={theme.palette.cream}
        />
      </View>

      {assignment.notes ? <Text style={s.coachNotes}>{assignment.notes}</Text> : null}
    </Card>
  );
}

function EmptyState() {
  return (
    <Card style={[s.dataPanel, { alignItems: 'center', paddingVertical: theme.spacing.xxl }]}>
      <Text style={s.emptyTitle}>Aucun coach assigné.</Text>
      <Text style={s.emptyHint}>
        Si l&apos;équipe OXV vous assigne un coach, son nom apparaîtra ici. Vous resterez libre de
        consentir ou non au partage de vos données.
      </Text>
    </Card>
  );
}

function ExplainerCard() {
  return (
    <Card style={[s.dataPanel, { marginTop: theme.spacing.xxl }]}>
      <View style={s.headRow}>
        <View style={s.headDot} />
        <SectionLabel>CE QUE LE COACH VOIT</SectionLabel>
      </View>
      <Text style={[s.explainerBody, { marginTop: theme.spacing.sm }]}>
        Quand vous consentez, votre coach voit vos sessions, vos analyses par virage, et votre
        progression. Il ne voit jamais votre email, votre téléphone ou vos documents.
      </Text>
      <Text style={[s.explainerBody, { marginTop: theme.spacing.md }]}>
        Vous pouvez retirer votre accord à tout moment. Le coach cessera immédiatement de voir vos
        données.
      </Text>
    </Card>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xxl,
  },
  dataPanel: {
    backgroundColor: theme.palette.card2,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  coachName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  coachMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  coachNotes: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.md,
  },
  explainerBody: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.6,
  },
};
