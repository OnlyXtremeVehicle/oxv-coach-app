/**
 * Admin — Support : file de tickets priorisée (PR-11).
 *
 * P0 en tête. Tap → fil de la demande (statut, priorité, réponse). Admin-only
 * (RLS `is_admin`). Doctrine : sobre, factuel. Bronze = couleur de rôle admin ;
 * le rouge code ici la priorité critique P0 (surface admin), jamais le pilote.
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { listAllTickets } from '@/services/supportAdminService';
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from '@/services/supportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateShort } from '@/utils/format';

const BRONZE = '#B87333';

const STATUS_LABELS: Record<SupportStatus, string> = {
  nouveau: 'Nouveau',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

const PRIORITY_COLOR: Record<SupportPriority, string> = {
  p0: theme.palette.red,
  p1: BRONZE,
  p2: theme.palette.creamMute,
  p3: theme.palette.faint,
};

function categoryLabel(c: SupportCategory): string {
  return SUPPORT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export default function AdminSupportScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openOnly, setOpenOnly] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listAllTickets({ hideClosed: openOnly }).then((rows) => {
      if (!cancelled) {
        setTickets(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [openOnly]);

  useFocusEffect(reload);

  return (
    <Screen>
      <AppBar title="SUPPORT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={[s.eyebrow, { color: BRONZE }]}>FILE DE SUPPORT</Text>
        <Text style={s.title} accessibilityRole="header">
          Les demandes.
        </Text>

        <View style={s.filterRow}>
          {(
            [
              ['En cours', true],
              ['Toutes', false],
            ] as [string, boolean][]
          ).map(([label, val]) => {
            const on = openOnly === val;
            return (
              <Pressable
                key={label}
                onPress={() => setOpenOnly(val)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                hitSlop={6}
                style={[s.filter, on ? s.filterOn : null]}
              >
                <Text style={[s.filterTxt, on ? s.filterTxtOn : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          {!loading && tickets.length === 0 ? (
            <EmptyState
              label="File vide"
              message="Aucune demande à traiter."
              source="support_tickets"
            />
          ) : (
            tickets.map((t) => (
              <Card
                key={t.id}
                onPress={() => router.push(`/(admin)/support/${t.id}` as never)}
                accessibilityLabel={`${t.priority.toUpperCase()}, ${t.subject}, ${STATUS_LABELS[t.status]}`}
              >
                <View style={s.top}>
                  <Text style={[s.prio, { color: PRIORITY_COLOR[t.priority] }]}>
                    {t.priority.toUpperCase()}
                  </Text>
                  <Text style={s.status}>{STATUS_LABELS[t.status]}</Text>
                </View>
                <Text style={s.subject}>{t.subject}</Text>
                <Text style={s.meta}>
                  {categoryLabel(t.category)} · {formatDateShort(t.createdAt)}
                </Text>
              </Card>
            ))
          )}
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
    marginBottom: theme.spacing.lg,
  },
  filterRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  filter: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    minHeight: 40,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  filterOn: {
    borderColor: BRONZE,
    backgroundColor: 'rgba(184,115,51,0.12)',
  },
  filterTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  filterTxtOn: {
    color: theme.palette.cream,
  },
  top: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  prio: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  subject: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
};
