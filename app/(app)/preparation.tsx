/**
 * Journée circuit (PR-26, zone Session) — reskin FIDÈLE à la maquette Claude
 * Design refonte-v2 §7.13 (screens/13-journee-circuit.png), règle fondateur
 * 2026-07-12 : le graphique v2 fait loi, l'héritage utile est retravaillé.
 *
 * Le jour J : eyebrow « AUJOURD'HUI » (ou « PROCHAINE JOURNÉE », honnête) +
 * puce météo compacte (météo RÉELLE du circuit) · FAIT dominant = la date
 * réelle de la journée (nextTrackDayService) + lieu/heure réels · carte
 * « VOTRE PRÉPARATION » (compteur vert, items cochés barrés — rituel éphémère
 * préservé, non persisté) · tuiles créneau/format (registrations.slot_choice,
 * sessions.format — masquées si absentes ; le « placement paddock » de la
 * maquette n'existe pas en base) · carte Pass OXV claire avec le QR RÉEL du
 * flux pass-oxv (event_registrations). Sous le héros : conditions détaillées,
 * briefing (autorité humaine), intention (IntentionCard), équipement.
 *
 * Doctrine : aucune consigne de pilotage, vouvoiement, pas d'emoji, chaque
 * valeur rendue trace vers une source réelle — donnée absente = bloc masqué.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import QRCode from 'react-native-qrcode-svg';

import { IntentionCard } from '@/components/IntentionCard';
import { supabase } from '@/lib/supabase';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { type MyRegistration, listMyRegistrations } from '@/services/eventsService';
import { type NextTrackDay, getMyNextTrackDay } from '@/services/nextTrackDayService';
import {
  type WeatherData,
  fetchCurrentWeather,
  trackConditions,
  windDirectionCardinal,
} from '@/services/weatherService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const { palette, fonts, spacing, radius } = theme;

const INTRO =
  'Le temps de rassembler vos affaires et votre attention. Rien d’autre. La piste vous attend.';

/** Items de pré-vol au repos (noms, pas d'ordres). Rituel éphémère, non persisté. */
const CHECKLIST = [
  'Boîtier OXV chargé',
  'Casque et gants',
  'Licence et papiers du véhicule',
  'Niveaux et pression des pneus',
] as const;

/** « Samedi 19 juillet » — date de la journée, en toutes lettres. */
function longDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** « 09:30:00 » (time Postgres) → « 9 h 30 ». Null si illisible. */
function formatStartTime(t: string | null): string | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return `${parseInt(m[1], 10)} h ${m[2]}`;
}

/** Date LOCALE du jour (pas UTC) — même convention que nextTrackDayService. */
function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Condition compacte de la puce météo — dérivée de trackConditions (réel). */
const CHIP_CONDITION: Record<string, string> = {
  'Piste mouillée': 'mouillée',
  'Pluie probable': 'pluie probable',
  'Piste humide': 'humide',
  'Conditions ventées': 'venté',
  'Conditions sèches': 'sec',
};

interface DayLogistics {
  slotChoice: string | null;
  format: string | null;
}

/**
 * Logistique de MA journée (tuiles) : créneau choisi à l'inscription
 * (registrations.slot_choice, RLS own-row) + format de la journée
 * (sessions.format, renseigné par OXV sur le site). Null = tuiles masquées.
 */
async function loadDayLogistics(userId: string, dateIso: string): Promise<DayLogistics | null> {
  const { data: regs } = await supabase
    .from('registrations')
    .select('session_id, slot_choice, status')
    .eq('user_id', userId)
    .or('status.is.null,status.neq.cancelled')
    .order('created_at', { ascending: false })
    .limit(100);
  const sessionIds = [...new Set((regs ?? []).map((r) => r.session_id).filter(Boolean))];
  if (sessionIds.length === 0) return null;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, format, status')
    .in('id', sessionIds)
    .eq('date', dateIso)
    .limit(5);
  const day = (sessions ?? []).find((s) => s.status !== 'cancelled' && s.status !== 'archived');
  if (!day) return null;

  const reg = (regs ?? []).find((r) => r.session_id === day.id);
  return { slotChoice: reg?.slot_choice ?? null, format: day.format ?? null };
}

/**
 * Le pass à présenter : inscription événement active (flux pass-oxv,
 * event_registrations) dont la journée n'est pas terminée. QR réel
 * `oxv:checkin:<registrationId>` — jamais de QR inventé.
 */
function pickActivePass(regs: MyRegistration[]): MyRegistration | null {
  const now = Date.now();
  const eligible = regs.filter(
    (r) =>
      r.event !== null &&
      (r.status === 'registered' || r.status === 'checked_in') &&
      new Date(r.event.endsAt).getTime() >= now
  );
  eligible.sort(
    (a, b) => new Date(a.event!.startsAt).getTime() - new Date(b.event!.startsAt).getTime()
  );
  return eligible[0] ?? null;
}

export default function PreparationScreen() {
  const profile = useAuthStore((st) => st.profile);

  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  const [nextDay, setNextDay] = useState<NextTrackDay | null>(null);
  const [dayLoading, setDayLoading] = useState(true);
  const [logistics, setLogistics] = useState<DayLogistics | null>(null);
  const [pass, setPass] = useState<MyRegistration | null>(null);
  const [passLoading, setPassLoading] = useState(true);

  // Météo du circuit — logique préservée (getDefaultCircuit + Open-Meteo).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getDefaultCircuit();
      if (cancelled) return;
      setCircuit(c);
      if (c && Number.isFinite(c.finishLineLat) && Number.isFinite(c.finishLineLon)) {
        const w = await fetchCurrentWeather(c.finishLineLat, c.finishLineLon);
        if (!cancelled) setWeather(w);
      }
      if (!cancelled) setLoadingWeather(false);
    })().catch(() => {
      if (!cancelled) setLoadingWeather(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Journée réelle (héros) + logistique (tuiles) + pass (QR) — best-effort.
  useEffect(() => {
    if (!profile) {
      setDayLoading(false);
      setPassLoading(false);
      return;
    }
    let cancelled = false;

    getMyNextTrackDay(profile.id)
      .then(async (d) => {
        if (cancelled) return;
        setNextDay(d);
        setDayLoading(false);
        if (d) {
          const log = await loadDayLogistics(profile.id, d.date);
          if (!cancelled) setLogistics(log);
        }
      })
      .catch(() => {
        if (!cancelled) setDayLoading(false);
      });

    listMyRegistrations()
      .then((regs) => {
        if (cancelled) return;
        setPass(pickActivePass(regs));
        setPassLoading(false);
      })
      .catch(() => {
        if (!cancelled) setPassLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const toggle = useCallback((i: number) => {
    setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)));
  }, []);

  const conditions = weather ? trackConditions(weather) : null;
  const doneCount = checked.filter(Boolean).length;

  const isToday = nextDay?.date === todayLocalIso();
  const startLabel = formatStartTime(nextDay?.startTime ?? null);
  const heroSub = nextDay
    ? [nextDay.circuitName, startLabel ? `début à ${startLabel}` : null].filter(Boolean).join(' · ')
    : '';

  return (
    <Screen>
      <AppBar title="Journée circuit" onBack={() => router.back()} />
      <View style={s.body}>
        {/* Héros — eyebrow + puce météo compacte (réelle, masquée sinon). */}
        <View style={s.eyebrowRow}>
          <Text style={s.eyebrow}>
            {dayLoading
              ? 'PRÉPARATION'
              : nextDay
                ? isToday
                  ? 'AUJOURD’HUI'
                  : 'PROCHAINE JOURNÉE'
                : 'PRÉPARATION'}
          </Text>
          {weather && conditions ? (
            <View
              style={s.weatherChip}
              accessible
              accessibilityLabel={
                weather.temperatureC != null
                  ? `Météo du circuit : ${Math.round(weather.temperatureC)} degrés, ${conditions.label.toLowerCase()}`
                  : `Météo du circuit : ${conditions.label.toLowerCase()}`
              }
            >
              <Text style={s.weatherChipText}>
                {weather.temperatureC != null ? `${Math.round(weather.temperatureC)} °C · ` : ''}
                {CHIP_CONDITION[conditions.label] ?? conditions.label.toLowerCase()}
              </Text>
            </View>
          ) : null}
        </View>

        {dayLoading ? (
          <View
            style={s.heroSkeleton}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Chargement de votre journée"
          >
            <View style={s.skelLineWide} />
            <View style={[s.skelLine, { marginTop: spacing.sm }]} />
          </View>
        ) : nextDay ? (
          <>
            <Text style={s.heroDate} accessibilityRole="header">
              {longDay(nextDay.date)}
            </Text>
            {heroSub ? <Text style={s.heroSub}>{heroSub}</Text> : null}
          </>
        ) : (
          <>
            <Text style={s.heroDate} accessibilityRole="header">
              Un dernier regard.
            </Text>
            <Text style={s.heroSub}>{INTRO}</Text>
          </>
        )}

        {/* VOTRE PRÉPARATION — compteur vert + items cochés barrés (maquette).
            Rituel éphémère préservé : état local, non persisté. */}
        <View style={[s.prepCard, { marginTop: spacing.xl }]}>
          <View style={s.prepHead}>
            <Text style={s.cardEyebrow}>VOTRE PRÉPARATION</Text>
            <Text style={s.prepCount}>
              {doneCount}/{CHECKLIST.length}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            {CHECKLIST.map((item, i) => {
              const on = checked[i];
              return (
                <Pressable
                  key={item}
                  onPress={() => toggle(i)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={item}
                  hitSlop={6}
                  style={({ pressed }) => [s.checkRow, pressed && { opacity: 0.8 }]}
                >
                  <View style={[s.box, on ? s.boxOn : null]}>
                    {on ? <Text style={s.tick}>✓</Text> : null}
                  </View>
                  <Text style={[s.checkText, on ? s.checkTextOn : null]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Tuiles créneau / format — données réelles du site, masquées sinon.
            Le « placement paddock » de la maquette n'existe pas en base. */}
        {logistics && (logistics.slotChoice || logistics.format) ? (
          <View style={s.tilesRow}>
            {logistics.slotChoice ? (
              <View style={s.tile}>
                <Text style={s.cardEyebrow}>VOTRE CRÉNEAU</Text>
                <Text style={s.tileValue}>{logistics.slotChoice}</Text>
              </View>
            ) : null}
            {logistics.format ? (
              <View style={s.tile}>
                <Text style={s.cardEyebrow}>FORMAT</Text>
                <Text style={s.tileValue}>{logistics.format}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Pass OXV — carte claire + QR réel (flux pass-oxv). Fond clair par
            nécessité de lecture optique. Sans inscription : porte vers le flux. */}
        {pass && pass.event ? (
          <Pressable
            onPress={() => router.push('/(app)/pass-oxv' as never)}
            accessibilityRole="button"
            accessibilityLabel="Pass OXV. Montrez ce code à l'entrée pour votre check-in. Ouvrir vos passes."
            style={({ pressed }) => [s.passCard, pressed && { opacity: 0.92 }]}
          >
            <View style={s.passQr}>
              <QRCode
                value={`oxv:checkin:${pass.registrationId}`}
                size={64}
                color={palette.night}
                backgroundColor={palette.cream}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.passTitle}>Pass OXV</Text>
              <Text style={s.passHint}>Montrez ce code à l’entrée pour votre check-in.</Text>
            </View>
          </Pressable>
        ) : !passLoading ? (
          <Card
            onPress={() => router.push('/(app)/pass-oxv' as never)}
            accessibilityLabel="Pass OXV. Vos inscriptions et votre code de présence."
            style={{ marginTop: spacing.md }}
          >
            <Text style={s.linkTitle}>Pass OXV</Text>
            <Text style={s.linkHint}>Vos inscriptions et votre code de présence.</Text>
          </Card>
        ) : null}

        {/* Conditions — météo détaillée du circuit, factuelle. Aucune consigne. */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CONDITIONS</Text>
          <Card style={{ marginTop: spacing.sm }}>
            {loadingWeather ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator
                  color={palette.creamMute}
                  accessibilityLabel="Chargement des conditions"
                />
              </View>
            ) : weather && conditions ? (
              <>
                <View style={s.rowBetween}>
                  <Text style={s.condLabel}>{conditions.label}</Text>
                  <Text style={s.temp}>
                    {weather.temperatureC != null ? `${Math.round(weather.temperatureC)}°` : '—'}
                  </Text>
                </View>
                <Text style={s.circuitName}>
                  {circuit?.name ?? 'Circuit'} · ressenti{' '}
                  {weather.feelsLikeC != null ? `${Math.round(weather.feelsLikeC)}°` : '—'}
                </Text>
                <View style={s.factsRow}>
                  <Fact
                    label="Vent"
                    value={
                      weather.windSpeedKmh != null
                        ? `${Math.round(weather.windSpeedKmh)} km/h`
                        : '—'
                    }
                  />
                  <Fact
                    label="Direction"
                    value={
                      weather.windDirectionDeg != null
                        ? windDirectionCardinal(weather.windDirectionDeg)
                        : '—'
                    }
                  />
                  <Fact
                    label="Pluie"
                    value={
                      weather.precipitationProbabilityPct != null
                        ? `${Math.round(weather.precipitationProbabilityPct)} %`
                        : '—'
                    }
                  />
                </View>
              </>
            ) : (
              <Text style={s.muted}>
                Conditions indisponibles pour le moment. Fiez-vous à ce que vous voyez sur place.
              </Text>
            )}
          </Card>
        </View>

        {/* Briefing — autorité humaine sur place. Non navigable : un rappel. */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>BRIEFING</Text>
          <Card style={{ marginTop: spacing.sm }}>
            <Text style={s.muted}>
              Le briefing de sécurité est délivré sur place par l’équipe OXV avant chaque session.
              Il prime sur tout ce que vous lirez ici.
            </Text>
          </Card>
        </View>

        {/* Intention — question ouverte, saisie libre. La réponse appartient au
            pilote ; l'app ne suggère rien. */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>INTENTION</Text>
          <IntentionCard circuitId={circuit?.id ?? null} />
          <Card
            onPress={() => router.push('/(app)/objectifs' as never)}
            accessibilityLabel="Vos objectifs. Ce que vous avez choisi de suivre."
            style={{ marginTop: spacing.sm }}
          >
            <Text style={s.linkTitle}>Vos objectifs</Text>
            <Text style={s.linkHint}>Ce que vous avez choisi de suivre, à votre rythme.</Text>
          </Card>
        </View>

        {/* Suite du flux — connecter l'équipement. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Connecter l'équipement"
          onPress={() => router.push('/(app)/equipement' as never)}
          style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={s.primaryBtnText}>Connecter l’équipement</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.factValue}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Héros — eyebrow mono + puce météo fine à droite (maquette §7.13).
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  weatherChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.creamSoft,
  },
  heroDate: {
    fontFamily: fonts.displayBold,
    fontSize: theme.fontSize.display,
    letterSpacing: -0.4,
    color: palette.cream,
    lineHeight: theme.fontSize.display * 1.2,
    marginTop: spacing.md,
  },
  heroSub: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: spacing.xs,
  },
  heroSkeleton: { marginTop: spacing.md },
  skelLineWide: { height: 26, width: '65%', borderRadius: 6, backgroundColor: palette.line },
  skelLine: { height: 12, width: '40%', borderRadius: 6, backgroundColor: palette.line },

  // Carte préparation — compteur vert, items cochés barrés (maquette).
  prepCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  prepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  prepCount: {
    fontFamily: fonts.monoSemi,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.green,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.hud,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card2,
  },
  boxOn: { borderColor: palette.green, backgroundColor: palette.green },
  tick: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.night,
  },
  checkText: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.body,
    color: palette.creamSoft,
    flex: 1,
  },
  checkTextOn: { color: palette.creamMute, textDecorationLine: 'line-through' },

  // Tuiles côte à côte — créneau / format (réels, sinon masquées).
  tilesRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tileValue: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
    marginTop: spacing.sm,
  },

  // Pass OXV — carte CLAIRE #F5F5F7 (lecture optique du QR), texte sombre.
  passCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: palette.cream,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    minHeight: 44,
  },
  passQr: { width: 64, height: 64 },
  passTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: theme.fontSize.bodyLg,
    color: palette.night,
  },
  passHint: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.faint,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: 3,
  },

  // Sections préservées sous le héros (conditions, briefing, intention).
  section: { marginTop: spacing.xl },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  condLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
    flex: 1,
  },
  temp: {
    fontFamily: fonts.king,
    fontSize: theme.fontSize.h2,
    letterSpacing: -0.5,
    color: palette.cream,
  },
  circuitName: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  factsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
    paddingTop: spacing.md,
  },
  factValue: {
    fontFamily: fonts.monoMedium,
    fontSize: theme.fontSize.body,
    color: palette.cream,
  },
  factLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.eyebrow,
    marginTop: 2,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
  linkTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  linkHint: {
    fontFamily: fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },

  // Action de flux — bouton plein crème (langage v2, cf. Paddock).
  primaryBtn: {
    backgroundColor: palette.cream,
    borderRadius: 27,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  primaryBtnText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: palette.night },
});
