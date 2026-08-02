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
 *     grille à gauche, contexte (activité · dernières 24 h · à faire · outils)
 *     à droite. Le rail vertical est fourni par `_layout.tsx`.
 *   - COMPAGNON (téléphone) : une colonne — titre « Mes pilotes », recherche,
 *     liste verticale, puis activité/à-faire/outils sous la ligne de
 *     flottaison. Les onglets bas sont fournis par `_layout.tsx`.
 * Un seul composant, deux arrangements ; aucune navigation cassée.
 *
 * HUB VISUEL (retour fondateur build 23 : « des cases avec des insignes et de
 * la couleur, un rappel visuel pour se relier » + graphiques + animations) :
 *   - Les outils sont une GRILLE DE TUILES : insigne SVG fin (cohérent kit
 *     CoachTabBar — 24×24, trait rond ~1.7), fond card2 teinté ~9 %, bord
 *     d'accent, cascade d'entrée, scale pressé + haptique.
 *   - FAMILLES D'OUTILS — couleurs d'IDENTITÉ DE NAVIGATION, PAS des couleurs
 *     de donnée QDI :
 *       lecture & studio    → rouge coach #E23A4E (palette.coachAccent)
 *       agenda & programmes → neutre chaude #C89B7B (JAMAIS l'or #FFB703,
 *                             réservé chrono/record)
 *       business            → crème #F5F5F7 (palette.cream)
 *       social & pilotes    → violet #A783F2 (teinte violette du thème ; ici
 *                             repère de navigation, sans rapport avec la
 *                             branche QDI régularité)
 *     Le même insigne + couleur devra servir de RAPPEL en tête des écrans
 *     cibles (passe future — ne rien modifier hors de ce hub ici).
 *   - GRAPHIQUES RÉELS : sparkline-barres « séances reçues / jour » sur 7
 *     jours (dérivée des startedAt de la file déjà chargée — zéro requête
 *     nouvelle) + anneau « lues / à lire » (compteurs réels de groupQueue).
 *     Valeur absente → graphique MASQUÉ, jamais de courbe plate inventée.
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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { CountUpNumber, FadeInSection, useReduceMotion } from '@/components/motion';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import {
  familleVisible,
  modeHub,
  phraseMode,
  type FamilleOutil,
} from '@/features/coach/hubModeLogic';
import { useLiveRoster } from '@/hooks/useLiveRoster';
import { useCoachPermissions } from '@/hooks/useCoachPermissions';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import * as haptics from '@/lib/haptics';
import {
  type CoachDashboardSummary,
  type CoachPilotRow,
  listMyPilots,
  loadCoachDashboardSummary,
} from '@/services/coachService';
import { groupQueue, type QueueItem } from '@/services/coachQueueLogic';
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

// ---------------------------------------------------------------------------
// Familles d'outils — identité de navigation (cf. bloc doc en tête de fichier)
// ---------------------------------------------------------------------------

type ToolFamily = 'lecture' | 'agenda' | 'business' | 'pilotes';

const TOOL_FAMILY_COLOR: Record<ToolFamily, string> = {
  lecture: palette.coachAccent, // rouge coach — lecture & studio
  agenda: '#C89B7B', // neutre chaude — agenda & programmes (pas l'or, réservé chrono)
  business: palette.cream, // crème — business
  pilotes: '#A783F2', // violet du thème — social & pilotes (navigation, pas QDI)
};

type ToolKey =
  | 'demandes'
  | 'comparer'
  | 'cycles'
  | 'reperes'
  | 'gabarits'
  | 'assistant'
  | 'lecture'
  | 'ar'
  | 'roulages'
  | 'business'
  | 'facturation';

interface ToolDef {
  key: ToolKey;
  label: string;
  family: ToolFamily;
  route: string;
}

/** rgba(...) depuis un hex #RRGGBB — teintes des tuiles (fond ~9 %, bord ~30 %). */
function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

/** Un jour de la sparkline d'activité (compte réel, jamais inventé). */
interface DayCount {
  key: string;
  label: string;
  count: number;
}

// Initiales des jours, indexées par `Date#getDay()` (0 = dimanche).
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

/** Clé calendaire locale (jour civil) pour grouper les startedAt. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CoachHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const { permissions } = useCoachPermissions();
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [pilots, setPilots] = useState<CoachPilotRow[]>([]);
  /**
   * LE MODE DU HUB — temporel le jour J, structure le reste du temps.
   *
   * Lu sur ce qui SE PASSE, jamais sur le calendrier : une journee peut etre
   * annulee, un pilote peut rouler un jour non prevu. Un pilote au roster, ou
   * une seance arrivee aujourd'hui — l'un ou l'autre suffit.
   */
  const { roster } = useLiveRoster(profile?.id ?? null);
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
      .then(([rows, q, s2]) => {
        if (!cancelled) {
          setPilots(rows);
          setQueue(q);
          setSummary(s2);
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

  // Activité 7 jours : séances reçues par jour civil, dérivées des startedAt
  // de la file déjà chargée — zéro requête supplémentaire, comptes réels.
  const weekActivity = useMemo<DayCount[]>(() => {
    const now = new Date();
    const days: DayCount[] = [];
    for (let back = 6; back >= 0; back--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      days.push({ key: dayKey(d), label: DAY_LETTERS[d.getDay()], count: 0 });
    }
    const byKey = new Map(days.map((slot) => [slot.key, slot]));
    for (const item of queue) {
      const slot = byKey.get(dayKey(new Date(item.startedAt)));
      if (slot) slot.count += 1;
    }
    return days;
  }, [queue]);
  const weekTotal = useMemo(() => weekActivity.reduce((n, d) => n + d.count, 0), [weekActivity]);

  // Compteurs réels lues / à lire (groupQueue — les archivées sortent du ratio).
  const queueCounts = useMemo(() => groupQueue(queue).counts, [queue]);

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

  // Grille d'outils — mêmes routes et mêmes conditions d'accès qu'avant,
  // regroupées par famille d'identité (cf. mapping en tête de fichier).
  const seancesDuJour = useMemo(() => {
    const debutDuJour = new Date();
    debutDuJour.setHours(0, 0, 0, 0);
    const seuil = debutDuJour.getTime();
    return queue.filter((i) => {
      const t = Date.parse(i.startedAt);
      // Une date illisible ne compte pas : elle ne prouve rien sur aujourd'hui.
      return Number.isFinite(t) && t >= seuil;
    }).length;
  }, [queue]);

  const mode = modeHub({ pilotesEnPiste: roster.length, seancesDuJour });
  const noteMode = phraseMode(mode);

  const tools = useMemo<ToolDef[]>(() => {
    const list: ToolDef[] = [
      { key: 'demandes', label: 'Demandes', family: 'pilotes', route: '/(coach)/demandes' },
    ];
    if (permissions.canViewPilots && pilots.length >= 2) {
      list.push({
        key: 'comparer',
        label: 'Comparer deux pilotes',
        family: 'pilotes',
        route: '/(coach)/comparer-pilotes',
      });
    }
    list.push(
      { key: 'cycles', label: 'Programmes', family: 'agenda', route: '/(coach)/cycles' },
      {
        key: 'reperes',
        label: 'Mes repères de virage',
        family: 'lecture',
        route: '/(coach)/reperes',
      },
      { key: 'gabarits', label: 'Mes gabarits', family: 'lecture', route: '/(coach)/gabarits' },
      { key: 'assistant', label: 'Assistant IA', family: 'lecture', route: '/(coach)/assistant' },
      { key: 'lecture', label: 'Ma lecture', family: 'lecture', route: '/(coach)/lecture' },
      { key: 'ar', label: 'Vue AR (aperçu)', family: 'lecture', route: '/(coach)/ar' }
    );
    if (permissions.canManageOwnSessions) {
      list.push({
        key: 'roulages',
        label: 'Mes roulages',
        family: 'lecture',
        route: '/(coach)/roulages',
      });
    }
    if (permissions.canViewBusinessDashboard) {
      list.push({
        key: 'business',
        label: 'Tableau de bord',
        family: 'business',
        route: '/(coach)/business',
      });
    }
    if (billingOn) {
      list.push({
        key: 'facturation',
        label: 'Facturation',
        family: 'business',
        route: '/(coach)/facturation',
      });
    }
    // LE JOUR J NE GARDE QUE CE QUI SERT AU BORD DE LA PISTE. Quinze sorties,
    // c'est un menu ; on ne regle pas ses gabarits pendant qu'un pilote roule.
    return list.filter((t) => familleVisible(t.family as FamilleOutil, mode));
  }, [permissions, pilots.length, billingOn, mode]);

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

  // Graphiques réels — masqués quand il n'y a rien à montrer (pas de courbe
  // plate inventée) : sparkline si ≥ 1 séance reçue sur 7 jours, anneau si la
  // file contient au moins une séance lue ou à lire.
  const showSpark = weekTotal > 0;
  const showRing = queueCounts.unread + queueCounts.read > 0;
  const activityBlock =
    ready && (showSpark || showRing) ? (
      <FadeInSection delay={40}>
        <View style={s.panel}>
          <SectionLabel>Activité</SectionLabel>
          <Card style={s.activityCard}>
            <View style={s.activityRow}>
              {showSpark ? (
                <View
                  style={s.sparkCol}
                  accessible
                  accessibilityLabel={`${weekTotal} séance${weekTotal > 1 ? 's' : ''} reçue${
                    weekTotal > 1 ? 's' : ''
                  } sur les 7 derniers jours. Par jour : ${weekActivity
                    .map((d) => `${d.label} ${d.count}`)
                    .join(', ')}.`}
                >
                  <Text style={s.chartEyebrow}>Séances reçues · 7 jours</Text>
                  <CountUpNumber value={weekTotal} duration={700} style={s.chartValue} />
                  <WeekSparkline days={weekActivity} />
                </View>
              ) : null}
              {showSpark && showRing ? <View style={s.activityDivider} /> : null}
              {showRing ? (
                <View
                  style={s.ringCol}
                  accessible
                  accessibilityLabel={`${queueCounts.unread} séance${
                    queueCounts.unread > 1 ? 's' : ''
                  } à lire, ${queueCounts.read} lue${queueCounts.read > 1 ? 's' : ''}.`}
                >
                  <ReadRing unread={queueCounts.unread} read={queueCounts.read} />
                  <View style={s.ringLegend}>
                    <View style={s.legendRow}>
                      <View style={[s.legendDot, { backgroundColor: palette.coachAccent }]} />
                      <Text style={s.legendTxt}>{queueCounts.unread} à lire</Text>
                    </View>
                    <View style={s.legendRow}>
                      <View style={[s.legendDot, { backgroundColor: RING_TRACK }]} />
                      <Text style={s.legendTxt}>
                        {queueCounts.read} lue{queueCounts.read > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </Card>
        </View>
      </FadeInSection>
    ) : null;

  const feedBlock = ready ? (
    <FadeInSection delay={100}>
      <View style={s.panel}>
        <SectionLabel>Dernières 24 h</SectionLabel>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {recentFeed.length === 0 ? (
            <Text style={s.calm}>Rien de neuf dans les dernières 24 h.</Text>
          ) : (
            recentFeed.map((i) => (
              <View key={i.sessionId} style={s.feedRow}>
                <View
                  style={s.feedDot}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={s.feedTxt}>
                  <Text style={s.feedName}>{i.pilotName}</Text>
                  {` · séance prête à lire · ${timeAgoFr(new Date(i.startedAt))}`}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </FadeInSection>
  ) : null;

  const todoBlock = ready ? (
    <FadeInSection delay={160}>
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
    </FadeInSection>
  ) : null;

  const outilsBlock = (
    <View style={s.panel}>
      <SectionLabel>Outils</SectionLabel>
      {/* LE MODE S'EXPLIQUE. Sans cette phrase, un coach qui cherche ses
          gabarits un jour de roulage croirait à une panne, pas à un mode. */}
      {noteMode !== null ? <Text style={s.modeNote}>{noteMode}</Text> : null}
      <View style={s.toolGrid}>
        {tools.map((tool, i) => (
          <FadeInSection key={tool.key} delay={200 + i * 45} style={s.toolWrap}>
            <ToolTile tool={tool} onPress={() => router.push(tool.route as never)} />
          </FadeInSection>
        ))}
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
              {activityBlock}
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
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        <Text style={[s.title, { marginTop: spacing.md }]} accessibilityRole="header">
          Mes pilotes
        </Text>
        <View style={{ marginTop: spacing.lg }}>{searchField}</View>

        <View style={{ marginTop: spacing.lg }}>{pilotsBlock}</View>

        {activityBlock}
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

/**
 * Tuile d'outil : insigne + couleur d'identité de famille, fond card2 teinté
 * ~9 %, bord d'accent. Scale léger au pressé (ease-out, pas de spring —
 * doctrine motion) + haptique discret, désactivés si « réduire les
 * animations » est actif.
 */
function ToolTile({ tool, onPress }: { tool: ToolDef; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const color = TOOL_FAMILY_COLOR[tool.family];

  const pressTo = (v: number) => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: v,
      duration: 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tool.label}
        onPressIn={() => pressTo(0.97)}
        onPressOut={() => pressTo(1)}
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        style={[s.tile, { borderColor: rgba(color, 0.3) }]}
      >
        <View pointerEvents="none" style={[s.tileTint, { backgroundColor: rgba(color, 0.09) }]} />
        <View style={[s.tileGlyph, { backgroundColor: rgba(color, 0.14) }]}>
          <ToolGlyph name={tool.key} color={color} />
        </View>
        <Text style={s.tileLabel} numberOfLines={2}>
          {tool.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Insignes SVG des outils — pictogrammes fins cohérents avec le kit
 * (CoachTabBar : viewBox 24, trait rond ~1.7, fill none). Ces insignes sont
 * les REPÈRES à réutiliser en tête des écrans cibles (passe future).
 */
function ToolGlyph({ name, color }: { name: ToolKey; color: string }) {
  const p = {
    stroke: color,
    strokeWidth: 1.7,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {name === 'demandes' ? (
        <>
          <Path d="M4 13.5 6.8 6h10.4L20 13.5V19H4z" {...p} />
          <Path d="M4 13.5h4.6c0 1.9 1.5 3.4 3.4 3.4s3.4-1.5 3.4-3.4H20" {...p} />
        </>
      ) : null}
      {name === 'comparer' ? (
        <>
          <Circle cx={9} cy={12} r={5.2} {...p} />
          <Circle cx={15} cy={12} r={5.2} {...p} />
        </>
      ) : null}
      {name === 'cycles' ? (
        <>
          <Path d="M6.2 6.2A8 8 0 0 1 19.7 10" {...p} />
          <Path d="M19.8 3.8V8h-4.2" {...p} />
          <Path d="M17.8 17.8A8 8 0 0 1 4.3 14" {...p} />
          <Path d="M4.2 20.2V16h4.2" {...p} />
        </>
      ) : null}
      {name === 'reperes' ? (
        <>
          <Path d="M5 20c0-8 4.5-14 14-15" {...p} />
          <Circle cx={9.3} cy={11.2} r={1.9} fill={color} stroke="none" />
        </>
      ) : null}
      {name === 'gabarits' ? (
        <>
          <Rect x={8} y={8} width={12} height={12} rx={2} {...p} />
          <Path d="M16 4.5H6.5a2 2 0 0 0-2 2V16" {...p} />
        </>
      ) : null}
      {name === 'assistant' ? (
        <Path d="M12 3.5 13.9 10 20.5 12 13.9 14 12 20.5 10.1 14 3.5 12 10.1 10z" {...p} />
      ) : null}
      {name === 'lecture' ? (
        <>
          <Path
            d="M12 6.3C10.2 4.8 7.3 4.4 4 5v13.4c3.3-.6 6.2-.2 8 1.3 1.8-1.5 4.7-1.9 8-1.3V5c-3.3-.6-6.2-.2-8 1.3z"
            {...p}
          />
          <Path d="M12 6.3v13.4" {...p} />
        </>
      ) : null}
      {name === 'ar' ? (
        <>
          <Path d="M4 8V6a2 2 0 0 1 2-2h2" {...p} />
          <Path d="M16 4h2a2 2 0 0 1 2 2v2" {...p} />
          <Path d="M20 16v2a2 2 0 0 1-2 2h-2" {...p} />
          <Path d="M8 20H6a2 2 0 0 1-2-2v-2" {...p} />
          <Circle cx={12} cy={12} r={2.3} {...p} />
        </>
      ) : null}
      {name === 'roulages' ? (
        <>
          <Circle cx={12} cy={12} r={8} {...p} />
          <Circle cx={12} cy={12} r={1.6} fill={color} stroke="none" />
          <Path d="M4 12h5.8M14.2 12h5.8M12 14.2v5.8" {...p} />
        </>
      ) : null}
      {name === 'business' ? (
        <>
          <Path d="M4 20h16" {...p} />
          <Path d="M8 20v-6M12 20V10M16 20v-4" {...p} />
        </>
      ) : null}
      {name === 'facturation' ? (
        <>
          <Rect x={5.5} y={3.5} width={13} height={17} rx={2} {...p} />
          <Path d="M9 8.5h6M9 12h6M9 15.5h3.5" {...p} />
        </>
      ) : null}
    </Svg>
  );
}

// ---- Graphiques SVG maison (react-native-svg, zéro lib de charts) ----------

// Géométrie de la sparkline (viewBox — l'axe X s'étire, l'axe Y reste 1:1).
const SPARK_W = 308;
const SPARK_H = 54;
const SPARK_BASE = 50;
const SPARK_TOP = 6;

/**
 * Sparkline-barres « séances reçues / jour » sur 7 jours. Un jour sans séance
 * n'a PAS de barre (compte zéro honnête, pas de plancher visuel inventé).
 * Barres crème neutres : « reçu » n'est ni une alerte (rouge) ni un chrono
 * (or). Les lettres de jours sont rendues en RN (tokens texte) sous le SVG,
 * alignées par colonnes égales.
 */
function WeekSparkline({ days }: { days: DayCount[] }) {
  const max = Math.max(...days.map((d) => d.count));
  const col = SPARK_W / days.length;
  const barW = 16;
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Svg
        width="100%"
        height={SPARK_H}
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
      >
        <Line
          x1={0}
          y1={SPARK_BASE + 0.5}
          x2={SPARK_W}
          y2={SPARK_BASE + 0.5}
          stroke={palette.line}
          strokeWidth={1}
        />
        {days.map((d, i) => {
          if (d.count === 0) return null;
          const h = ((SPARK_BASE - SPARK_TOP) * d.count) / max;
          return (
            <Rect
              key={d.key}
              x={i * col + (col - barW) / 2}
              y={SPARK_BASE - h}
              width={barW}
              height={h}
              rx={2}
              fill={palette.creamSoft}
            />
          );
        })}
      </Svg>
      <View style={s.sparkDays}>
        {days.map((d) => (
          <Text key={d.key} style={s.sparkDayTxt}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Piste neutre de l'anneau (≈ crème 18 % posée sur la carte) — même teinte
// pour la pastille de légende « lues », pour que la légende dise vrai.
const RING_TRACK = '#3A3A40';
const RING_SIZE = 92;
const RING_STROKE = 7;

/**
 * Anneau « lues / à lire » : l'arc rouge coach = séances à lire (cohérent avec
 * le badge « À LIRE » des cartes pilote), la piste neutre = séances lues. Les
 * valeurs exactes sont portées par la légende texte (jamais couleur seule) et
 * le compteur central animé.
 */
function ReadRing({ unread, read }: { unread: number; read: number }) {
  const total = unread + read;
  if (total === 0) return null;
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const frac = unread / total;
  const arc = c * frac;
  return (
    <View style={s.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke={RING_TRACK}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {unread > 0 ? (
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={r}
            stroke={palette.coachAccent}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={frac >= 1 ? undefined : `${arc} ${c - arc}`}
            strokeLinecap={frac >= 1 ? undefined : 'round'}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        ) : null}
      </Svg>
      <View style={s.ringCenter} pointerEvents="none">
        <CountUpNumber value={unread} duration={700} style={s.ringValue} />
        <Text style={s.ringSub}>à lire</Text>
      </View>
    </View>
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

  // Activité (graphiques réels)
  activityCard: { marginTop: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sparkCol: { flex: 1 },
  activityDivider: { width: 1, alignSelf: 'stretch', backgroundColor: palette.separator },
  chartEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  chartValue: {
    fontFamily: fonts.king,
    fontSize: 22,
    letterSpacing: -0.5,
    color: palette.cream,
    marginTop: 2,
  },
  sparkDays: { flexDirection: 'row', marginTop: 4 },
  sparkDayTxt: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 9,
    color: palette.eyebrow,
  },
  ringCol: { alignItems: 'center', gap: spacing.sm },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringValue: {
    fontFamily: fonts.king,
    fontSize: 20,
    letterSpacing: -0.5,
    color: palette.cream,
  },
  ringSub: { fontFamily: fonts.mono, fontSize: 9.5, color: palette.creamMute, marginTop: 1 },
  ringLegend: { gap: 4, alignItems: 'flex-start' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt: { fontFamily: fonts.mono, fontSize: 10, color: palette.creamMute },

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

  // Tool rows (neutres — utilisés hors grille, ex. « File de lecture »)
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

  // Grille d'outils (tuiles à insigne)
  modeNote: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  toolWrap: { flexBasis: '47%', flexGrow: 1, minWidth: 124 },
  tile: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    overflow: 'hidden',
  },
  tileTint: { ...StyleSheet.absoluteFillObject },
  tileGlyph: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.cream,
    marginTop: spacing.sm,
    lineHeight: 17,
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
