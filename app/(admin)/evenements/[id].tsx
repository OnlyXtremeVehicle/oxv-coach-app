/**
 * Admin — détail d'un événement (PR-21) : infos, statut, inscriptions, check-in.
 *
 * Admin-only (RLS). Bronze = rôle admin. Le check-in passe une inscription en
 * `checked_in` (statut = admin, garanti par la RLS).
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  EVENT_STATUSES,
  type AdminEvent,
  type EventPartnerRow,
  type EventRegistrationRow,
  type EventStatus,
  type PartnerOption,
  addEventPartner,
  eventTypeLabel,
  getEvent,
  listEventPartners,
  listEventRegistrations,
  listPartnersForAttach,
  removeEventPartner,
  setRegistrationStatus,
  updateEvent,
} from '@/services/eventsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

const BRONZE = '#B87333';

const REG_STATUS_LABEL: Record<string, string> = {
  registered: 'Inscrit',
  checked_in: 'Pointé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

export default function AdminEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [regs, setRegs] = useState<EventRegistrationRow[]>([]);
  const [partners, setPartners] = useState<EventPartnerRow[]>([]);
  const [available, setAvailable] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getEvent(id),
      listEventRegistrations(id),
      listEventPartners(id),
      listPartnersForAttach(),
    ]).then(([e, r, p, a]) => {
      if (!cancelled) {
        setEvent(e);
        setRegs(r);
        setPartners(p);
        setAvailable(a);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(reload);

  async function onStatus(status: EventStatus) {
    if (!id || busy || event?.status === status) return;
    setBusy(true);
    await updateEvent(id, { status });
    setBusy(false);
    reload();
  }

  async function onCheckIn(regId: string) {
    if (busy) return;
    setBusy(true);
    await setRegistrationStatus(regId, 'checked_in');
    setBusy(false);
    reload();
  }

  async function onAddPartner(partnerId: string) {
    if (!id || busy) return;
    setBusy(true);
    await addEventPartner(id, partnerId);
    setBusy(false);
    reload();
  }

  async function onRemovePartner(rowId: string) {
    if (busy) return;
    setBusy(true);
    await removeEventPartner(rowId);
    setBusy(false);
    reload();
  }

  if (loading || !event) {
    return (
      <Screen>
        <AppBar title="ÉVÉNEMENT" onBack={() => router.back()} />
        <View style={{ padding: theme.spacing.lg }}>
          <Text style={s.muted}>{loading ? 'Chargement…' : 'Événement introuvable.'}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="ÉVÉNEMENT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={[s.type, { color: BRONZE }]}>{eventTypeLabel(event.eventType)}</Text>
        <Text style={s.name} accessibilityRole="header">
          {event.name}
        </Text>
        <Text style={s.meta}>
          {formatDateShort(event.startsAt)} · {event.locationName}
        </Text>
        {event.locationAddress ? <Text style={s.metaSub}>{event.locationAddress}</Text> : null}
        <Text style={s.metaSub}>
          {event.currentPilots}/{event.maxPilots} pilotes · slug {event.slug}
        </Text>

        {event.description ? (
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Text style={s.body}>{event.description}</Text>
          </Card>
        ) : null}
        {event.internalNotes ? (
          <Card style={{ marginTop: theme.spacing.sm, borderColor: theme.palette.edge }}>
            <Text style={s.notesLabel}>NOTES INTERNES</Text>
            <Text style={s.body}>{event.internalNotes}</Text>
          </Card>
        ) : null}

        {/* Statut */}
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <SectionLabel>Statut</SectionLabel>
          <View style={s.pills}>
            {EVENT_STATUSES.map((st) => {
              const on = event.status === st.value;
              return (
                <Pressable
                  key={st.value}
                  onPress={() => onStatus(st.value)}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: busy }}
                  accessibilityLabel={st.label}
                  hitSlop={6}
                  style={[s.pill, on ? s.pillOn : null]}
                >
                  <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{st.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Inscriptions */}
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <SectionLabel>{`Inscriptions (${regs.length})`}</SectionLabel>
          {regs.length === 0 ? (
            <Text style={s.muted}>Aucune inscription pour l'instant.</Text>
          ) : (
            regs.map((r) => (
              <Card key={r.id}>
                <View style={s.regTop}>
                  <Text style={s.regName}>{r.pilotName}</Text>
                  <Text style={s.regStatus}>{REG_STATUS_LABEL[r.status] ?? r.status}</Text>
                </View>
                {r.status === 'registered' ? (
                  <Pressable
                    onPress={() => onCheckIn(r.id)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`Pointer l'arrivée de ${r.pilotName}`}
                    style={({ pressed }) => [s.checkin, pressed || busy ? { opacity: 0.7 } : null]}
                  >
                    <Text style={s.checkinTxt}>Pointer l'arrivée</Text>
                  </Pressable>
                ) : null}
              </Card>
            ))
          )}
        </View>

        {/* Partenaires présents */}
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <SectionLabel>{`Partenaires (${partners.length})`}</SectionLabel>
          {partners.map((p) => (
            <Card key={p.id}>
              <View style={s.regTop}>
                <Text style={s.regName}>{p.partnerName}</Text>
                <Pressable
                  onPress={() => onRemovePartner(p.id)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${p.partnerName}`}
                  hitSlop={6}
                >
                  <Text style={s.removeTxt}>Retirer</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(admin)/b2b-rapport',
                    params: { eventId: id, partnerId: p.partnerId },
                  } as never)
                }
                accessibilityRole="button"
                accessibilityLabel={`Rapport B2B pour ${p.partnerName}`}
                hitSlop={6}
                style={s.reportLink}
              >
                <Text style={s.reportLinkTxt}>Rapport B2B ›</Text>
              </Pressable>
            </Card>
          ))}
          {available.filter((a) => !partners.some((p) => p.partnerId === a.id)).length > 0 ? (
            <>
              <Text style={s.attachLabel}>Rattacher un partenaire</Text>
              <View style={s.pills}>
                {available
                  .filter((a) => !partners.some((p) => p.partnerId === a.id))
                  .map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => onAddPartner(a.id)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Rattacher ${a.displayName}`}
                      hitSlop={6}
                      style={s.pill}
                    >
                      <Text style={s.pillTxt}>+ {a.displayName}</Text>
                    </Pressable>
                  ))}
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  type: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h3 * 1.25,
    marginTop: theme.spacing.xs,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  metaSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.xs,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.small * 1.5,
  },
  notesLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 38,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: {
    borderColor: BRONZE,
    backgroundColor: 'rgba(184,115,51,0.12)',
  },
  pillTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTxtOn: {
    color: theme.palette.cream,
  },
  regTop: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  regName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  regStatus: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  checkin: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: BRONZE,
  },
  checkinTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  removeTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  attachLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  reportLink: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start' as const,
  },
  reportLinkTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: BRONZE,
  },
};
