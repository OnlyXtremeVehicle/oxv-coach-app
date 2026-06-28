/**
 * Vue Coach — Détail d'un pilote : liste de ses sessions analysées.
 *
 * Lecture seule. Tap sur une session → ouvre l'écran bilan existant
 * (/(app)/bilan?sessionId=xxx) qui fonctionne grâce aux RLS coach SELECT
 * sur app_session_analyses et autres tables analyses.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Segmented/Button. Logique
 * inchangée (sélection comparaison FIFO, navigation bilan/contexte/priorités).
 */

import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import * as haptics from '@/lib/haptics';
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
import { formatDateLong } from '@/utils/format';

type Mode = 'browse' | 'compare';

// Couleurs de zone de marge (donnée, toujours doublée du libellé marginLabelOf).
const ZONE_COLORS = { green: '#97C459', yellow: '#EF9F27', red: theme.palette.red } as const;

export default function CoachPilotDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [pilot, setPilot] = useState<CoachPilotRow | null>(null);
  const [sessions, setSessions] = useState<PilotSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const fullName = pilot
    ? [pilot.firstName, pilot.lastName].filter(Boolean).join(' ') || 'Pilote'
    : 'Chargement…';

  return (
    <Screen>
      <AppBar title="PILOTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>PILOTE SUIVI</Text>
        <Text style={s.title} accessibilityRole="header">
          {fullName}
        </Text>

        {/* Profil du pilote (affichage croisé) — édité par le pilote, visible
            ici car affilié et consenti (coach_pilots_view). */}
        {pilot ? <PilotProfileBlock pilot={pilot} /> : null}
        {pilotMedia.length > 0 ? <PilotMediaBlock media={pilotMedia} /> : null}
        {sharedNotes.length > 0 ? <SharedNotesBlock notes={sharedNotes} /> : null}
        {sharedSnapshots.length > 0 ? <SharedSnapshotsBlock snapshots={sharedSnapshots} /> : null}

        {/* Priorisation du bilan (§10.3c-B) */}
        <View style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
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
        </View>

        {loading ? (
          <Text style={s.caption}>Chargement…</Text>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <View style={s.rowBetween}>
              <SectionLabel>
                {`${sessions.length} ${sessions.length === 1 ? 'SESSION' : 'SESSIONS'}`}
              </SectionLabel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'browse' ? 'Comparer deux sessions' : 'Annuler la comparaison'
                }
                hitSlop={theme.hitSlop}
                onPress={() => {
                  setMode(mode === 'browse' ? 'compare' : 'browse');
                  setSelectedIds([]);
                }}
              >
                <Text style={s.action}>
                  {mode === 'browse' ? 'Comparer 2 sessions' : 'Annuler'}
                </Text>
              </Pressable>
            </View>

            {mode === 'compare' ? (
              <Text style={[s.caption, { marginTop: theme.spacing.md }]}>
                Sélectionnez deux sessions à comparer ({selectedIds.length}/2).
              </Text>
            ) : null}

            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
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
            </View>

            {mode === 'compare' ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <Button
                  label="Ouvrir le comparatif"
                  disabled={!canCompare}
                  onPress={openComparison}
                />
              </View>
            ) : null}
          </>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour à mes pilotes"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={s.back}>Retour à mes pilotes</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function PilotProfileBlock({ pilot }: { pilot: CoachPilotRow }) {
  const rows: { label: string; value: string }[] = [];
  if (pilot.pilotLevel) rows.push({ label: 'Niveau', value: pilotLevelLabel(pilot.pilotLevel) });
  if (pilot.vehicle) rows.push({ label: 'Véhicule', value: pilot.vehicle });
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
    <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
      <SectionLabel>Profil pilote</SectionLabel>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 2 }}>
          <Text style={s.profileLabel}>{r.label}</Text>
          <Text style={s.profileValue}>{r.value}</Text>
        </View>
      ))}
      {links.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {links.map(([label, url]) => (
            <Pressable
              key={label}
              accessibilityRole="link"
              accessibilityLabel={label}
              onPress={() => url && Linking.openURL(url).catch(() => undefined)}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: theme.spacing.lg,
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                borderWidth: 1,
                borderColor: theme.palette.line,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={s.profileLink}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function PilotMediaBlock({ media }: { media: PilotMediaView[] }) {
  return (
    <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
      <SectionLabel>Médias</SectionLabel>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm }}
      >
        {media.map((m) =>
          m.type === 'photo' && m.signedUrl ? (
            <Pressable
              key={m.id}
              accessibilityRole="image"
              accessibilityLabel="Photo du pilote"
              onPress={() => m.signedUrl && Linking.openURL(m.signedUrl).catch(() => undefined)}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Image source={{ uri: m.signedUrl }} resizeMode="cover" style={s.mediaThumb} />
            </Pressable>
          ) : (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={m.type === 'video' ? 'Ouvrir la vidéo' : 'Photo'}
              onPress={() => m.signedUrl && Linking.openURL(m.signedUrl).catch(() => undefined)}
              style={({ pressed }) => [
                s.mediaThumb,
                s.mediaCenter,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={s.mediaTileT}>{m.type === 'video' ? 'Vidéo' : 'Photo'}</Text>
            </Pressable>
          )
        )}
      </ScrollView>
    </Card>
  );
}

/**
 * Carnet partagé — notes que le pilote a explicitement partagées (lecture seule).
 * Le coach observe, il ne répond pas (la note du pilote est SON espace). Doctrine :
 * aucune interprétation, aucun jugement affiché ici.
 */
function SharedNotesBlock({ notes }: { notes: PilotNote[] }) {
  return (
    <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
      <SectionLabel>Carnet partagé</SectionLabel>
      {notes.map((n) => (
        <View key={n.id} style={{ gap: theme.spacing.xs }}>
          <Text style={s.sharedNoteDate}>{formatDateLong(n.createdAt)}</Text>
          <Text style={s.sharedNoteBody}>{n.body}</Text>
        </View>
      ))}
    </Card>
  );
}

/**
 * Empreinte partagée — snapshots de signature que le pilote a partagés (lecture
 * seule). Des constats descriptifs consolidés, jamais un score ni une cible.
 */
function SharedSnapshotsBlock({ snapshots }: { snapshots: SignatureSnapshot[] }) {
  const traitValue = (snap: SignatureSnapshot, key: string) =>
    snap.traits.find((t) => t.key === key)?.value ?? null;
  return (
    <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
      <SectionLabel>Empreinte partagée</SectionLabel>
      {snapshots.map((snap) => {
        const braking = traitValue(snap, 'braking');
        const lateral = traitValue(snap, 'lateral');
        return (
          <View key={snap.id} style={{ gap: theme.spacing.xs }}>
            <Text style={s.sharedNoteDate}>
              {new Date(snap.computedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            <Text style={s.sharedNoteBody}>
              Tours {snap.regularityBand ?? '—'}
              {braking ? ` · freinage ${braking}` : ''}
              {lateral ? ` · engagement ${lateral}` : ''}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

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
  const dateStr = formatDateLong(session.startedAt);
  const lapStr = session.lapCount
    ? `${session.lapCount} tour${session.lapCount > 1 ? 's' : ''}`
    : '—';
  const marginStr = session.marginGlobal !== null ? `${Math.round(session.marginGlobal)} %` : '—';

  // Libellé a11y consolidé : date, circuit, tours, zone de marge et marge.
  const zoneStr = session.marginZone ? `, ${marginLabelOf(session.marginZone)}` : '';
  const marginA11y =
    session.marginGlobal !== null ? `, marge ${Math.round(session.marginGlobal)} %` : '';
  const rowA11yLabel = `${dateStr}, ${session.circuitName ?? 'circuit'}, ${lapStr}${zoneStr}${marginA11y}`;

  const rowContent = (
    <>
      <View
        style={{
          width: 6,
          height: 40,
          borderRadius: 3,
          backgroundColor: colorForZone(session.marginZone),
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={s.sessionDate}>{dateStr}</Text>
        <Text style={[s.caption, { marginTop: theme.spacing.xs }]}>
          {session.circuitName ?? 'Circuit'} · {lapStr}
          {session.marginZone ? ` · ${marginLabelOf(session.marginZone)}` : ''}
        </Text>
      </View>
      <Text style={s.sessionValue}>{marginStr}</Text>
    </>
  );

  if (mode === 'compare') {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={rowA11yLabel}
        accessibilityHint="Sélectionner pour le comparatif"
        accessibilityState={{ checked: selected }}
        onPress={onToggle}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Card
          style={{
            borderColor: selected ? theme.palette.coach : theme.palette.line,
            borderWidth: selected ? 1.5 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
          }}
        >
          {rowContent}
        </Card>
      </Pressable>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le bilan. ${rowA11yLabel}`}
        onPress={() =>
          router.push({ pathname: '/(app)/bilan', params: { sessionId: session.id } } as never)
        }
        style={({ pressed }) => ({
          padding: theme.spacing.md,
          minHeight: 44,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        })}
      >
        {rowContent}
      </Pressable>
      {/* Saisie du contexte coach (§10.3) sur cette session */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter le contexte de cette séance"
        onPress={() =>
          router.push({
            pathname: '/(coach)/contexte',
            params: { pilotId: pilotId ?? '', sessionId: session.id },
          } as never)
        }
        style={({ pressed }) => ({
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          minHeight: 44,
          justifyContent: 'center',
          borderTopWidth: 1,
          borderTopColor: theme.palette.line,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={s.action}>Contexte de séance</Text>
      </Pressable>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={[s.manifest, { textAlign: 'center' }]}>Aucune session pour ce pilote.</Text>
      <Text style={[s.caption, { textAlign: 'center', marginTop: theme.spacing.md }]}>
        Les sessions apparaissent ici dès qu&apos;elles sont analysées.
      </Text>
    </Card>
  );
}

function colorForZone(zone: MarginZone | null): string {
  if (!zone) return theme.palette.creamMute;
  return zone === 'green'
    ? ZONE_COLORS.green
    : zone === 'yellow'
      ? ZONE_COLORS.yellow
      : ZONE_COLORS.red;
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  // Libellé d'action (interactif) — corps, pas mono : le mono reste aux chiffres.
  action: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.coach,
  },
  sessionDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  sessionValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  // Carnet partagé (lecture seule coach) — date en mono (voix de l'instrument).
  sharedNoteDate: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  sharedNoteBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.small * 1.5,
  },
  // Libellé de champ de profil — corps en capitales (le mono reste aux chiffres).
  profileLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  profileValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  // Pastille de lien réseau — capitales mono, comme les eyebrows.
  profileLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
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
  mediaCenter: { alignItems: 'center' as const, justifyContent: 'center' as const },
  mediaTileT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
