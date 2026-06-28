/**
 * Admin — Créer un événement (PR-21).
 *
 * Formulaire en sections (infos, lieu, dates/capacité, description). La
 * tarification est gérée côté site ; ici on pose l'essentiel app. Admin-only.
 * Dates au format ISO court (AAAA-MM-JJTHH:MM) — outil admin, pas pilote.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  EVENT_STATUSES,
  EVENT_TYPES,
  type EventStatus,
  type EventType,
  createEvent,
} from '@/services/eventsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const BRONZE = '#B87333';

function toIso(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AdminCreateEventScreen() {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<EventType>('balade_decouverte');
  const [status, setStatus] = useState<EventStatus>('draft');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [briefingAt, setBriefingAt] = useState('');
  const [maxPilots, setMaxPilots] = useState('20');
  const [description, setDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (saving) return;
    setError(null);
    const starts = toIso(startsAt);
    const ends = toIso(endsAt);
    if (!name.trim() || !locationName.trim()) {
      setError('Le nom et le lieu sont requis.');
      return;
    }
    if (!starts || !ends) {
      setError('Dates invalides. Format attendu : AAAA-MM-JJTHH:MM.');
      return;
    }
    const max = parseInt(maxPilots, 10);
    setSaving(true);
    const res = await createEvent({
      name,
      eventType,
      status,
      locationName,
      locationAddress: locationAddress || undefined,
      startsAt: starts,
      endsAt: ends,
      briefingAt: toIso(briefingAt),
      maxPilots: Number.isFinite(max) && max > 0 ? max : 20,
      description: description || undefined,
      internalNotes: internalNotes || undefined,
    });
    setSaving(false);
    if (res.ok && res.id) {
      router.replace(`/(admin)/evenements/${res.id}` as never);
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  return (
    <Screen>
      <AppBar title="NOUVEL ÉVÉNEMENT" onBack={() => router.back()} />
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel>Informations</SectionLabel>
          <Field label="Nom" value={name} onChangeText={setName} maxLength={100} />
          <PillGroup
            label="Type"
            options={EVENT_TYPES}
            value={eventType}
            onChange={(v) => setEventType(v as EventType)}
          />
          <PillGroup
            label="Statut"
            options={EVENT_STATUSES}
            value={status}
            onChange={(v) => setStatus(v as EventStatus)}
          />
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel>Lieu</SectionLabel>
          <Field label="Nom du lieu" value={locationName} onChangeText={setLocationName} />
          <Field
            label="Adresse"
            optional
            value={locationAddress}
            onChangeText={setLocationAddress}
            multiline
          />
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel>Dates & capacité</SectionLabel>
          <Field
            label="Début (AAAA-MM-JJTHH:MM)"
            value={startsAt}
            onChangeText={setStartsAt}
            placeholder="2026-07-05T09:00"
            autoCapitalize="none"
          />
          <Field
            label="Fin (AAAA-MM-JJTHH:MM)"
            value={endsAt}
            onChangeText={setEndsAt}
            placeholder="2026-07-05T15:00"
            autoCapitalize="none"
          />
          <Field
            label="Briefing"
            optional
            value={briefingAt}
            onChangeText={setBriefingAt}
            placeholder="2026-07-05T09:30"
            autoCapitalize="none"
          />
          <Field
            label="Pilotes max"
            value={maxPilots}
            onChangeText={setMaxPilots}
            keyboardType="number-pad"
          />
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          <SectionLabel>Description</SectionLabel>
          <Field
            label="Description (pilote)"
            optional
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />
          <Field
            label="Notes internes (admin)"
            optional
            value={internalNotes}
            onChangeText={setInternalNotes}
            multiline
            maxLength={2000}
          />
        </Card>

        {error ? (
          <Text style={s.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Button
          label="Créer l'événement"
          onPress={onSubmit}
          loading={saving}
          disabled={!name.trim() || !locationName.trim()}
        />
      </View>
    </Screen>
  );
}

function PillGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={s.pillLabel}>{label}</Text>
      <View style={s.pills}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              hitSlop={6}
              style={[s.pill, on ? s.pillOn : null]}
            >
              <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = {
  pillLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
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
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.red,
  },
};
