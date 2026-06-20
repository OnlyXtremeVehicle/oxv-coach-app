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
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>AMIS PILOTES</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Pour comparer, en miroir.
        </Text>

        {/* Bloc recherche */}
        <View style={blockStyle}>
          <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>AJOUTER UN AMI</Text>
          <TextInput
            value={searchHandle}
            onChangeText={setSearchHandle}
            placeholder="@handle du pilote"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
            accessibilityLabel="Handle du pilote à inviter"
          />
          <Pressable
            accessibilityRole="button"
            disabled={searching || !searchHandle.trim()}
            onPress={handleSendRequest}
            style={({ pressed }) => ({
              ...primaryButtonStyle,
              opacity: pressed || searching || !searchHandle.trim() ? 0.6 : 1,
            })}
          >
            <Text style={primaryButtonTextStyle}>
              {searching ? 'Recherche…' : 'Envoyer la demande'}
            </Text>
          </Pressable>
        </View>

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
            <Text style={emptyStyle}>
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
        <Text
          style={[
            typography.manifest,
            {
              marginTop: spacing.huge,
              textAlign: 'center',
              color: colors.text.tertiary,
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          Comparer pour comprendre, pas pour départager.
        </Text>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    <View style={{ marginBottom: spacing.xxl }}>
      <Text
        style={[
          typography.eyebrow,
          { color: colors.text.tertiary, marginBottom: spacing.md, marginTop: spacing.lg },
        ]}
      >
        {title}
      </Text>
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
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        marginBottom: spacing.sm,
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
        }}
      >
        {displayName}
      </Text>
      <Text
        style={{
          color: colors.text.tertiary,
          fontSize: fontSize.caption,
          marginTop: spacing.xs,
        }}
      >
        {subtitle}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.md,
        }}
      >
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={a.onPress}
            style={({ pressed }) => ({
              ...(a.kind === 'primary' ? primaryChipStyle : subtleChipStyle),
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={a.kind === 'primary' ? primaryChipTextStyle : subtleChipTextStyle}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
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

const blockStyle = {
  padding: spacing.xl,
  borderRadius: borderRadius.lg,
  borderWidth: 0.5,
  borderColor: colors.border.subtle,
  backgroundColor: colors.background.secondary,
  marginBottom: spacing.xxl,
} as const;

const inputStyle = {
  borderWidth: 0.5,
  borderColor: colors.border.medium,
  borderRadius: borderRadius.md,
  padding: spacing.md,
  fontSize: fontSize.body,
  color: colors.text.primary,
  marginBottom: spacing.md,
} as const;

const primaryButtonStyle = {
  padding: spacing.lg,
  borderRadius: borderRadius.md,
  backgroundColor: colors.accent.red,
  alignItems: 'center',
} as const;

const primaryButtonTextStyle = {
  color: colors.background.primary,
  fontSize: fontSize.body,
  fontWeight: fontWeight.medium,
} as const;

const primaryChipStyle = {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: borderRadius.sm,
  backgroundColor: colors.accent.red,
} as const;

const primaryChipTextStyle = {
  color: colors.background.primary,
  fontSize: fontSize.caption,
  fontWeight: fontWeight.medium,
} as const;

const subtleChipStyle = {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: borderRadius.sm,
  borderWidth: 0.5,
  borderColor: colors.border.medium,
} as const;

const subtleChipTextStyle = {
  color: colors.text.secondary,
  fontSize: fontSize.caption,
} as const;

const emptyStyle = {
  color: colors.text.tertiary,
  fontSize: fontSize.caption,
  textAlign: 'center' as const,
  padding: spacing.lg,
  fontStyle: 'italic' as const,
};
