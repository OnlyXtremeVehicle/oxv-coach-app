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

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import {
  listTodayAttendance,
  setAttendance,
  type AttendanceSession,
} from '@/services/attendanceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const BRONZE = '#B87333';

export default function AdminPresencesScreen() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listTodayAttendance()
      .then((rows) => {
        if (cancelled) return;
        setSessions(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

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
    }
    setBusyId(null);
  };

  return (
    <Screen>
      <AppBar title="PRÉSENCES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>JOUR J</Text>
        <Text style={s.title} accessibilityRole="header">
          Pointage des inscrits.
        </Text>
        <Text style={s.intro}>
          La présence alimente les indicateurs du site, la demande d’avis du lendemain et la
          livraison des médias.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : sessions.length === 0 ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Aucune session aujourd'hui"
              message="Les sessions du jour et leurs inscrits apparaîtront ici."
            />
          </View>
        ) : (
          sessions.map((session) => (
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
          ))
        )}
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
    color: BRONZE,
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
    borderColor: BRONZE,
    backgroundColor: 'rgba(184,115,51,0.12)',
  },
  toggleText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
  },
  toggleTextPresent: {
    color: BRONZE,
  },
};
