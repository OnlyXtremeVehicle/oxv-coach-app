/**
 * Écran #18 — Comparateur. Reskin FIDÈLE à la maquette Claude Design
 * refonte-v2 §7bis #6f (screens/24-comparateur.png).
 *
 * Maquette (haut → bas) : AppBar détail « Comparateur » · 2 cartes sélecteurs
 * « SÉANCE A » (or) / « SÉANCE B » (bleu #4F9DF7) séparées par « VS » · tableau
 * factuel 4 lignes (valeur A · libellé · valeur B) : meilleur tour, régularité
 * (écart-type), tours, vitesse max · phrase de clôture vouvoyée. SANS gagnant,
 * sans vert/rouge de jugement — deux faits côte à côte.
 *
 * DROP net (hors maquette) : les 3 modes temporels (Segmented), le panneau
 * « écart de marge » (la marge vit dans le Bilan), la superposition ABTrace et
 * la couche coach CircuitTraceHero (la superposition de tracés vit dans
 * virage-comparer, §7bis #6d). Héritage gardé et retravaillé : le choix de
 * 2 séances réelles du pilote, en cartes v2 dépliables.
 *
 * Données réelles uniquement (les chiffres du PNG sont des exemples) :
 *   - séances : `telemetry_sessions` via fetchAllSessions (RLS owner) —
 *     started_at, circuit_name, best_lap_seconds, lap_count, max_speed_kmh ;
 *   - régularité : écart-type des tours réels (`laps` via fetchSessionLaps →
 *     computeRegularity, mêmes filtres outlap/inlap que l'écran Régularité).
 *   Valeur absente → « — ». Aucune table ni colonne nouvelle.
 *
 * Couleurs : OR = séance A / BLEU trajectoire = séance B — étiquetage de série,
 * convention verrouillée « A or / B bleu ; aucun gagnant » (cf. virage-comparer).
 * L'écart-type de A en violet = couleur QDI fixe de la régularité ; les valeurs
 * neutres de B atténuées, comme la maquette. Jamais un verdict.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { computeRegularity } from '@/services/regularityService';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import type { TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateShort, formatLapTime } from '@/utils/format';

/** Conversion sûre des numeric Supabase (parfois des chaînes au runtime). */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** « 4 juil. » — date courte des cartes sélecteurs (maquette, sans année). */
function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Meilleur tour affiché — chrono via util partagé (arrondi sûr), sinon « — ». */
function lapText(session: TelemetrySession | undefined): string {
  const v = num(session?.best_lap_seconds);
  return v !== null && v > 0 ? formatLapTime(v) : '—';
}

/** Écart-type affiché « ±0,42 » (fr virgule), sinon « — ». */
function stdText(sd: number | null | undefined): string {
  return sd === null || sd === undefined ? '—' : `±${sd.toFixed(2).replace('.', ',')}`;
}

/** Écart-type énoncé pour lecteur d'écran. */
function stdSpoken(sd: number | null | undefined): string {
  return sd === null || sd === undefined
    ? 'non mesurée'
    : `${sd.toFixed(2).replace('.', ',')} seconde`;
}

function countText(session: TelemetrySession | undefined): string {
  const v = num(session?.lap_count);
  return v !== null ? String(Math.round(v)) : '—';
}

function vmaxText(session: TelemetrySession | undefined): string {
  const v = num(session?.max_speed_kmh);
  return v !== null ? String(Math.round(v)) : '—';
}

export default function ComparateurScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [sessions, setSessions] = useState<TelemetrySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [idA, setIdA] = useState<string | null>(null);
  const [idB, setIdB] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<'A' | 'B' | null>(null);
  // Écart-type par séance (clé = id session). Absent de la map = pas encore
  // calculé (affiché « — ») ; null = calculé mais non mesurable (< 2 tours).
  const [stdBySession, setStdBySession] = useState<Record<string, number | null>>({});

  // Séances réelles du pilote ; défaut : A = la plus récente, B = la précédente
  // (comme la maquette : « 4 juil. » vs « 12 juin »).
  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchAllSessions(profile.id, { limit: 20 })
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows);
        if (rows.length >= 2) {
          setIdA(rows[0].id);
          setIdB(rows[1].id);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  // Écart-type réel des séances sélectionnées : tours de la table `laps`,
  // mêmes filtres outlap/inlap que regularite.tsx. Résultat mis en cache par
  // id de séance (pas de refetch quand on rebascule sur une séance déjà vue).
  useEffect(() => {
    const targets = [idA, idB].filter((id): id is string => id !== null && !(id in stdBySession));
    if (targets.length === 0) return;
    let cancelled = false;
    targets.forEach((sessionId) => {
      fetchSessionLaps(sessionId).then((laps) => {
        if (cancelled) return;
        const reg = computeRegularity(
          laps
            .filter((l) => !l.is_outlap && !l.is_inlap)
            .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
        );
        setStdBySession((prev) => ({ ...prev, [sessionId]: reg.stdDevSeconds }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [idA, idB, stdBySession]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="Comparateur" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const sessionA = sessions.find((row) => row.id === idA);
  const sessionB = sessions.find((row) => row.id === idB);
  const stdA = idA ? stdBySession[idA] : undefined;
  const stdB = idB ? stdBySession[idB] : undefined;

  return (
    <Screen>
      <AppBar title="Comparateur" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {sessions.length < 2 ? (
          <EmptyBlock count={sessions.length} />
        ) : (
          <>
            {/* Sélecteurs A / B — cartes v2, « VS » factuel entre les deux. */}
            <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.sm }}>
              <SelectorCard
                slot="A"
                color={theme.palette.gold}
                session={sessionA}
                expanded={expanded === 'A'}
                onPress={() => setExpanded(expanded === 'A' ? null : 'A')}
              />
              <Text style={s.vs}>VS</Text>
              <SelectorCard
                slot="B"
                color={theme.dataColors.trajectory}
                session={sessionB}
                expanded={expanded === 'B'}
                onPress={() => setExpanded(expanded === 'B' ? null : 'B')}
              />
            </View>

            {/* Choix de la séance pour la carte dépliée — séances réelles. */}
            {expanded ? (
              <View style={{ marginTop: theme.spacing.md }}>
                <Text
                  style={[
                    s.pickerEyebrow,
                    {
                      color: expanded === 'A' ? theme.palette.gold : theme.dataColors.trajectory,
                    },
                  ]}
                >
                  CHOISIR LA SÉANCE {expanded}
                </Text>
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  {sessions.map((row) => {
                    const otherId = expanded === 'A' ? idB : idA;
                    if (row.id === otherId) return null;
                    const active = (expanded === 'A' ? idA : idB) === row.id;
                    const best = lapText(row);
                    return (
                      <Card
                        key={row.id}
                        onPress={() => {
                          if (expanded === 'A') setIdA(row.id);
                          else setIdB(row.id);
                          setExpanded(null);
                        }}
                        accessibilityLabel={`Séance du ${formatDateShort(row.started_at)}, ${
                          row.circuit_name || 'circuit inconnu'
                        }, meilleur tour ${best === '—' ? 'non mesuré' : best}.${
                          active ? ' Sélectionnée.' : ''
                        }`}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderColor: active ? theme.palette.edge : theme.palette.line,
                          backgroundColor: active ? theme.palette.surface3 : theme.palette.card,
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                          <Text style={s.pickDate}>{formatDateShort(row.started_at)}</Text>
                          <Text style={s.pickCircuit}>{row.circuit_name || '—'}</Text>
                        </View>
                        {/* Chrono de repère — crème atténué : dans une liste de
                            choix, aucun tour n'est « le » record mis en or. */}
                        <Text style={s.pickChrono}>{best}</Text>
                      </Card>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Tableau factuel — valeur A · libellé · valeur B, hairlines. */}
            <View style={{ marginTop: theme.spacing.xl }}>
              <MetricRow
                label="meilleur tour"
                valueA={lapText(sessionA)}
                valueB={lapText(sessionB)}
                colorA={theme.palette.gold}
                colorB={theme.dataColors.trajectory}
                a11y={`Meilleur tour — séance A : ${
                  lapText(sessionA) === '—' ? 'non mesuré' : lapText(sessionA)
                } ; séance B : ${lapText(sessionB) === '—' ? 'non mesuré' : lapText(sessionB)}.`}
              />
              <MetricRow
                label="régularité"
                valueA={stdText(stdA)}
                valueB={stdText(stdB)}
                colorA={theme.dataColors.regularity}
                colorB={theme.palette.creamMute}
                a11y={`Régularité, écart-type des tours — séance A : ${stdSpoken(
                  stdA
                )} ; séance B : ${stdSpoken(stdB)}.`}
              />
              <MetricRow
                label="tours"
                valueA={countText(sessionA)}
                valueB={countText(sessionB)}
                colorA={theme.palette.cream}
                colorB={theme.palette.creamMute}
                a11y={`Tours bouclés — séance A : ${
                  countText(sessionA) === '—' ? 'non compté' : countText(sessionA)
                } ; séance B : ${countText(sessionB) === '—' ? 'non compté' : countText(sessionB)}.`}
              />
              <MetricRow
                label="vitesse max"
                valueA={vmaxText(sessionA)}
                valueB={vmaxText(sessionB)}
                colorA={theme.palette.cream}
                colorB={theme.palette.creamMute}
                last
                a11y={`Vitesse maximale — séance A : ${
                  vmaxText(sessionA) === '—'
                    ? 'non mesurée'
                    : `${vmaxText(sessionA)} kilomètres heure`
                } ; séance B : ${
                  vmaxText(sessionB) === '—'
                    ? 'non mesurée'
                    : `${vmaxText(sessionB)} kilomètres heure`
                }.`}
              />
            </View>

            <Text style={s.caption}>Vos deux séances, sans gagnant — juste ce qui a changé.</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

/**
 * Carte sélecteur d'une séance (maquette : eyebrow couleur de série, date
 * courte, circuit). Tap → déplie la liste des séances réelles. Or = série A,
 * bleu trajectoire = série B — un étiquetage, pas un verdict.
 */
function SelectorCard({
  slot,
  color,
  session,
  expanded,
  onPress,
}: {
  slot: 'A' | 'B';
  color: string;
  session: TelemetrySession | undefined;
  expanded: boolean;
  onPress: () => void;
}) {
  const date = session ? formatDayMonth(session.started_at) : '—';
  const circuit = session?.circuit_name || '—';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`Séance ${slot} : ${date}, ${circuit}`}
      accessibilityHint={`Ouvre le choix de la séance ${slot}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.selector,
        { borderColor: expanded ? theme.palette.edge : theme.palette.line },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[s.selectorEyebrow, { color }]}>SÉANCE {slot}</Text>
      <Text style={s.selectorDate}>{date}</Text>
      <Text numberOfLines={1} style={s.selectorCircuit}>
        {circuit}
      </Text>
    </Pressable>
  );
}

/** Ligne du tableau — valeur A à gauche, libellé centré, valeur B à droite. */
function MetricRow({
  label,
  valueA,
  valueB,
  colorA,
  colorB,
  last,
  a11y,
}: {
  label: string;
  valueA: string;
  valueB: string;
  colorA: string;
  colorB: string;
  last?: boolean;
  a11y: string;
}) {
  return (
    <View accessible accessibilityLabel={a11y} style={[s.row, !last && s.rowBorder]}>
      <Text style={[s.rowValue, { color: colorA, textAlign: 'left' }]}>{valueA}</Text>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, { color: colorB, textAlign: 'right' }]}>{valueB}</Text>
    </View>
  );
}

function EmptyBlock({ count }: { count: number }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Comparer demande deux séances au moins.</Text>
      <Text style={s.emptyHint}>
        {count === 0
          ? 'Aucune séance enregistrée pour l’instant.'
          : 'Une seule séance enregistrée pour l’instant.'}
      </Text>
    </Card>
  );
}

const s = {
  selector: {
    flex: 1,
    minHeight: 44,
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  selectorEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  selectorDate: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    marginTop: theme.spacing.xs,
  },
  selectorCircuit: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  vs: {
    alignSelf: 'center' as const,
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: theme.palette.eyebrow,
  },
  pickerEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  pickDate: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  pickCircuit: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  pickChrono: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 44,
    paddingVertical: theme.spacing.lg,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.separator,
  },
  rowValue: {
    flex: 1,
    fontFamily: theme.fonts.monoSemi,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  rowLabel: {
    flex: 1,
    textAlign: 'center' as const,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    color: theme.palette.eyebrow,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.6,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
  },
};
