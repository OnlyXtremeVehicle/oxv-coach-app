/**
 * Pass OXV — la journée d'événement côté pilote (PR-27 + QR).
 *
 * Affiche les inscriptions du pilote (ses « passes ») avec le contexte logistique
 * (lieu, horaires, briefing, statut) et un QR de présence, plus les événements
 * ouverts à l'inscription. Le SCAN admin (expo-camera) reste à brancher — le
 * check-in admin manuel fonctionne déjà. Annulation : via le support.
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, or = donnée (statuts neutres). Le
 * QR est sur fond clair par nécessité de lecture optique (code, pas décor).
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import QRCode from 'react-native-qrcode-svg';

import { EmptyState } from '@/components/instruments';
import {
  type MyRegistration,
  type PassEvent,
  type RegistrationStatus,
  eventTypeLabel,
  listMyRegistrations,
  listOpenEvents,
  registerForEvent,
} from '@/services/eventsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  registered: 'Inscrit',
  checked_in: 'Présent',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PassOxvScreen() {
  const [regs, setRegs] = useState<MyRegistration[]>([]);
  const [open, setOpen] = useState<PassEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listMyRegistrations(), listOpenEvents()]).then(([r, o]) => {
      if (!cancelled) {
        setRegs(r);
        setOpen(o);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  const registeredEventIds = new Set(regs.map((r) => r.event?.id).filter(Boolean));
  const openToRegister = open.filter((e) => !registeredEventIds.has(e.id));

  async function onRegister(eventId: string) {
    if (busy) return;
    setBusy(eventId);
    await registerForEvent(eventId);
    setBusy(null);
    reload();
  }

  return (
    <Screen>
      <AppBar title="PASS OXV" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE JOURNÉE</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos passes.
        </Text>

        {/* Mes inscriptions */}
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          {!loading && regs.length === 0 ? (
            <EmptyState
              label="Aucune inscription"
              message="Vous n'êtes inscrit à aucun événement pour l'instant."
              source="event_registrations"
            />
          ) : (
            regs.map((r) =>
              r.event ? (
                <Card key={r.registrationId} style={s.pass}>
                  <View style={s.passTop}>
                    <Text style={s.type}>{eventTypeLabel(r.event.eventType)}</Text>
                    <Text style={s.status}>{STATUS_LABEL[r.status]}</Text>
                  </View>
                  <Text style={s.name}>{r.event.name}</Text>
                  <Text style={s.when}>{formatWhen(r.event.startsAt)}</Text>
                  <Text style={s.loc}>
                    {r.event.locationName}
                    {r.event.locationAddress ? ` · ${r.event.locationAddress}` : ''}
                  </Text>
                  {r.event.briefingAt ? (
                    <Text style={s.briefing}>Briefing : {formatWhen(r.event.briefingAt)}</Text>
                  ) : null}
                  {r.event.description ? <Text style={s.desc}>{r.event.description}</Text> : null}
                  {r.status === 'registered' || r.status === 'checked_in' ? (
                    <View style={s.qrWrap}>
                      <QRCode value={`oxv:checkin:${r.registrationId}`} size={132} />
                      <Text style={s.qrHint}>
                        Votre code de présence — à présenter à l&apos;accueil.
                      </Text>
                    </View>
                  ) : null}
                </Card>
              ) : null
            )
          )}
        </View>

        {/* Événements ouverts */}
        {openToRegister.length > 0 ? (
          <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
            <Text style={s.sectionEyebrow}>ÉVÉNEMENTS OUVERTS</Text>
            {openToRegister.map((e) => (
              <Card key={e.id}>
                <Text style={s.type}>{eventTypeLabel(e.eventType)}</Text>
                <Text style={s.name}>{e.name}</Text>
                <Text style={s.when}>{formatWhen(e.startsAt)}</Text>
                <Text style={s.loc}>{e.locationName}</Text>
                <View style={{ marginTop: theme.spacing.md }}>
                  <Button
                    label="S'inscrire"
                    variant="ghost"
                    loading={busy === e.id}
                    onPress={() => onRegister(e.id)}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        <Text style={s.footnote}>
          Pour annuler une inscription, écrivez-nous depuis le support.
        </Text>
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
    color: theme.palette.faint,
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
  sectionEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  pass: {
    borderColor: theme.palette.edge,
  },
  passTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  type: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  when: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xs,
  },
  loc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  briefing: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  desc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  qrWrap: {
    marginTop: theme.spacing.md,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  qrHint: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#0B0B0D',
    marginTop: theme.spacing.sm,
    textAlign: 'center' as const,
    maxWidth: 160,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.xxl,
  },
};
