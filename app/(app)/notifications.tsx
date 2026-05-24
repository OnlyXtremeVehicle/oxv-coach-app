/**
 * Écran #23 — Notifications.
 *
 * 3 tabs en haut : À traiter / À découvrir / Archives.
 * Badges rouges uniquement sur "À traiter" quand il y a des actions
 * requises (pacte modifié, KYC à compléter, etc.).
 *
 * V1 : tabs présents avec états vides pédagogiques. Le wiring push
 * réel (expo-notifications + Supabase Edge Function) arrive en sem 11.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useUIStore } from '@/store/useUIStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>NOTIFICATIONS</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Vos messages
        </Text>

        <TabBar value={tab} onChange={setTab} todoBadge={unread} />

        <View style={{ marginTop: spacing.xxl }}>
          {tab === 'todo' ? <EmptyTab label="Rien à traiter." /> : null}
          {tab === 'discover' ? <EmptyTab label="Rien de nouveau pour le moment." /> : null}
          {tab === 'archive' ? <EmptyTab label="Aucun message archivé." /> : null}
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {tabs.map((t) => {
        const active = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: active ? colors.accent.red : colors.border.subtle,
              backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : 'transparent',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: active ? colors.text.primary : colors.text.secondary,
                fontSize: fontSize.caption,
                fontWeight: active ? fontWeight.medium : fontWeight.regular,
              }}
            >
              {TAB_LABELS[t]}
            </Text>
            {t === 'todo' && todoBadge > 0 ? (
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: colors.accent.red,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: 10,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {todoBadge > 9 ? '9+' : todoBadge}
                </Text>
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
    <View
      style={{
        padding: spacing.xxl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
        {label}
      </Text>
    </View>
  );
}
