/**
 * Messages — liste des fils coach↔pilote (onglet Messages, 2-A).
 *
 * Chaque binôme actif + consenti a un fil durable (table `coach_messages`).
 * Attribué, SANS coordonnées (RGPD). Fonctionne pour le coach ET le pilote (la
 * perspective « autre membre » se dérive du user courant).
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { listMyThreads, type MessageThread } from '@/services/coachMessagesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { timeAgoFr } from '@/utils/time';

const { palette, spacing, fonts, fontSize } = theme;

export default function MessagesScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!profile) return;
      listMyThreads(profile.id).then((rows) => {
        if (active) {
          setThreads(rows);
          setReady(true);
        }
      });
      return () => {
        active = false;
      };
    }, [profile])
  );

  return (
    <Screen>
      <AppBar title="MESSAGES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={s.eyebrow}>MESSAGERIE</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos échanges.
        </Text>

        {!ready ? (
          <EmptyState label="Chargement" message="Chargement de vos fils…" />
        ) : threads.length === 0 ? (
          <EmptyState
            label="Aucun fil"
            message="Vos échanges avec vos pilotes consentis apparaîtront ici. Rien ne fuite : ni numéro, ni email."
          />
        ) : (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {threads.map((t) => (
              <Card
                key={t.coachPilotId}
                onPress={() =>
                  router.push({
                    pathname: '/(coach)/messages/[coachPilotId]',
                    params: {
                      coachPilotId: t.coachPilotId,
                      coachId: t.coachId,
                      pilotId: t.pilotId,
                      name: t.otherName,
                    },
                  } as never)
                }
                accessibilityLabel={`Fil avec ${t.otherName}${t.unread > 0 ? `, ${t.unread} non lus` : ''}`}
              >
                <View style={s.row}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{(t.otherName[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{t.otherName}</Text>
                    <Text style={s.preview} numberOfLines={1}>
                      {t.lastBody ?? 'Pas encore de message.'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {t.lastAt ? <Text style={s.when}>{timeAgoFr(new Date(t.lastAt))}</Text> : null}
                    {t.unread > 0 ? (
                      <View style={s.badge}>
                        <Text style={s.badgeTxt}>{t.unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.coachAlert,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.coachAlert,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: fontSize.body, color: palette.cream },
  name: { fontFamily: fonts.bodyMedium, fontSize: fontSize.bodyLg, color: palette.cream },
  preview: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  when: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 0.4, color: palette.faint },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: palette.coachAccent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeTxt: { fontFamily: fonts.mono, fontSize: 10, color: palette.cream },
};
