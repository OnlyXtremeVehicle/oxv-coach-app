/**
 * Écran Amis — amitiés pilote ↔ pilote (porte d'entrée du Côte à côte).
 * Reskin fidèle à la maquette refonte-v2 §7bis #7e (screens/29-amis.png).
 *
 * Maquette : champ « Ajouter par @handle » sous le titre, lignes ami =
 * avatar initiales + nom + méta mono « @handle · roulé ensemble ×N »,
 * chevron, caption « Aucun classement entre vous. Juste des repères
 * communs. » Le bouton rond « + » de la maquette est DROP : doublon du
 * champ d'ajout toujours visible (aucun contrôle sans effet réel).
 *
 * Données réelles uniquement :
 *   - Amitiés : pilot_friendships via friendshipsService — flux demande /
 *     acceptation / refus / révocation INCHANGÉS, restylés v2.
 *   - « roulé ensemble ×N » : croisement réel de mes analyses
 *     (app_session_analyses ⋈ telemetry_sessions, analysesService) et des
 *     sessions de l'ami visibles par RLS 0027 (duelService). N = jours
 *     distincts où les deux ont une session le même jour sur le même
 *     circuit. À défaut, « même circuit » si au moins un circuit en commun.
 *     Aucune trace commune → mention masquée (le @handle seul).
 *
 * Doctrine : aucun score, aucun classement, jamais de « gagnant ». La
 * comparaison est un partage consenti entre copains, pas du coaching.
 *
 * Motion (kit src/components/motion) : entrée en fondu, lignes ami en cascade
 * (Stagger), lignes et actions en PressableScale (haptique incluse). Courbes
 * et durées du kit, reduce-motion respecté.
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { listRecentAnalyses } from '@/services/analysesService';
import { loadFriendSessionList } from '@/services/duelService';
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
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper } from '@/ui/StateWrapper';
import { timeAgoFr } from '@/utils/time';

const { palette, fonts, fontSize, spacing } = theme;

/* ------------------------------------------------------------------ */
/* Repères communs — dérivés de données réelles, jamais un score.      */
/* ------------------------------------------------------------------ */

interface SharedTrace {
  /** Jours distincts où les deux pilotes ont roulé le même circuit. */
  togetherCount: number;
  /** Au moins un circuit en commun (sans jour partagé). */
  sharedCircuit: boolean;
}

/** Clé de jour LOCAL (les sessions OXV sont horodatées sur place). */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function normCircuit(name: string | null): string | null {
  const n = (name ?? '').trim().toLowerCase();
  return n || null;
}

/**
 * Croise mes sessions et celles de l'ami. Strict : « roulé ensemble »
 * exige même jour ET même circuit nommé des deux côtés — sinon on ne
 * l'affirme pas.
 */
function computeSharedTrace(
  mine: { startedAt: string; circuitName: string | null }[],
  theirs: { startedAt: string; circuitName: string | null }[]
): SharedTrace {
  const myDayCircuits = new Set<string>();
  const myCircuits = new Set<string>();
  for (const m of mine) {
    const c = normCircuit(m.circuitName);
    if (!c) continue;
    myCircuits.add(c);
    myDayCircuits.add(`${localDayKey(m.startedAt)}|${c}`);
  }

  const togetherDays = new Set<string>();
  let sharedCircuit = false;
  for (const t of theirs) {
    const c = normCircuit(t.circuitName);
    if (!c) continue;
    if (myCircuits.has(c)) sharedCircuit = true;
    const key = `${localDayKey(t.startedAt)}|${c}`;
    if (myDayCircuits.has(key)) togetherDays.add(key);
  }
  return { togetherCount: togetherDays.size, sharedCircuit };
}

/** Mention factuelle de la maquette — masquée si rien ne la porte. */
function sharedMentionOf(trace: SharedTrace | undefined): string | null {
  if (!trace) return null;
  if (trace.togetherCount > 0) return `roulé ensemble ×${trace.togetherCount}`;
  if (trace.sharedCircuit) return 'même circuit';
  return null;
}

/** Initiales d'avatar depuis le @handle réel (« thomas.m » → TM). */
function initialsOf(entry: FriendListEntry): string {
  const source = entry.friendHandle ?? entry.friendFirstName ?? '';
  const letters = source
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || '—';
}

function displayNameOf(entry: FriendListEntry): string {
  return entry.friendFirstName ?? entry.friendHandle ?? `Pilote ${entry.friendId.slice(0, 6)}`;
}

/* ------------------------------------------------------------------ */
/* Écran                                                               */
/* ------------------------------------------------------------------ */

export default function AmisScreen() {
  const profile = useAuthStore((s2) => s2.profile);

  const [accepted, setAccepted] = useState<FriendListEntry[]>([]);
  const [received, setReceived] = useState<FriendListEntry[]>([]);
  const [sent, setSent] = useState<FriendListEntry[]>([]);
  const [sharedByFriend, setSharedByFriend] = useState<Record<string, SharedTrace>>({});
  const [loading, setLoading] = useState(true);

  const [searchHandle, setSearchHandle] = useState('');
  const [searching, setSearching] = useState(false);

  const reload = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [a, r, sn] = await Promise.all([
        listAcceptedFriends(profile.id),
        listPendingReceived(profile.id),
        listPendingSent(profile.id),
      ]);
      setAccepted(a);
      setReceived(r);
      setSent(sn);

      // Repères communs — croisement réel de mes analyses et des sessions
      // de chaque ami (lisibles seulement si amitié acceptée, RLS 0027).
      if (a.length > 0) {
        const mine = (await listRecentAnalyses(profile.id, 100)).map((m) => ({
          startedAt: m.sessionStartedAt,
          circuitName: m.circuitName,
        }));
        const entries = await Promise.all(
          a.map(async (f) => {
            const theirs = await loadFriendSessionList(f.friendId, 100);
            return [f.friendId, computeSharedTrace(mine, theirs)] as const;
          })
        );
        setSharedByFriend(Object.fromEntries(entries));
      } else {
        setSharedByFriend({});
      }
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

  return (
    <Screen>
      <AppBar title="Amis" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        {/* Ajout par @handle — flux d'invitation existant, restylé v2 */}
        <FadeInSection>
          <Field
            label="Ajouter par @handle"
            value={searchHandle}
            onChangeText={setSearchHandle}
            placeholder="@handle"
            helper="Le pseudo public du pilote à inviter."
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={handleSendRequest}
            containerStyle={{ marginBottom: spacing.sm }}
          />
          <Button
            label="Envoyer la demande"
            onPress={handleSendRequest}
            loading={searching}
            disabled={!searchHandle.trim()}
          />
        </FadeInSection>

        <View style={{ marginTop: spacing.xxl }}>
          <StateWrapper state={loading ? 'loading' : 'nominal'} skeletonLines={4}>
            {/* Demandes reçues */}
            {received.length > 0 && (
              <Section title={`Demandes reçues (${received.length})`}>
                <Stagger style={{ gap: spacing.sm }}>
                  {received.map((f) => (
                    <FriendRow
                      key={f.friendshipId}
                      entry={f}
                      meta={metaPending(f)}
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
                </Stagger>
              </Section>
            )}

            {/* Amis acceptés */}
            <Section title={`Amis (${accepted.length})`}>
              {accepted.length === 0 ? (
                <Text style={s.empty}>
                  Aucun ami pour l&apos;instant. Les pilotes que vous ajoutez par @handle
                  apparaissent ici.
                </Text>
              ) : (
                <Stagger style={{ gap: spacing.sm }}>
                  {accepted.map((f) => (
                    <FriendRow
                      key={f.friendshipId}
                      entry={f}
                      meta={metaAccepted(f, sharedByFriend[f.friendId])}
                      onPress={() => router.push(`/(app)/cote-a-cote/${f.friendId}` as never)}
                      actions={[
                        {
                          label: 'Révoquer',
                          kind: 'subtle',
                          onPress: () => handleRevoke(f.friendshipId),
                        },
                      ]}
                    />
                  ))}
                </Stagger>
              )}
            </Section>

            {/* Demandes envoyées en attente */}
            {sent.length > 0 && (
              <Section title={`Demandes envoyées (${sent.length})`}>
                <Stagger style={{ gap: spacing.sm }}>
                  {sent.map((f) => (
                    <FriendRow
                      key={f.friendshipId}
                      entry={f}
                      meta={metaPending(f)}
                      actions={[
                        {
                          label: 'Annuler',
                          kind: 'subtle',
                          onPress: () => handleRevoke(f.friendshipId),
                        },
                      ]}
                    />
                  ))}
                </Stagger>
              </Section>
            )}
          </StateWrapper>
        </View>

        {/* Caption doctrinale de la maquette */}
        <FadeInSection delay={120}>
          <Text style={s.caption}>Aucun classement entre vous. Juste des repères communs.</Text>
        </FadeInSection>
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Méta mono sous le nom — chaque segment trace vers du réel.          */
/* ------------------------------------------------------------------ */

function metaAccepted(entry: FriendListEntry, trace: SharedTrace | undefined): string {
  const parts = [
    entry.friendHandle ? `@${entry.friendHandle}` : null,
    sharedMentionOf(trace),
  ].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' · ') : timeAgoFr(new Date(entry.requestedAt));
}

function metaPending(entry: FriendListEntry): string {
  const parts = [
    entry.friendHandle ? `@${entry.friendHandle}` : null,
    timeAgoFr(new Date(entry.requestedAt)),
  ].filter((p): p is string => Boolean(p));
  return parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* Sections & lignes                                                   */
/* ------------------------------------------------------------------ */

interface ActionDef {
  label: string;
  kind: 'primary' | 'subtle';
  onPress: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl, gap: spacing.sm }}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

function Chevron() {
  return <View style={s.chev} accessibilityElementsHidden importantForAccessibility="no" />;
}

function FriendRow({
  entry,
  meta,
  onPress,
  actions,
}: {
  entry: FriendListEntry;
  meta: string;
  onPress?: () => void;
  actions: ActionDef[];
}) {
  const displayName = displayNameOf(entry);

  const body = (
    <Card>
      <View style={s.rowHead}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initialsOf(entry)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {onPress ? <Chevron /> : null}
      </View>

      {actions.length > 0 && (
        <View style={s.actionsRow}>
          {actions.map((a) => (
            <PressableScale
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={`${a.label} — ${displayName}`}
              haptic="tap"
              onPress={a.onPress}
              style={a.kind === 'primary' ? s.chipPrimary : s.chipSubtle}
            >
              <Text style={a.kind === 'primary' ? s.chipPrimaryTxt : s.chipSubtleTxt}>
                {a.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      )}
    </Card>
  );

  if (!onPress) return body;

  // Ligne actionnable : le retour tactile du kit (scale + haptique légère).
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${displayName} — côte à côte`}
      haptic="tap"
    >
      {body}
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 1,
    color: palette.creamMute,
  },
  rowName: {
    fontFamily: fonts.display,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: palette.creamMute,
    marginTop: 3,
  },
  chev: {
    width: 8,
    height: 8,
    borderTopWidth: 1.6,
    borderRightWidth: 1.6,
    borderColor: palette.faint,
    transform: [{ rotate: '45deg' }],
    marginRight: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  chipPrimary: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: palette.cream,
  },
  chipPrimaryTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#000',
  },
  chipSubtle: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  chipSubtleTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.legend,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
