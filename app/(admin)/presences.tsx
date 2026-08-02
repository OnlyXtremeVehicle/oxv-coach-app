/**
 * Admin — Présences jour J (Lot M3).
 *
 * Pointage de présence sur les tables du SITE (`sessions` + `registrations`) :
 * `attended_at` alimente les KPI du site, la demande d'avis J+1 (cron) et la
 * livraison des médias. Complémentaire du scan QR (`scan-checkin`, tables
 * events héritées — convergence au lot M4).
 *
 * Doctrine : sobre, factuel, bronze = rôle admin. Aucun faux succès : chaque
 * pointage attend la réponse serveur avant de changer d'état.
 */

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  listTodayAttendance,
  setAttendance,
  type AttendanceSession,
} from '@/services/attendanceService';
import { validerBriefingCollectif } from '@/services/briefingService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

export default function AdminPresencesScreen() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [briefingEnCours, setBriefingEnCours] = useState(false);
  const validateurId = useAuthStore((st) => st.profile?.id ?? null);

  /**
   * TOUS LES INSCRITS DU JOUR, toutes séances confondues.
   *
   * Le briefing se tient une fois pour tout le monde : il ne se découpe pas
   * par séance.
   */
  const inscriptionsDuJour = useMemo(
    () => sessions.flatMap((se) => se.registrations.map((r) => r.id)),
    [sessions]
  );

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listTodayAttendance()
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  /**
   * LE BRIEFING EST COLLECTIF — un geste, tous les présents.
   *
   * Il n'existait aucun geste de ce genre : la table `eligibility_items` et sa
   * policy admin dormaient depuis le 03/07/2026 sans qu'un seul écran les
   * touche. Le cocher pilote par pilote décrirait vingt briefings là où il n'y
   * en a eu qu'un.
   *
   * Confirmé avant d'écrire : c'est une déclaration qui engage l'organisateur,
   * et elle porte son nom (`validated_by`).
   */
  const onBriefingCollectif = () => {
    if (briefingEnCours || inscriptionsDuJour.length === 0) return;
    Alert.alert(
      'Briefing tenu',
      `Vous déclarez avoir tenu le briefing devant les ${inscriptionsDuJour.length} inscrits du ` +
        'jour. Votre nom et l’heure seront enregistrés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déclarer',
          onPress: async () => {
            if (validateurId === null) {
              Toast.show({ type: 'error', text1: 'Compte inconnu — rien n’a été enregistré.' });
              return;
            }
            setBriefingEnCours(true);
            const res = await validerBriefingCollectif(inscriptionsDuJour, validateurId);
            setBriefingEnCours(false);
            Toast.show({
              type: res.ok ? 'success' : 'error',
              text1: res.ok
                ? 'Briefing enregistré pour tous les inscrits.'
                : (res.error ?? 'L’enregistrement a échoué.'),
            });
          },
        },
      ]
    );
  };

  const onToggle = async (registrationId: string, attended: boolean) => {
    if (busyId) return;
    setBusyId(registrationId);
    const res = await setAttendance(registrationId, attended);
    if (res.ok) {
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          registrations: s.registrations.map((r) =>
            r.id === registrationId
              ? { ...r, attendedAt: attended ? new Date().toISOString() : null }
              : r
          ),
        }))
      );
    } else {
      // Un refus était jusqu'ici avalé : la case ne bougeait pas, et rien ne
      // disait pourquoi. Le pointage est désormais borné aux inscriptions en
      // attente ou confirmées — la raison doit être lisible sur la piste.
      Toast.show({
        type: 'info',
        text1: 'Présence non enregistrée.',
        text2: res.error,
      });
    }
    setBusyId(null);
  };

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : sessions.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="PRÉSENCES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>JOUR J</Text>
        <Text style={s.title} accessibilityRole="header">
          Pointage des inscrits.
        </Text>
        <Text style={s.intro}>
          La présence alimente les indicateurs du site, la demande d’avis du lendemain et la
          livraison des médias.
        </Text>

        {/* UN SEUL GESTE POUR TOUT LE MONDE. Il n'apparaît que s'il y a des
            inscrits : proposer de déclarer un briefing devant personne n'aurait
            aucun sens. */}
        {inscriptionsDuJour.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Déclarer le briefing tenu pour les ${inscriptionsDuJour.length} inscrits du jour`}
            accessibilityState={{ busy: briefingEnCours }}
            disabled={briefingEnCours}
            onPress={onBriefingCollectif}
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [
              s.briefingBtn,
              (pressed || briefingEnCours) && { opacity: 0.7 },
            ]}
          >
            <Text style={s.briefingTxt}>
              {briefingEnCours
                ? 'Enregistrement…'
                : `Briefing tenu — ${inscriptionsDuJour.length} inscrits`}
            </Text>
          </Pressable>
        ) : null}

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucune session aujourd'hui"
          emptyMessage="Les sessions du jour et leurs inscrits apparaîtront ici."
          errorCause="La liste des présences n’a pas pu être chargée."
          onRetry={reload}
        >
          {sessions.map((session) => (
            <Card key={session.id} style={{ marginTop: theme.spacing.lg }}>
              <Text style={s.sessionTitle}>
                {session.isPrivate
                  ? (session.privateClientName ?? 'Journée privée')
                  : (session.format ?? 'Session')}
              </Text>
              <Text style={s.sessionMeta}>
                {[
                  [session.startTime?.slice(0, 5), session.endTime?.slice(0, 5)]
                    .filter(Boolean)
                    .join(' – ') || session.date,
                  session.circuitName,
                  `${session.registrations.length} inscrit${session.registrations.length > 1 ? 's' : ''}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              {session.registrations.length === 0 ? (
                <Text style={s.noReg}>Aucune inscription active.</Text>
              ) : (
                <View style={{ marginTop: theme.spacing.md }}>
                  {session.registrations.map((reg) => {
                    const present = Boolean(reg.attendedAt);
                    const busy = busyId === reg.id;
                    return (
                      <View key={reg.id} style={s.regRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.regName}>{reg.pilotName}</Text>
                          <Text style={s.regMeta}>
                            {[reg.offerType, reg.slotChoice].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => onToggle(reg.id, !present)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityState={{ selected: present, disabled: busy }}
                          accessibilityLabel={
                            present
                              ? `Retirer la présence de ${reg.pilotName}`
                              : `Pointer ${reg.pilotName} présent`
                          }
                          style={[s.toggle, present ? s.togglePresent : null]}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={theme.palette.creamMute} />
                          ) : (
                            <Text style={[s.toggleText, present ? s.toggleTextPresent : null]}>
                              {present ? 'Présent' : 'Pointer'}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          ))}
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: ADMIN,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  briefingBtn: {
    marginTop: theme.spacing.lg,
    minHeight: 48,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: ADMIN,
  },
  briefingTxt: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: ADMIN,
  },

  sessionTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  sessionMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  noReg: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  regRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  regName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  regMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: theme.palette.faint,
    marginTop: 2,
  },
  toggle: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  togglePresent: {
    borderColor: ADMIN,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  toggleText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
  },
  toggleTextPresent: {
    color: ADMIN,
  },
};
