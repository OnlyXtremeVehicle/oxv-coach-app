/**
 * Vue Coach — Fiche pilote (CRM lecture seule, handoff §12 · coach/15-fiche-pilote).
 *
 * Reskin refonte-v2 RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : 2 colonnes — identité /
 *     historique à gauche (véhicule, empreinte partagée, rappel confidentialité),
 *     lecture courante à droite (ses séances + outils de guidance, carnet
 *     partagé). Header = identité du pilote + badge « consenti · lecture seule ».
 *   - COMPAGNON (téléphone) : 1 colonne — identité centrée, rangée de repères
 *     (record or, régularité violet, séances), rappel de consentement, séances.
 *
 * Identité COACH rouge (#E23A4E) sur les actifs/actions ; OR (#FFB703) réservé au
 * chrono/record ; couleurs QDI fixes. Lecture seule : le coach LIT, il ne prescrit
 * pas. Périmètre de consentement RLS (jamais email/téléphone/adresse). Logique,
 * services, états et navigation inchangés (comparaison FIFO, bilan, contexte,
 * annoter, priorités, plan). Données réelles uniquement ; absent → « — ».
 *
 * Motion (passe transversale, kit src/components/motion) : identité en fondu,
 * colonnes console en cascade (Stagger), sections compagnon en fondus à délais
 * fixes (blocs conditionnels → pas de cascade indexée), séances cascadées,
 * toutes les actions en PressableScale. Durées et courbes = celles du kit ;
 * reduce-motion respecté par construction.
 */

import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';

import { FadeInSection, PressableScale, Stagger } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type CoachPilotRow,
  type PilotSessionSummary,
  listMyPilots,
  listPilotSessions,
} from '@/services/coachService';
import { pilotLevelLabel } from '@/services/pilotProfileService';
import { type PilotNote, listSharedNotesForPilot } from '@/services/pilotNotesService';
import {
  type SignatureSnapshot,
  listSharedSnapshotsForPilot,
} from '@/services/pilotSignatureSnapshotService';
import { signPilotMedia, type PilotMediaView } from '@/services/pilotMediaService';
import { type MarginZone, marginLabelOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatChronoTenths, formatDateShort } from '@/utils/format';

type Mode = 'browse' | 'compare';

// Couleurs de zone de marge (donnée, toujours doublée du libellé marginLabelOf).
// Marge serrée = rouge de DONNÉE (freinage, dataColors.brake #F65B5B), distinct
// du rouge de MARQUE/coach (#E23A4E) qui code l'identité, jamais une perf.
// Dégradé de marge §7.6 : large→vert, moyen→or (midpoint), serré→rouge de donnée.
const ZONE_COLORS = {
  green: theme.dataColors.accel,
  yellow: theme.palette.gold,
  red: theme.dataColors.brake,
} as const;

export default function CoachPilotDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [pilot, setPilot] = useState<CoachPilotRow | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<Mode>('browse');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pilotMedia, setPilotMedia] = useState<PilotMediaView[]>([]);
  const [sharedNotes, setSharedNotes] = useState<PilotNote[]>([]);
  const [sharedSnapshots, setSharedSnapshots] = useState<SignatureSnapshot[]>([]);

  const toggleSelected = (sessionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(sessionId)) return prev.filter((id) => id !== sessionId);
      if (prev.length >= 2) return [prev[1], sessionId]; // FIFO max 2
      return [...prev, sessionId];
    });
  };

  const canCompare = selectedIds.length === 2;

  const openComparison = () => {
    if (!canCompare || !params.id) return;
    haptics.confirm();
    // Cast nécessaire le temps que les typed routes Expo se régénèrent
    router.push({
      pathname: '/(coach)/comparer',
      params: {
        pilotId: params.id,
        sessionA: selectedIds[0],
        sessionB: selectedIds[1],
      },
    } as never);
  };

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        // Charge les détails pilote (filtré par RLS via coach_pilots_view)
        const pilots = await listMyPilots();
        if (cancelled) return;
        const found = pilots.find((p) => p.pilotId === params.id) ?? null;
        setPilot(found);
        // Signe les médias du pilote (bucket privé ; is_coach_of autorise le coach).
        if (found && found.media.length > 0) {
          signPilotMedia(found.media).then((m) => {
            if (!cancelled) setPilotMedia(m);
          });
        }

        // Charge les sessions (filtré par RLS via telemetry_sessions_coach_select)
        const sess = await listPilotSessions(params.id);
        if (cancelled) return;
        setSessions(sess);

        // Carnet : uniquement les notes que le pilote a explicitement partagées
        // (RLS pilot_notes_coach_select). Lecture seule, accès journalisé.
        const shared = await listSharedNotesForPilot(params.id);
        if (cancelled) return;
        setSharedNotes(shared);

        // Empreinte consolidée : uniquement les snapshots que le pilote a
        // explicitement partagés (RLS). Lecture seule, accès journalisé.
        const snaps = await listSharedSnapshotsForPilot(params.id);
        if (cancelled) return;
        setSharedSnapshots(snaps);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, reloadKey]);

  const fullName = pilot
    ? [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote'
    : 'Chargement…';
  const initials =
    [pilot?.firstName?.[0], pilot?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '·';
  const sinceLabel = pilot?.assignedAt ? formatSince(pilot.assignedAt) : null;

  const sessionsState: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : sessions.length === 0
        ? 'empty'
        : 'nominal';

  // Repères réels (compagnon). Record = meilleur tour toutes séances (or, chrono).
  const bestOverall = sessions.reduce<number | null>((best, sess) => {
    if (sess.bestLapSeconds == null) return best;
    return best == null ? sess.bestLapSeconds : Math.min(best, sess.bestLapSeconds);
  }, null);
  const latestSnapshot = sharedSnapshots[0] ?? null;
  // Régularité = bande QDI (violet) de l'empreinte la plus récente partagée. C'est
  // un CONSTAT descriptif (« réguliers »), jamais un score inventé.
  const regulariteLabel = latestSnapshot?.regularityBand
    ? capitalize(latestSnapshot.regularityBand)
    : '—';

  // — Fragments réutilisés par les deux formats (rendus une seule fois) —

  const consentBadge = <ConsentBadge />;

  const sessionsSection = (
    <View>
      <View style={s.rowBetween}>
        <SectionLabel>Ses séances</SectionLabel>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            mode === 'browse' ? 'Comparer deux séances' : 'Annuler la comparaison'
          }
          hitSlop={theme.hitSlop}
          onPress={() => {
            setMode(mode === 'browse' ? 'compare' : 'browse');
            setSelectedIds([]);
          }}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={s.action}>{mode === 'browse' ? 'Comparer 2 séances' : 'Annuler'}</Text>
        </PressableScale>
      </View>

      {mode === 'compare' ? (
        <Text style={[s.caption, { marginTop: theme.spacing.sm }]}>
          Sélectionnez deux séances à comparer ({selectedIds.length}/2).
        </Text>
      ) : null}

      <StateWrapper
        state={sessionsState}
        skeletonLines={5}
        emptyLabel="Aucune séance pour ce pilote."
        emptyMessage="Les séances apparaissent ici dès qu'elles sont analysées."
        errorCause="La liste des séances n'a pas pu être chargée."
        onRetry={() => setReloadKey((k) => k + 1)}
      >
        <Stagger style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              pilotId={params.id}
              mode={mode}
              selected={selectedIds.includes(session.id)}
              onToggle={() => toggleSelected(session.id)}
            />
          ))}
        </Stagger>
      </StateWrapper>

      {mode === 'compare' ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <Button label="Ouvrir le comparatif" disabled={!canCompare} onPress={openComparison} />
        </View>
      ) : null}
    </View>
  );

  // Outils de guidance (§12) — priorisation du bilan + plan d'objectifs. Le coach
  // oriente ; sa voix apparaît chez le pilote attribuée, jamais comme consigne.
  const guidanceSection = (
    <View style={{ gap: theme.spacing.sm }}>
      <Button
        label="Priorités du bilan"
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/(coach)/priorites',
            params: { pilotId: params.id },
          } as never)
        }
      />
      <Button
        label="Plan d’objectifs"
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/(coach)/plan',
            params: { pilotId: params.id },
          } as never)
        }
      />
    </View>
  );

  const backLink = (
    <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Retour à mes pilotes"
        hitSlop={theme.hitSlop}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={s.back}>Retour à mes pilotes</Text>
      </PressableScale>
    </View>
  );

  // ————————————————————————————————————————————————————————————————
  // CONSOLE TABLETTE — 2 colonnes (identité / lecture courante)
  // ————————————————————————————————————————————————————————————————
  if (isConsole) {
    return (
      <Screen>
        <View style={s.consolePad}>
          <FadeInSection style={s.consoleHeader}>
            <Avatar initials={initials} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={s.title} accessibilityRole="header" numberOfLines={1}>
                {fullName}
              </Text>
              {sinceLabel ? <Text style={s.metaMuted}>{sinceLabel}</Text> : null}
            </View>
            {pilot ? consentBadge : null}
          </FadeInSection>

          {/* Deux colonnes cascadées — la droite (lecture courante) démarre un
              temps après la gauche (identité), rythme du kit. */}
          <View style={s.columns}>
            <Stagger style={s.colLeft}>
              {pilot?.vehicle ? <VehiculeSection vehicle={pilot.vehicle} /> : null}
              {pilot ? <EmpreinteSection snapshots={sharedSnapshots} /> : null}
              {pilot ? (
                <ConsentInfoCard text="Vous ne voyez jamais son email, son téléphone ni son adresse." />
              ) : null}
              {pilot ? <ProfileMetaSection pilot={pilot} /> : null}
              {pilotMedia.length > 0 ? <PilotMediaBlock media={pilotMedia} /> : null}
            </Stagger>

            <Stagger style={s.colRight} initialDelay={80}>
              {sessionsSection}
              {guidanceSection}
              {sharedNotes.length > 0 ? <SharedNotesSection notes={sharedNotes} /> : null}
            </Stagger>
          </View>

          {backLink}
        </View>
      </Screen>
    );
  }

  // ————————————————————————————————————————————————————————————————
  // COMPAGNON TÉLÉPHONE — 1 colonne
  // ————————————————————————————————————————————————————————————————
  return (
    <Screen>
      <AppBar title="Fiche pilote" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <FadeInSection style={s.companionIdentity}>
          <Avatar initials={initials} size={68} />
          <Text style={[s.title, { textAlign: 'center' }]} accessibilityRole="header">
            {fullName}
          </Text>
          {sinceLabel ? (
            <Text style={[s.metaMuted, { textAlign: 'center' }]}>{sinceLabel}</Text>
          ) : null}
        </FadeInSection>

        {/* Rangée de repères — record (or), régularité, séances — en fondu
            juste après l'identité (les tuiles gardent leur flex de rangée). */}
        {pilot ? (
          <FadeInSection delay={80} style={s.tilesRow}>
            <Tile
              value={bestOverall != null ? formatChronoTenths(bestOverall) : '—'}
              label="record"
              color={theme.palette.gold}
            />
            <Tile value={regulariteLabel} label="régularité" color={theme.dataColors.regularity} />
            <Tile
              value={loading ? '—' : String(sessions.length)}
              label="séances"
              color={theme.palette.cream}
            />
          </FadeInSection>
        ) : null}

        {/* Cascade de sections à délais FIXES par bloc (pas d'index) : un bloc
            conditionnel absent laisse un silence de 40 ms imperceptible, et
            l'arrivée des données ne fait jamais rejouer les blocs déjà posés. */}
        {pilot ? (
          <FadeInSection delay={120} style={{ marginTop: theme.spacing.lg }}>
            <ConsentInfoCard text="Consenti · lecture seule. Aucune coordonnée visible." />
          </FadeInSection>
        ) : null}

        <FadeInSection delay={160} style={{ marginTop: theme.spacing.xl }}>
          {sessionsSection}
        </FadeInSection>

        <FadeInSection delay={200} style={{ marginTop: theme.spacing.xl }}>
          {guidanceSection}
        </FadeInSection>

        {pilot ? (
          <FadeInSection delay={240} style={{ marginTop: theme.spacing.xl }}>
            <EmpreinteSection snapshots={sharedSnapshots} />
          </FadeInSection>
        ) : null}

        {sharedNotes.length > 0 ? (
          <FadeInSection delay={280} style={{ marginTop: theme.spacing.xl }}>
            <SharedNotesSection notes={sharedNotes} />
          </FadeInSection>
        ) : null}

        {pilot?.vehicle ? (
          <FadeInSection delay={320} style={{ marginTop: theme.spacing.xl }}>
            <VehiculeSection vehicle={pilot.vehicle} />
          </FadeInSection>
        ) : null}

        {pilot ? (
          <FadeInSection delay={360} style={{ marginTop: theme.spacing.xl }}>
            <ProfileMetaSection pilot={pilot} />
          </FadeInSection>
        ) : null}

        {pilotMedia.length > 0 ? (
          <FadeInSection delay={400} style={{ marginTop: theme.spacing.xl }}>
            <PilotMediaBlock media={pilotMedia} />
          </FadeInSection>
        ) : null}

        {backLink}
      </View>
    </Screen>
  );
}

// ————————————————————————————————————————————————————————————————
// Pièces d'identité
// ————————————————————————————————————————————————————————————————

/** Avatar neutre du pilote (initiales) — le pilote est neutre, jamais le rouge coach. */
function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <View
      style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[s.avatarTxt, { fontSize: Math.round(size * 0.34) }]}>{initials}</Text>
    </View>
  );
}

/** Badge d'accès — vert (état consenti), lecture seule. Jamais l'or, jamais le rouge coach. */
function ConsentBadge() {
  return (
    <View
      style={s.consentBadge}
      accessibilityRole="text"
      accessibilityLabel="Accès consenti, lecture seule"
    >
      <View style={s.consentDot} />
      <Text style={s.consentBadgeTxt}>Consenti · lecture seule</Text>
    </View>
  );
}

/** Rappel de confidentialité — accent vert discret, factuel (garde-fou RLS §12). */
function ConsentInfoCard({ text }: { text: string }) {
  return (
    <View style={s.consentInfo} accessibilityRole="summary">
      <Text style={s.consentInfoTxt}>{text}</Text>
    </View>
  );
}

/** Repère chiffré (compagnon). Or = record, violet = régularité QDI, crème = compte. */
function Tile({ value, label, color }: { value: string; label: string; color: string }) {
  const muted = value === '—';
  return (
    <View style={s.tile}>
      <Text
        style={[s.tileValue, { color: muted ? theme.palette.creamMute : color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

// ————————————————————————————————————————————————————————————————
// Colonne identité / historique
// ————————————————————————————————————————————————————————————————

function VehiculeSection({ vehicle }: { vehicle: string }) {
  return (
    <View>
      <SectionLabel>Véhicule</SectionLabel>
      <Card style={{ marginTop: theme.spacing.sm }}>
        <Text style={s.vehicleModel}>{vehicle}</Text>
      </Card>
    </View>
  );
}

/**
 * Empreinte partagée — la signature (5 axes) que le pilote a explicitement
 * partagée. Silhouette neutre (jamais un score), tracée seulement quand tous les
 * axes ont une mesure ; sinon un constat honnête. Les empreintes plus anciennes
 * restent listées (constats juxtaposés), jamais une courbe d'évolution.
 */
function EmpreinteSection({ snapshots }: { snapshots: SignatureSnapshot[] }) {
  const latest = snapshots[0] ?? null;
  const older = snapshots.slice(1);
  const axes = latest?.axes ?? [];
  const complete = axes.length === 5 && axes.every((a) => a.value !== null);
  const values = complete ? axes.map((a) => a.value as number) : null;
  const braking = latest?.traits.find((t) => t.key === 'braking')?.value ?? null;
  const lateral = latest?.traits.find((t) => t.key === 'lateral')?.value ?? null;
  const detail = [braking && `freinage ${braking}`, lateral && `engagement ${lateral}`]
    .filter(Boolean)
    .join(' · ');
  const size = 132;

  return (
    <View>
      <SectionLabel>Empreinte récente</SectionLabel>
      <Card style={{ marginTop: theme.spacing.sm, gap: theme.spacing.md }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          {values ? (
            <Svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              accessibilityLabel="Empreinte de pilotage sur cinq axes"
            >
              <Polygon
                points={pentaPoints(size, [1, 1, 1, 1, 1])}
                fill="none"
                stroke={theme.palette.line}
                strokeWidth={1}
              />
              <Polygon
                points={pentaPoints(size, [0.5, 0.5, 0.5, 0.5, 0.5])}
                fill="none"
                stroke={theme.palette.line}
                strokeWidth={1}
              />
              <Polygon
                points={pentaPoints(size, values)}
                fill="rgba(245,245,247,0.06)"
                stroke={theme.palette.creamMute}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </Svg>
          ) : (
            <Text style={s.emptyMini}>Empreinte non partagée pour l’instant.</Text>
          )}
          {latest?.regularityBand ? (
            <Text style={s.empreinteBand}>Tours {latest.regularityBand}</Text>
          ) : null}
        </View>
        {detail ? <Text style={[s.caption, { textAlign: 'center' }]}>{detail}</Text> : null}
        {older.length > 0 ? (
          <View style={s.empreinteOlder}>
            {older.map((sn) => (
              <Text key={sn.id} style={s.noteMeta}>
                {formatDateShort(sn.sessionStartedAt ?? sn.computedAt)} · Tours{' '}
                {sn.regularityBand ?? '—'}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

/**
 * Profil pilote (affichage croisé) — édité par le pilote, visible car affilié et
 * consenti (coach_pilots_view). Le véhicule a sa propre carte ; ici le reste.
 */
function ProfileMetaSection({ pilot }: { pilot: CoachPilotRow }) {
  const rows: { label: string; value: string }[] = [];
  if (pilot.pilotLevel) rows.push({ label: 'Niveau', value: pilotLevelLabel(pilot.pilotLevel) });
  if (pilot.experienceYears) rows.push({ label: 'Expérience', value: pilot.experienceYears });
  if (pilot.ffsaLicense) rows.push({ label: 'Licence FFSA', value: pilot.ffsaLicense });

  const links = (
    [
      ['Site web', pilot.socials.website],
      ['Instagram', pilot.socials.instagram],
      ['YouTube', pilot.socials.youtube],
    ] as const
  ).filter(([, url]) => url);

  if (rows.length === 0 && links.length === 0) return null;

  return (
    <View>
      <SectionLabel>Profil pilote</SectionLabel>
      <Card style={{ marginTop: theme.spacing.sm, gap: theme.spacing.md }}>
        {rows.map((r) => (
          <View key={r.label} style={{ gap: 2 }}>
            <Text style={s.profileLabel}>{r.label}</Text>
            <Text style={s.profileValue}>{r.value}</Text>
          </View>
        ))}
        {links.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {links.map(([label, url]) => (
              <PressableScale
                key={label}
                accessibilityRole="link"
                accessibilityLabel={label}
                onPress={() => url && Linking.openURL(url).catch(() => undefined)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: theme.spacing.lg,
                  justifyContent: 'center',
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.palette.line,
                }}
              >
                <Text style={s.profileLink}>{label}</Text>
              </PressableScale>
            ))}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function PilotMediaBlock({ media }: { media: PilotMediaView[] }) {
  return (
    <View>
      <SectionLabel>Médias</SectionLabel>
      <Card style={{ marginTop: theme.spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
        >
          {media.map((m) =>
            m.type === 'photo' && m.signedUrl ? (
              <PressableScale
                key={m.id}
                accessibilityRole="image"
                accessibilityLabel="Photo du pilote"
                onPress={() => m.signedUrl && Linking.openURL(m.signedUrl).catch(() => undefined)}
              >
                <Image source={{ uri: m.signedUrl }} resizeMode="cover" style={s.mediaThumb} />
              </PressableScale>
            ) : (
              <PressableScale
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={m.type === 'video' ? 'Ouvrir la vidéo' : 'Photo'}
                onPress={() => m.signedUrl && Linking.openURL(m.signedUrl).catch(() => undefined)}
                style={[s.mediaThumb, s.mediaCenter]}
              >
                <Text style={s.mediaTileT}>{m.type === 'video' ? 'Vidéo' : 'Photo'}</Text>
              </PressableScale>
            )
          )}
        </ScrollView>
      </Card>
    </View>
  );
}

/**
 * Carnet partagé — notes que le pilote a explicitement partagées (lecture seule).
 * Le coach observe, il ne répond pas (la note du pilote est SON espace). Doctrine :
 * aucune interprétation, aucun jugement affiché ici ; attribution factuelle.
 */
function SharedNotesSection({ notes }: { notes: PilotNote[] }) {
  return (
    <View>
      <SectionLabel>Carnet partagé</SectionLabel>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {notes.map((n) => (
          <Card key={n.id} style={{ gap: theme.spacing.xs }}>
            <Text style={s.noteQuote}>« {n.body} »</Text>
            <Text style={s.noteMeta}>{formatDateShort(n.createdAt)} · partagé par le pilote</Text>
          </Card>
        ))}
      </View>
    </View>
  );
}

// ————————————————————————————————————————————————————————————————
// Ligne de séance
// ————————————————————————————————————————————————————————————————

function SessionRow({
  session,
  pilotId,
  mode = 'browse',
  selected = false,
  onToggle,
}: {
  session: PilotSessionSummary;
  pilotId?: string;
  mode?: Mode;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const dateStr = formatDateShort(session.startedAt);
  const lapStr = session.lapCount
    ? `${session.lapCount} tour${session.lapCount > 1 ? 's' : ''}`
    : '—';
  const hasChrono = session.bestLapSeconds != null;
  const chronoStr = hasChrono ? formatChronoTenths(session.bestLapSeconds as number) : '—';

  // Libellé a11y consolidé : date, circuit, tours, zone de marge et meilleur tour.
  const zoneStr = session.marginZone ? `, ${marginLabelOf(session.marginZone)}` : '';
  const chronoA11y = hasChrono ? `, meilleur tour ${chronoStr}` : '';
  const rowA11yLabel = `${dateStr}, ${session.circuitName ?? 'circuit'}, ${lapStr}${zoneStr}${chronoA11y}`;

  const rowContent = (
    <>
      <View style={[s.zoneBar, { backgroundColor: colorForZone(session.marginZone) }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.sessionDate}>{dateStr}</Text>
        <Text style={[s.caption, { marginTop: theme.spacing.xs }]}>
          {session.circuitName ?? 'Circuit'} · {lapStr}
          {session.marginZone ? ` · ${marginLabelOf(session.marginZone)}` : ''}
        </Text>
      </View>
      {/* Meilleur tour = OR (chrono/record), la seule couleur or de l'écran. */}
      <Text style={[s.sessionChrono, !hasChrono && s.sessionChronoMuted]}>{chronoStr}</Text>
    </>
  );

  if (mode === 'compare') {
    return (
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={rowA11yLabel}
        accessibilityHint="Sélectionner pour le comparatif"
        accessibilityState={{ checked: selected }}
        onPress={onToggle}
      >
        <Card
          style={{
            borderColor: selected ? theme.palette.coachAccent : theme.palette.line,
            borderWidth: selected ? 1.5 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {rowContent}
        </Card>
      </PressableScale>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le bilan. ${rowA11yLabel}`}
        onPress={() =>
          router.push({ pathname: '/(app)/bilan', params: { sessionId: session.id } } as never)
        }
        style={{
          padding: theme.spacing.md,
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        {rowContent}
      </PressableScale>
      {/* Lecture enrichie (§10.3) : depuis la séance, le coach pose le CONTEXTE
          et ANNOTE directement — la boucle lire → annoter, sans détour. */}
      <View style={s.sessionActions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Ajouter le contexte de cette séance"
          onPress={() =>
            router.push({
              pathname: '/(coach)/contexte',
              params: { pilotId: pilotId ?? '', sessionId: session.id },
            } as never)
          }
          style={s.sessionAction}
        >
          <Text style={s.action}>Contexte</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Choisir un virage de cette séance pour l'annoter"
          // Une note est classée PAR VIRAGE en base. Ouvrir directement
          // l'éditeur depuis la liste des séances n'indiquait aucun virage :
          // la note partait alors sur le premier, sans que le coach l'ait
          // désigné. On passe donc par la vue virage de la séance, où il
          // choisit — et d'où le bouton « Annoter » transmet le bon numéro.
          onPress={() =>
            router.push({
              pathname: '/(app)/virage',
              params: { sessionId: session.id },
            } as never)
          }
          style={[s.sessionAction, s.sessionActionDivider]}
        >
          <Text style={s.action}>Annoter</Text>
        </PressableScale>
      </View>
    </Card>
  );
}

// ————————————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————————————

function colorForZone(zone: MarginZone | null): string {
  if (!zone) return theme.palette.creamMute;
  return zone === 'green'
    ? ZONE_COLORS.green
    : zone === 'yellow'
      ? ZONE_COLORS.yellow
      : ZONE_COLORS.red;
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** « Suivi depuis mai 2026 » à partir de la date d'affiliation (jamais inventée). */
function formatSince(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `Suivi depuis ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  } catch {
    return null;
  }
}

/** Sommets d'un pentagone régulier (5 axes), rayons pondérés par `values` (0–1). */
function pentaPoints(size: number, values: number[]): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  return values
    .map((v, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
      return `${(cx + Math.cos(a) * r * v).toFixed(1)},${(cy + Math.sin(a) * r * v).toFixed(1)}`;
    })
    .join(' ');
}

const s = StyleSheet.create({
  consolePad: { padding: theme.spacing.xl },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xl,
  },
  colLeft: { width: 320, gap: theme.spacing.lg },
  colRight: { flex: 1, gap: theme.spacing.xl },
  companionIdentity: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  avatar: {
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.cream,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
  },
  metaMuted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  // Badge d'accès consenti — vert (état), lecture seule.
  consentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.45)',
    backgroundColor: 'rgba(79,201,138,0.08)',
  },
  consentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.palette.green },
  consentBadgeTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.green,
  },
  // Rappel confidentialité — accent vert 2px (§5 bordure d'accent), texte sobre.
  consentInfo: {
    backgroundColor: 'rgba(79,201,138,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(79,201,138,0.22)',
    borderLeftWidth: 2,
    borderLeftColor: theme.palette.green,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  consentInfoTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.small * 1.5,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  tile: {
    flex: 1,
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tileValue: {
    fontFamily: theme.fonts.king,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  tileLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  vehicleModel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  empreinteBand: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.dataColors.regularity,
  },
  empreinteOlder: {
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.sm,
  },
  emptyMini: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Libellé d'action (interactif) — corps, pas mono ; identité coach (rouge).
  action: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.coachAccent,
  },
  zoneBar: { width: 6, height: 40, borderRadius: 3 },
  sessionDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  sessionChrono: {
    fontFamily: theme.fonts.monoSemi,
    fontSize: theme.fontSize.h3,
    color: theme.palette.gold,
  },
  sessionChronoMuted: { color: theme.palette.creamMute },
  sessionActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  sessionAction: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionActionDivider: {
    borderLeftWidth: 1,
    borderLeftColor: theme.palette.line,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  noteQuote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.small * 1.5,
  },
  noteMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  // Libellé de champ de profil — corps en capitales (le mono reste aux chiffres).
  profileLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  profileValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  profileLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  // Lien de retour (interactif) — corps, pas mono.
  back: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.creamMute,
  },
  mediaThumb: {
    width: 140,
    height: 140,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  mediaCenter: { alignItems: 'center', justifyContent: 'center' },
  mediaTileT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
});
