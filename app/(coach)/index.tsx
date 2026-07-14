/**
 * Poste de pilotage — hub de l'espace COACH (handoff §12, `coach/01-poste.png`
 * console + `coach-mobile/06-pilotes.png` compagnon).
 *
 * Le Poste EST la liste des binômes suivis : cartes pilote (RLS
 * `coach_pilots_view` — seulement actifs ET consentis), état de lecture (« à
 * lire » issu de `coach_queue`), activité récente et « à faire ».
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : deux colonnes — pilotes en
 *     grille à gauche, contexte (dernières 24 h · à faire · outils) à droite. Le
 *     rail vertical est fourni par `_layout.tsx`.
 *   - COMPAGNON (téléphone) : une colonne — titre « Mes pilotes », recherche,
 *     liste verticale, puis à-faire/outils sous la ligne de flottaison. Les
 *     onglets bas sont fournis par `_layout.tsx`.
 * Un seul composant, deux arrangements ; aucune navigation cassée.
 *
 * Doctrine coach : vouvoiement, zéro emoji, DESCRIPTIF jamais prescriptif — le
 * coach LIT et oriente, l'app ne dicte pas le pilotage. Identité rouge coach
 * (accents/CTA `#E23A4E`) ; l'or reste réservé au chrono (aucun chrono par
 * pilote ici → aucun or). Aucun classement entre pilotes.
 *
 * Données réelles : chaque valeur trace vers un service coach existant
 * (`listMyPilots`, `loadCoachQueue`, `loadCoachDashboardSummary`). Ce que ces
 * services n'exposent pas par pilote (meilleur tour, régularité) n'est PAS
 * inventé — masqué. Lecture seule partout.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type CoachDashboardSummary,
  type CoachPilotRow,
  listMyPilots,
  loadCoachDashboardSummary,
} from '@/services/coachService';
import { type QueueItem } from '@/services/coachQueueLogic';
import { loadCoachQueue } from '@/services/coachQueueService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { timeAgoFr } from '@/utils/time';

const { palette, fonts, spacing, radius } = theme;

/** Gouttière écran de la console (§5 handoff : 24 px horizontal). */
const CONSOLE_GUTTER = 24;

/** Synthèse par pilote dérivée de la file de lecture (`coach_queue`). */
interface PilotView {
  row: CoachPilotRow;
  /** Séances non lues de ce pilote (statut explicite coach_queue). */
  unread: number;
  /** Horodatage de la séance lisible la plus récente. */
  latestAt: string | null;
  /** Circuit de cette séance la plus récente. */
  circuit: string | null;
}

export default function CoachHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { permissions } = useCoachPermissions();
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<CoachDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  // Facturation gatée par le flag coach_billing (INACTIF jusqu'au SIRET) : le
  // lien reste caché tant que le flag est off, plutôt qu'un « bientôt » visible.
  const [billingOn, setBillingOn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isFlagEnabled('coach_billing')
      .then((on) => {
        if (!cancelled) setBillingOn(on);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([listMyPilots(), loadCoachQueue(), loadCoachDashboardSummary()])
      .then(([rows, q, s]) => {
        if (!cancelled) {
          setPilots(rows);
          setQueue(q);
          setSummary(s);
          setLoading(false);
        }
      })
      .catch(() => {
        // Réseau coupé : état d'erreur honnête avec reprise (SPEC_BUILD §5).
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Synthèse par pilote : « à lire », dernière activité et circuit, dérivés de
  // la file (une seule requête, pas de N+1 ni de log d'accès par pilote).
  const pilotViews = useMemo<PilotView[]>(() => {
    const byPilot = new Map<
      string,
      { unread: number; latestAt: string | null; circuit: string | null }
    >();
    for (const item of queue) {
      const cur = byPilot.get(item.pilotId) ?? { unread: 0, latestAt: null, circuit: null };
      if (item.status === 'unread') cur.unread += 1;
      if (!cur.latestAt || item.startedAt > cur.latestAt) {
        cur.latestAt = item.startedAt;
        cur.circuit = item.circuitName;
      }
      byPilot.set(item.pilotId, cur);
    }
    return pilots.map((row) => {
      const agg = byPilot.get(row.pilotId);
      return {
        row,
        unread: agg?.unread ?? 0,
        latestAt: agg?.latestAt ?? null,
        circuit: agg?.circuit ?? null,
      };
    });
  }, [pilots, queue]);

  const query = search.trim().toLowerCase();
  const visiblePilots = useMemo(
    () =>
      query ? pilotViews.filter((v) => fullName(v.row).toLowerCase().includes(query)) : pilotViews,
    [pilotViews, query]
  );

  // Fil « dernières 24 h » : séances non lues des dernières 24 h (déjà triées
  // récentes d'abord par la file), au plus quatre.
  const recentFeed = useMemo<QueueItem[]>(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return queue
      .filter((i) => i.status === 'unread' && new Date(i.startedAt).getTime() >= dayAgo)
      .slice(0, 4);
  }, [queue]);

  const topUnread = useMemo(() => queue.find((i) => i.status === 'unread') ?? null, [queue]);
  const draftCount = summary?.draftAnnotationCount ?? 0;

  const pilotsState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : pilots.length === 0
        ? 'empty'
        : 'nominal';
  const ready = !loading && !error;

  const firstName = profile?.first_name ?? '';
  const activeCount = pilots.length;

  const openPilot = (pilotId: string) =>
    router.push({ pathname: '/(coach)/pilote/[id]', params: { id: pilotId } } as never);

  // ---- Blocs partagés entre les deux formats ------------------------------

  const searchField = (
    <View style={[s.searchWrap, isConsole && s.searchWrapConsole]}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={isConsole ? 'Rechercher un pilote' : 'Rechercher'}
        placeholderTextColor={palette.eyebrow}
        style={s.searchInput}
        accessibilityLabel="Rechercher un pilote"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );

  const pilotsBlock = (
    <StateWrapper
      state={pilotsState}
      skeletonLines={4}
      emptyLabel="Aucun pilote"
      emptyMessage="Les assignations sont gérées par l'équipe OXV. Un pilote doit aussi consentir au coaching avant que vous voyiez ses données."
      emptySource="coach_pilots_view"
      errorCause="Vos pilotes n'ont pas pu être chargés."
      onRetry={() => setReloadKey((k) => k + 1)}
    >
      {visiblePilots.length === 0 ? (
        <Text style={s.filterEmpty}>Aucun pilote ne correspond à « {search.trim()} ».</Text>
      ) : (
        <View style={isConsole ? s.grid2 : s.grid1}>
          {visiblePilots.map((v) => (
            <View key={v.row.pilotId} style={isConsole ? s.gridItem2 : undefined}>
              <PilotCard view={v} onPress={() => openPilot(v.row.pilotId)} />
            </View>
          ))}
        </View>
      )}
    </StateWrapper>
  );

  const feedBlock = ready ? (
    <View style={s.panel}>
      <SectionLabel>Dernières 24 h</SectionLabel>
      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        {recentFeed.length === 0 ? (
          <Text style={s.calm}>Rien de neuf dans les dernières 24 h.</Text>
        ) : (
          recentFeed.map((i) => (
            <View key={i.sessionId} style={s.feedRow}>
              <View style={s.feedDot} accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={s.feedTxt}>
                <Text style={s.feedName}>{i.pilotName}</Text>
                {` · séance prête à lire · ${timeAgoFr(new Date(i.startedAt))}`}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  ) : null;

  const todoBlock = ready ? (
    <View style={s.panel}>
      <SectionLabel>À faire</SectionLabel>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {topUnread ? (
          <ReadCTA
            label={`Lire la séance de ${firstNameOf(topUnread.pilotName)}`}
            onPress={() =>
              router.push({
                pathname: '/(coach)/studio',
                params: { sessionId: topUnread.sessionId },
              } as never)
            }
          />
        ) : (
          <Text style={s.calm}>Rien à lire dans l'immédiat.</Text>
        )}
        <ToolRow
          label="File de lecture"
          onPress={() => router.push('/(coach)/file-lecture' as never)}
        />
        {draftCount > 0 ? (
          <Text style={s.calm}>
            {draftCount === 1
              ? '1 note en brouillon en attente de partage.'
              : `${draftCount} notes en brouillon en attente de partage.`}
          </Text>
        ) : null}
      </View>
    </View>
  ) : null;

  const outilsBlock = (
    <View style={s.panel}>
      <SectionLabel>Outils</SectionLabel>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <ToolRow label="Demandes" onPress={() => router.push('/(coach)/demandes' as never)} />
        <ToolRow label="Programmes" onPress={() => router.push('/(coach)/cycles' as never)} />
        <ToolRow
          label="Mes repères de virage"
          onPress={() => router.push('/(coach)/reperes' as never)}
        />
        <ToolRow label="Mes gabarits" onPress={() => router.push('/(coach)/gabarits' as never)} />
        <ToolRow label="Assistant IA" onPress={() => router.push('/(coach)/assistant' as never)} />
        <ToolRow label="Ma lecture" onPress={() => router.push('/(coach)/lecture' as never)} />
        <ToolRow label="Vue AR (aperçu)" onPress={() => router.push('/(coach)/ar' as never)} />
        {permissions.canViewPilots && pilots.length >= 2 ? (
          <ToolRow
            label="Comparer deux pilotes"
            onPress={() => router.push('/(coach)/comparer-pilotes' as never)}
          />
        ) : null}
        {permissions.canManageOwnSessions ? (
          <ToolRow label="Mes roulages" onPress={() => router.push('/(coach)/roulages' as never)} />
        ) : null}
        {permissions.canViewBusinessDashboard ? (
          <ToolRow
            label="Tableau de bord"
            onPress={() => router.push('/(coach)/business' as never)}
          />
        ) : null}
        {billingOn ? (
          <ToolRow
            label="Facturation"
            onPress={() => router.push('/(coach)/facturation' as never)}
          />
        ) : null}
      </View>
    </View>
  );

  const footerBlock = (
    <View style={{ marginTop: spacing.xxl }}>
      <SpaceSwitcher current="coach" />
      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        style={({ pressed }) => [s.signOut, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.signOutTxt}>Se déconnecter</Text>
      </Pressable>
    </View>
  );

  // ---- CONSOLE (tablette) --------------------------------------------------

  if (isConsole) {
    return (
      <Screen>
        <View style={{ paddingHorizontal: CONSOLE_GUTTER, paddingBottom: spacing.xxl }}>
          <View style={s.consoleHeader}>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.eyebrow}>POSTE DE PILOTAGE</Text>
              <Text style={s.title} accessibilityRole="header">
                Bonjour{firstName ? ` ${firstName}` : ''}
              </Text>
            </View>
            <View style={s.headerActions}>
              {searchField}
              <AvatarButton
                profile={profile}
                onPress={() => router.push('/(coach)/profil' as never)}
              />
            </View>
          </View>

          <View style={s.twoCol}>
            <View style={s.mainCol}>
              <SectionLabel>{`Mes pilotes · ${activeCount} ${activeCount > 1 ? 'actifs' : 'actif'}`}</SectionLabel>
              <View style={{ marginTop: spacing.md }}>{pilotsBlock}</View>
            </View>
            <View style={s.sideCol}>
              {feedBlock}
              {todoBlock}
              {outilsBlock}
            </View>
          </View>

          {footerBlock}
        </View>
      </Screen>
    );
  }

  // ---- COMPAGNON (téléphone) ----------------------------------------------

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={[s.title, { marginTop: spacing.md }]} accessibilityRole="header">
          Mes pilotes
        </Text>
        <View style={{ marginTop: spacing.lg }}>{searchField}</View>

        <View style={{ marginTop: spacing.lg }}>{pilotsBlock}</View>

        {todoBlock}
        {outilsBlock}
        {footerBlock}
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function PilotCard({ view, onPress }: { view: PilotView; onPress: () => void }) {
  const { row, unread, latestAt, circuit } = view;
  const name = fullName(row);
  const meta = latestAt
    ? [circuit ?? 'Circuit —', timeAgoFr(new Date(latestAt))].join(' · ')
    : prettyLevel(row.pilotLevel);
  const a11y = `${name}. ${
    unread > 0 ? `${unread} séance${unread > 1 ? 's' : ''} à lire` : 'À jour'
  }. ${meta}.`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={a11y}
      style={[s.pilotCard, unread > 0 && s.pilotCardUnread]}
    >
      <View style={s.pilotRow}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials(row)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.pilotName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={s.pilotMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {unread > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{`${unread} À LIRE`}</Text>
          </View>
        ) : (
          <Text style={s.chev} accessibilityElementsHidden importantForAccessibility="no">
            ›
          </Text>
        )}
      </View>
    </Card>
  );
}

function AvatarButton({
  profile,
  onPress,
}: {
  profile: { first_name?: string | null; last_name?: string | null } | null;
  onPress: () => void;
}) {
  const label =
    [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() ||
    '·';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Mon compte"
      onPress={onPress}
      style={({ pressed }) => [s.meBtn, pressed && { opacity: 0.8 }]}
    >
      <View style={s.meAvatar}>
        <Text style={s.meAvatarTxt}>{label}</Text>
      </View>
    </Pressable>
  );
}

function ReadCTA({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }]}
    >
      <Text style={s.ctaTxt}>{label}</Text>
    </Pressable>
  );
}

function ToolRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={label} style={s.toolRow}>
      <View style={s.toolRowInner}>
        <Text style={s.toolLabel}>{label}</Text>
        <Text style={s.chev} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers purs
// ---------------------------------------------------------------------------

function fullName(row: CoachPilotRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Pilote';
}

function firstNameOf(name: string): string {
  return name.split(' ')[0] || name;
}

function initials(row: CoachPilotRow): string {
  const value = [row.firstName?.[0], row.lastName?.[0]].filter(Boolean).join('').toUpperCase();
  return value || '·';
}

function prettyLevel(level: string | null): string {
  switch (level) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Apprivoisé';
    case 'confirme':
      return 'Confirmé';
    case 'expert':
      return 'Expert';
    default:
      return 'Niveau —';
  }
}

const s = StyleSheet.create({
  // Header
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
    marginTop: spacing.xs,
  },

  // Search
  searchWrap: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card2,
  },
  searchWrapConsole: { width: 240 },
  searchInput: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.cream,
    padding: 0,
  },

  // Two-column console
  twoCol: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 1 },
  sideCol: { width: 300, gap: spacing.xl },

  // Pilot grid
  grid1: { gap: spacing.sm },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem2: { flexBasis: '47%', flexGrow: 1, minWidth: 220 },
  filterEmpty: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.creamMute,
    paddingVertical: spacing.md,
  },

  // Pilot card
  pilotCard: { paddingVertical: spacing.md },
  // Accent gauche rouge coach = binôme avec des séances non lues (§12).
  pilotCardUnread: { borderLeftWidth: 2, borderLeftColor: palette.coachAccent },
  pilotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontFamily: fonts.mono, fontSize: 13, color: palette.creamSoft },
  pilotName: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  pilotMeta: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(226,58,78,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(226,58,78,0.35)',
  },
  badgeTxt: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: palette.coachAccent,
  },
  chev: { fontFamily: fonts.body, fontSize: 18, color: palette.creamMute },

  // Panels
  panel: { marginTop: spacing.xl },
  calm: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },

  // Feed 24 h
  feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  feedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: palette.coachAccent,
  },
  feedTxt: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  feedName: { fontFamily: fonts.bodyMedium, color: palette.cream },

  // Primary CTA (rouge coach)
  cta: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  ctaTxt: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },

  // Tool rows (neutres — le rouge reste aux actions/non-lus)
  toolRow: { paddingVertical: spacing.md, minHeight: 44 },
  toolRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },

  // Header avatar
  meBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  meAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meAvatarTxt: { fontFamily: fonts.mono, fontSize: 12, color: palette.cream },

  // Footer
  signOut: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  signOutTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
});
