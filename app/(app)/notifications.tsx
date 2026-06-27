/**
 * Écran #23 — Notifications. Design V2 (charte oxv-mirror-app).
 *
 * 3 tabs en haut : À traiter / À découvrir / Archives.
 * Badge compteur (or = donnée) uniquement sur "À traiter" quand il y a
 * des actions requises (pacte modifié, KYC à compléter, etc.). Le rouge
 * est réservé à la marque/aux actes — un compteur reste une donnée.
 *
 * V1 : tabs présents avec états vides pédagogiques. Le wiring push
 * réel (expo-notifications + Supabase Edge Function) arrive en sem 11.
 * Reskin V2 : Screen + AppBar, Card, logique inchangée.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useUIStore } from '@/store/useUIStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

type Tab = 'todo' | 'discover' | 'archive';

const TAB_LABELS: Record<Tab, string> = {
  todo: 'À traiter',
  discover: 'À découvrir',
  archive: 'Archives',
};

export default function NotificationsScreen() {
  const [tab, setTab] = useState<Tab>('todo');
  const unread = useUIStore((s) => s.unreadNotificationsCount);

  return (
    <Screen>
      <AppBar title="NOTIFICATIONS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          Vos messages
        </Text>

        <TabBar value={tab} onChange={setTab} todoBadge={unread} />

        <View style={{ marginTop: theme.spacing.xl }}>
          {tab === 'todo' ? <EmptyTab label="Rien à traiter." /> : null}
          {tab === 'discover' ? <EmptyTab label="Rien de nouveau pour le moment." /> : null}
          {tab === 'archive' ? <EmptyTab label="Aucun message archivé." /> : null}
        </View>
      </View>
    </Screen>
  );
}

function TabBar({
  value,
  onChange,
  todoBadge,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
  todoBadge: number;
}) {
  const tabs: Tab[] = ['todo', 'discover', 'archive'];
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t === value;
        const showBadge = t === 'todo' && todoBadge > 0;
        const a11yLabel = showBadge ? `${TAB_LABELS[t]}, ${todoBadge} à traiter` : TAB_LABELS[t];
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={a11yLabel}
            key={t}
            onPress={() => onChange(t)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: active ? theme.palette.edge : theme.palette.line,
              backgroundColor: active ? 'rgba(255,255,255,0.07)' : theme.palette.card2,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={[s.tabT, active && s.tabTOn]}>{TAB_LABELS[t]}</Text>
            {showBadge ? (
              <View style={s.badge}>
                <Text style={s.badgeT}>{todoBadge > 9 ? '9+' : todoBadge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <Card style={[s.dataPanel, { alignItems: 'center', paddingVertical: theme.spacing.xxl }]}>
      <Text style={s.emptyTxt} accessibilityRole="text">
        {label}
      </Text>
    </Card>
  );
}

const s = {
  dataPanel: {
    backgroundColor: theme.palette.card2,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  tabT: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  tabTOn: { color: theme.palette.cream },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.palette.gold,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeT: {
    color: theme.palette.night,
    fontFamily: theme.fonts.mono,
    fontSize: 10,
  },
  emptyTxt: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
};
