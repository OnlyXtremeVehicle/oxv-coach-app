/**
 * Écran Amis pilotes — gestion des amitiés pour la vue Côte à côte.
 *
 * 3 sections :
 *   1. Ajouter un ami (recherche par @handle)
 *   2. Demandes reçues (accept / decline)
 *   3. Mes amis (toucher → écran côte à côte, swipe → révoquer)
 *   4. Demandes envoyées (révoquer si attente trop longue)
 *
 * Doctrine : pas de notion de "score d'amitié", pas de classement, pas
 * de notifications agressives. Juste une liste sobre. La comparaison
 * entre amis est un partage volontaire entre copains, pas du coaching.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button, typo/couleurs
 * @/theme/v2. Logique d'amitiés (recherche, accept, révoque) inchangée.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type FriendListEntry,
  acceptFriendRequest,
  declineFriendRequest,
  findUserByPublicHandle,
  listAcceptedFriends,
  listPendingReceived,
  listPendingSent,
  revokeFriendship,
  sendFriendRequest,
} from '@/services/friendshipsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { timeAgoFr } from '@/utils/time';

export default function AmisScreen() {
  const profile = useAuthStore((s) => s.profile);

  const [accepted, setAccepted] = useState<FriendListEntry[]>([]);
  const [received, setReceived] = useState<FriendListEntry[]>([]);
  const [sent, setSent] = useState<FriendListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchHandle, setSearchHandle] = useState('');
  const [searching, setSearching] = useState(false);

  const reload = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [a, r, s] = await Promise.all([
        listAcceptedFriends(profile.id),
        listPendingReceived(profile.id),
        listPendingSent(profile.id),
      ]);
      setAccepted(a);
      setReceived(r);
      setSent(s);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSendRequest() {
    if (!profile?.id || !searchHandle.trim()) return;
    setSearching(true);
    try {
      const target = await findUserByPublicHandle(searchHandle);
      if (!target) {
        Toast.show({ type: 'error', text1: 'Pilote introuvable' });
        return;
      }
      if (target.id === profile.id) {
        Toast.show({ type: 'error', text1: "C'est vous." });
        return;
      }
      const result = await sendFriendRequest(profile.id, target.id);
      if ('error' in result) {
        Toast.show({ type: 'error', text1: 'Demande impossible' });
        return;
      }
      Toast.show({
        type: 'success',
        text1: result.created ? 'Demande envoyée' : 'Déjà en relation',
      });
      setSearchHandle('');
      await reload();
    } finally {
      setSearching(false);
    }
  }

  async function handleAccept(friendshipId: string) {
    const ok = await acceptFriendRequest(friendshipId);
    if (ok) {
      Toast.show({ type: 'success', text1: 'Demande acceptée' });
      await reload();
    }
  }

  async function handleDecline(friendshipId: string) {
    const ok = await declineFriendRequest(friendshipId);
    if (ok) await reload();
  }

  async function handleRevoke(friendshipId: string) {
    const ok = await revokeFriendship(friendshipId);
    if (ok) {
      Toast.show({ type: 'info', text1: 'Amitié révoquée' });
      await reload();
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="AMIS" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="AMIS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Pour comparer, en miroir.</Text>

        {/* Bloc recherche */}
        <Card style={[s.dataPanel, { marginBottom: theme.spacing.xxl }]}>
          <View style={s.headRow}>
            <View style={s.headDot} />
            <SectionLabel>AJOUTER UN AMI</SectionLabel>
          </View>
          <TextInput
            value={searchHandle}
            onChangeText={setSearchHandle}
            placeholder="@handle du pilote"
            placeholderTextColor={theme.palette.creamMute}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.input}
            accessibilityLabel="Handle du pilote à inviter"
          />
          <Button
            label={searching ? 'Recherche…' : 'Envoyer la demande'}
            onPress={handleSendRequest}
            disabled={searching || !searchHandle.trim()}
          />
        </Card>

        {/* Demandes reçues */}
        {received.length > 0 && (
          <Section title={`DEMANDES REÇUES (${received.length})`}>
            {received.map((f) => (
              <FriendRow
                key={f.friendshipId}
                entry={f}
                actions={[
                  {
                    label: 'Accepter',
                    kind: 'primary',
                    onPress: () => handleAccept(f.friendshipId),
                  },
                  {
                    label: 'Décliner',
                    kind: 'subtle',
                    onPress: () => handleDecline(f.friendshipId),
                  },
                ]}
              />
            ))}
          </Section>
        )}

        {/* Mes amis acceptés */}
        <Section title={`MES AMIS (${accepted.length})`}>
          {accepted.length === 0 ? (
            <Text style={s.empty}>
              Aucun ami pour l&apos;instant. Invitez un autre pilote OXV pour comparer vos bilans.
            </Text>
          ) : (
            accepted.map((f) => (
              <FriendRow
                key={f.friendshipId}
                entry={f}
                onPress={() => router.push(`/(app)/cote-a-cote/${f.friendId}` as never)}
                actions={[
                  {
                    label: 'Révoquer',
                    kind: 'subtle',
                    onPress: () => handleRevoke(f.friendshipId),
                  },
                ]}
              />
            ))
          )}
        </Section>

        {/* Demandes envoyées en attente */}
        {sent.length > 0 && (
          <Section title={`DEMANDES ENVOYÉES (${sent.length})`}>
            {sent.map((f) => (
              <FriendRow
                key={f.friendshipId}
                entry={f}
                actions={[
                  { label: 'Annuler', kind: 'subtle', onPress: () => handleRevoke(f.friendshipId) },
                ]}
              />
            ))}
          </Section>
        )}

        {/* Phrase manifeste doctrinale */}
        <Text style={s.manifest}>Comparer pour comprendre, pas pour départager.</Text>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ActionDef {
  label: string;
  kind: 'primary' | 'subtle';
  onPress: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: theme.spacing.xxl, gap: theme.spacing.sm }}>
      <View style={s.headRow}>
        <View style={s.headDot} />
        <SectionLabel>{title}</SectionLabel>
      </View>
      {children}
    </View>
  );
}

function FriendRow({
  entry,
  onPress,
  actions,
}: {
  entry: FriendListEntry;
  onPress?: () => void;
  actions: ActionDef[];
}) {
  const displayName =
    entry.friendFirstName ?? entry.friendHandle ?? `Pilote ${entry.friendId.slice(0, 6)}`;
  const subtitle = entry.friendHandle
    ? `@${entry.friendHandle}`
    : timeAgoFr(new Date(entry.requestedAt));

  const inner = (
    <Card style={s.dataPanel}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowName}>{displayName}</Text>
          <Text style={s.rowMeta}>{subtitle}</Text>
        </View>
        {onPress ? <Text style={s.chevron}>›</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={a.onPress}
            style={({ pressed }) => [
              a.kind === 'primary' ? s.chipPrimary : s.chipSubtle,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={a.kind === 'primary' ? s.chipPrimaryTxt : s.chipSubtleTxt}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

// ─────────────────────────────────────────────────────────────────────────────

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
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
  input: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    borderWidth: 1,
    borderColor: theme.palette.edge,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  empty: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    paddingVertical: theme.spacing.lg,
    lineHeight: theme.fontSize.small * 1.5,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  rowName: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  chevron: {
    color: theme.palette.creamMute,
    fontSize: 18,
  },
  rowMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  chipPrimary: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.palette.cream,
  },
  chipPrimaryTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: '#000',
  },
  chipSubtle: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  chipSubtleTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
