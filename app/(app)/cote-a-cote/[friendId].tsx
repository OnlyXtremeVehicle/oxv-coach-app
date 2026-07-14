/**
 * Écran Côte à côte — deux copains pilotes, leurs chiffres l'un à côté de
 * l'autre. Reskin fidèle à la maquette refonte-v2 §7bis #7f
 * (screens/30-cote-a-cote.png).
 *
 * Maquette : deux pastilles d'identité (VOUS en or, l'ami en cyan) sous le
 * titre, un tracé superposé des deux tours, puis un tableau à deux lignes —
 * meilleur tour (or) et vitesse max — avec la valeur de chacun de part et
 * d'autre. Phrase manifeste calme en bas.
 *
 * Doctrine OXV Mirror (verrouillée) :
 *   - AUCUN gagnant, aucun delta jugé, aucune hiérarchie. On juxtapose, on ne
 *     classe pas. Self-only : jamais le QDI de l'ami, jamais sa marge notée.
 *   - L'or reste réservé au chrono / record (le meilleur tour) ; il porte aussi
 *     l'identité « VOUS » ici, calé sur la maquette. L'ami porte le cyan.
 *   - Chaque valeur trace vers une source réelle ; absent → « — »/EmptyState.
 *
 * Données réelles :
 *   - Séances : mes analyses (analysesService) + celles de l'ami (duelService),
 *     lisibles seulement si l'amitié est acceptée (RLS 0027, are_friends).
 *   - Meilleur tour / vitesse max : colonnes de telemetry_sessions. Les miennes
 *     via fetchAllSessions ; celles de l'ami via loadFriendSessionList (RLS
 *     telemetry_sessions_select_friend). Absentes → « — ».
 *   - Tracés superposés : ABTrace charge les frames réelles du meilleur tour de
 *     chaque côté. Côté ami, les frames ne sont pas ouvertes par la RLS (laps /
 *     telemetry_frames restent owner/coach) : l'EmptyState honnête s'affiche
 *     tant qu'aucune trajectoire réelle n'est disponible.
 *
 * Sécurité : si l'ami révoque l'amitié pendant la consultation, les services
 * renvoient [] et l'écran retombe sur ses états vides — RGPD respecté côté DB.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ABTrace } from '@/components/instruments';

import { listRecentAnalyses, type RecentAnalysisRow } from '@/services/analysesService';
import { type DuelSessionRow, loadFriendSessionList } from '@/services/duelService';
import { listAcceptedFriends } from '@/services/friendshipsService';
import { fetchAllSessions } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatLapTime } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

// Identité des deux côtés (maquette §7bis) : VOUS en or (aussi la couleur du
// chrono/record — cohérent, le meilleur tour est le chiffre de la table),
// l'ami en cyan. Aucune couleur de marge, aucun rang : ce sont des étiquettes
// de « qui », pas un verdict.
const SELF_COLOR = palette.gold; // #FFB703 — VOUS
const FRIEND_COLOR = '#22D3EE'; // cyan — l'ami

interface FriendInfo {
  id: string;
  handle: string | null;
  firstName: string | null;
}

/** Meilleur tour / vitesse max d'une séance, tracés vers telemetry_sessions. */
interface SessionMetrics {
  bestLapSeconds: number | null;
  maxSpeedKmh: number | null;
}

export default function CoteACoteScreen() {
  const profile = useAuthStore((s) => s.profile);
  const { friendId } = useLocalSearchParams<{ friendId: string }>();

  const [friendInfo, setFriendInfo] = useState<FriendInfo | null>(null);
  const [mySessions, setMySessions] = useState<RecentAnalysisRow[]>([]);
  const [friendSessions, setFriendSessions] = useState<DuelSessionRow[]>([]);
  const [selectedMine, setSelectedMine] = useState<string | null>(null);
  const [selectedTheirs, setSelectedTheirs] = useState<string | null>(null);

  // Métriques de séance (meilleur tour / vmax) de MES séances, indexées par
  // telemetry_session_id. Celles de l'ami vivent déjà dans DuelSessionRow.
  const [myMetrics, setMyMetrics] = useState<Record<string, SessionMetrics>>({});

  const [loading, setLoading] = useState(true);

  // Chargement initial : mes séances (analyses + métriques), celles de l'ami,
  // et l'info du copain. Tout est lecture seule, la RLS 0027 fait la sécurité.
  useEffect(() => {
    if (!profile?.id || !friendId) return;
    let cancelled = false;
    (async () => {
      const [mine, theirs, friends, mySessionRows] = await Promise.all([
        listRecentAnalyses(profile.id, 20),
        loadFriendSessionList(friendId, 20),
        listAcceptedFriends(profile.id),
        fetchAllSessions(profile.id, { limit: 60 }),
      ]);
      if (cancelled) return;

      setMySessions(mine);
      setFriendSessions(theirs);

      const metrics: Record<string, SessionMetrics> = {};
      for (const s of mySessionRows) {
        metrics[s.id] = {
          bestLapSeconds: s.best_lap_seconds,
          maxSpeedKmh: s.max_speed_kmh,
        };
      }
      setMyMetrics(metrics);

      const friend = friends.find((f) => f.friendId === friendId);
      if (friend) {
        setFriendInfo({
          id: friend.friendId,
          handle: friend.friendHandle,
          firstName: friend.friendFirstName,
        });
      }

      if (mine.length > 0) setSelectedMine(mine[0].telemetrySessionId);
      if (theirs.length > 0) setSelectedTheirs(theirs[0].sessionId);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, friendId]);

  const friendDisplayName = useMemo(() => {
    if (!friendInfo) return 'Cet ami';
    return (
      friendInfo.firstName ??
      (friendInfo.handle ? `@${friendInfo.handle}` : `Pilote ${friendId?.slice(0, 6)}`)
    );
  }, [friendInfo, friendId]);

  const myInitials = useMemo(() => initialsFrom(displayNameSelf(profile)), [profile]);
  const friendInitials = useMemo(
    () => initialsFrom(friendInfo?.firstName ?? friendInfo?.handle ?? null),
    [friendInfo]
  );

  const selectedTheirsRow = friendSessions.find((s) => s.sessionId === selectedTheirs);
  const myMetric = selectedMine ? (myMetrics[selectedMine] ?? null) : null;

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Côte à côte" onBack={() => router.back()} />
        <View style={s.center}>
          <ActivityIndicator color={palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasBothSides = mySessions.length > 0 && friendSessions.length > 0;

  return (
    <Screen>
      <AppBar title="Côte à côte" onBack={() => router.back()} />
      <View style={s.page}>
        {/* Deux pastilles d'identité — VOUS (or) & l'ami (cyan). Étiquettes de
            « qui », jamais un rang. */}
        <View style={s.duo}>
          <IdentityBadge initials={myInitials} name="Vous" color={SELF_COLOR} />
          <Text style={s.amp}>&amp;</Text>
          <IdentityBadge initials={friendInitials} name={friendDisplayName} color={FRIEND_COLOR} />
        </View>

        {!hasBothSides ? (
          <Text style={s.empty}>
            Une séance de chaque côté suffit à comparer. Dès que {friendDisplayName} et vous en
            aurez chacun une, elles apparaîtront ici.
          </Text>
        ) : (
          <>
            {/* Sélecteurs de séances réelles, restylés v2 */}
            <SessionPicker
              label="Votre séance"
              accent={SELF_COLOR}
              items={mySessions.map((m) => ({
                id: m.telemetrySessionId,
                label: `${formatDateShort(m.sessionStartedAt)} · ${m.circuitName ?? '—'}`,
              }))}
              selectedId={selectedMine}
              onSelect={setSelectedMine}
            />
            <SessionPicker
              label={`Séance de ${friendDisplayName}`}
              accent={FRIEND_COLOR}
              items={friendSessions.map((f) => ({
                id: f.sessionId,
                label: `${formatDateShort(f.startedAt)} · ${f.circuitName ?? '—'}`,
              }))}
              selectedId={selectedTheirs}
              onSelect={setSelectedTheirs}
            />

            {/* Tracés superposés, réels ou EmptyState honnête, posés sur une
                surface encadrée (panneau du tracé de la maquette). Le tour A
                (vous) s'affiche en crème appuyée, la référence B (l'ami) en crème
                atténuée : ABTrace, composant partagé, fixe ces teintes ; l'identité
                or / cyan reste portée par les pastilles et la légende ci-dessus. */}
            {selectedMine && selectedTheirs ? (
              <View style={s.traceBlock}>
                <ABTrace
                  sessionA={selectedMine}
                  sessionB={selectedTheirs}
                  labelA="Vous"
                  labelB={friendDisplayName}
                  statusLabel="Vos deux tours · côte à côte"
                  note="Deux lignes, deux styles. On regarde, on ne classe pas."
                  emptyMessage="La superposition apparaîtra dès que vos deux tours auront des frames réelles."
                />
              </View>
            ) : null}

            {/* Tableau meilleur tour / vitesse max — valeurs réelles des deux
                côtés, sans delta ni verdict. */}
            <Card style={s.tableCard}>
              <CompareRow
                label="Meilleur tour"
                mine={formatLapOrDash(myMetric?.bestLapSeconds ?? null)}
                theirs={formatLapOrDash(selectedTheirsRow?.bestLapSeconds ?? null)}
                mineColor={SELF_COLOR}
                theirsColor={FRIEND_COLOR}
                isLast={false}
              />
              <CompareRow
                label="Vitesse max"
                mine={formatSpeedOrDash(myMetric?.maxSpeedKmh ?? null)}
                theirs={formatSpeedOrDash(selectedTheirsRow?.maxSpeedKmh ?? null)}
                mineColor={palette.cream}
                theirsColor={palette.cream}
                isLast
              />
            </Card>
          </>
        )}

        {/* Manifeste doctrinal calme (transposé au vouvoiement). */}
        <Text style={s.manifest}>Deux styles, deux tours. On regarde, on ne classe pas.</Text>
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Pastille d'identité — anneau de couleur du côté (or / cyan).        */
/* ------------------------------------------------------------------ */

function IdentityBadge({
  initials,
  name,
  color,
}: {
  initials: string;
  name: string;
  color: string;
}) {
  return (
    <View style={s.badgeWrap} accessible accessibilityLabel={name}>
      <View style={[s.badge, { borderColor: color }]}>
        <Text style={[s.badgeInitials, { color }]}>{initials}</Text>
      </View>
      <Text style={[s.badgeName, { color }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur de séances réelles — pills mono, accent du côté.          */
/* ------------------------------------------------------------------ */

function SessionPicker({
  label,
  accent,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  accent: string;
  items: { id: string; label: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={s.pickerBlock}>
      <View style={s.pickerHead}>
        <SectionLabel>{label}</SectionLabel>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.pickerRow}>
          {items.map((it) => {
            const active = it.id === selectedId;
            return (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(it.id)}
                style={({ pressed }) => [
                  s.pill,
                  active && { borderColor: accent, backgroundColor: palette.card },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[s.pillTxt, active && { color: palette.cream }]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Ligne du tableau — valeur | libellé | valeur. Aucun delta.          */
/* ------------------------------------------------------------------ */

function CompareRow({
  label,
  mine,
  theirs,
  mineColor,
  theirsColor,
  isLast,
}: {
  label: string;
  mine: string;
  theirs: string;
  mineColor: string;
  theirsColor: string;
  isLast: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}. Vous : ${mine}. L'ami : ${theirs}.`}
      style={[s.tableRow, !isLast && s.tableRowBorder]}
    >
      <Text style={[s.tableValue, { color: mineColor, textAlign: 'left' }]}>{mine}</Text>
      <Text style={s.tableLabel}>{label}</Text>
      <Text style={[s.tableValue, { color: theirsColor, textAlign: 'right' }]}>{theirs}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers d'affichage — chronos via utils, fr virgule, « — » si vide. */
/* ------------------------------------------------------------------ */

function formatLapOrDash(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  return formatLapTime(seconds);
}

function formatSpeedOrDash(kmh: number | null): string {
  if (kmh === null || !Number.isFinite(kmh) || kmh <= 0) return '—';
  return `${Math.round(kmh)} km/h`;
}

function initialsFrom(source: string | null): string {
  const letters = (source ?? '')
    .replace(/^@+/, '')
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
  return letters || '—';
}

function displayNameSelf(profile: { first_name?: string | null } | null): string | null {
  if (!profile) return null;
  return profile.first_name ?? null;
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  duo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  amp: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
    marginTop: 18,
  },
  badgeWrap: { alignItems: 'center', maxWidth: 120 },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInitials: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.body,
    letterSpacing: 1,
  },
  badgeName: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  pickerBlock: { marginBottom: spacing.lg },
  pickerHead: { marginBottom: spacing.sm },
  pickerRow: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    backgroundColor: palette.card2,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },

  traceBlock: { marginTop: spacing.md, marginBottom: spacing.xl },

  tableCard: { padding: 0, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  tableValue: {
    flex: 1,
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.h3,
    letterSpacing: -0.3,
  },
  tableLabel: {
    flex: 1.1,
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
    textAlign: 'center',
  },

  empty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    textAlign: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  manifest: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.6,
    color: palette.legend,
    textAlign: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
});
