/**
 * Vue Coach — gestion des disponibilités (Phase 1 marketplace, côté offre).
 *
 * Le pendant coach de la fiche pilote : ici le coach OUVRE des créneaux qui
 * deviennent réservables sur sa fiche publique (`app/(app)/coach/[id].tsx` les
 * consomme via `getCoachProfile`, filtrés sur `open`/`full`). Deux blocs :
 *   1. un formulaire sobre (circuit, début, capacité, notes) → `createAvailability`
 *      → Toast + rechargement.
 *   2. la liste de MES créneaux (tri `starts_at`), chaque statut DOUBLÉ d'un
 *      libellé humain (jamais une couleur seule — doctrine + a11y). Sur un
 *      créneau `open`, le coach peut le Fermer ou l'Annuler.
 *
 * Multi-circuit : aucun nom de circuit en dur. Le coach saisit le sien ; le
 * champ propose un placeholder générique, pas une valeur imposée.
 *
 * Doctrine : vouvoiement, aucun emoji, sobre/premium, aucun classement ni note.
 * Accent coach = `palette.coach` (neutre, ni or ni rouge décoratifs). Réutilise
 * le kit (Screen, AppBar, Card, Field, Button, EmptyState, SectionLabel).
 */

import { useCallback, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

import {
  availabilityStatusLabel,
  createAvailability,
  listMyAvailability,
  type MyAvailabilitySlot,
  updateAvailabilityStatus,
} from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/components/instruments/EmptyState';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateTime } from '@/utils/format';

function defaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function CoachDisponibilitesScreen() {
  // Formulaire de création.
  const [circuit, setCircuit] = useState('');
  const [startsAt, setStartsAt] = useState<Date>(defaultStart);
  const [capacity, setCapacity] = useState('1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Picker date/heure (même grammaire que roulages/nouveau).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  // Liste de mes créneaux.
  const [slots, setSlots] = useState<MyAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  // Identifiant du créneau en cours de mise à jour (verrouille SES boutons).
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const rows = await listMyAvailability();
    setSlots(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyAvailability()
        .then((rows) => {
          if (!cancelled) {
            setSlots(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  function openPicker() {
    setPickerMode('date');
    setPickerOpen(true);
  }

  function onPickerChange(event: { type: string }, selected?: Date) {
    // Android : annulation explicite.
    if (event.type === 'dismissed') {
      setPickerOpen(false);
      return;
    }
    if (!selected) {
      setPickerOpen(false);
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'date') {
      // Conserver la date, enchaîner sur l'heure.
      const merged = new Date(startsAt);
      merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setStartsAt(merged);
      setPickerMode('time');
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'time') {
      const merged = new Date(startsAt);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setStartsAt(merged);
      setPickerOpen(false);
      return;
    }
    // iOS : mode datetime unique.
    setStartsAt(selected);
  }

  async function onCreate() {
    const circuitName = circuit.trim();
    if (!circuitName) {
      setError('Indiquez le circuit du créneau.');
      return;
    }
    const parsedCapacity = Number(capacity.trim());
    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
      setError('La capacité doit être un nombre supérieur ou égal à 1.');
      return;
    }
    if (startsAt.getTime() <= Date.now()) {
      setError('Le début du créneau doit être à venir.');
      return;
    }

    setError(null);
    setCreating(true);
    const result = await createAvailability({
      circuitName,
      startsAt: startsAt.toISOString(),
      capacity: parsedCapacity,
      notes: notes.trim() || null,
    });
    setCreating(false);

    if (!result.ok) {
      Toast.show({ type: 'error', text1: result.error });
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Créneau ouvert.',
      text2: 'Il apparaît désormais sur votre fiche.',
    });
    // Réinitialise le formulaire (sauf la date, prête pour le créneau suivant).
    setCircuit('');
    setCapacity('1');
    setNotes('');
    await reload();
  }

  async function onUpdateStatus(id: string, status: 'closed' | 'cancelled') {
    setBusyId(id);
    const result = await updateAvailabilityStatus(id, status);
    setBusyId(null);

    if (!result.ok) {
      Toast.show({ type: 'error', text1: result.error });
      return;
    }
    Toast.show({
      type: 'success',
      text1: status === 'closed' ? 'Créneau fermé.' : 'Créneau annulé.',
    });
    await reload();
  }

  return (
    <Screen>
      <AppBar title="DISPONIBILITÉS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ACCOMPAGNEMENT</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos créneaux ouverts.
        </Text>
        <Text style={s.intro}>
          Ouvrez les créneaux que les pilotes pourront demander depuis votre fiche. La séance et son
          règlement se conviennent de gré à gré, hors application.
        </Text>

        {/* Formulaire de création. */}
        <View style={{ marginTop: theme.spacing.xxl }}>
          <SectionLabel>Ouvrir un créneau</SectionLabel>

          <View style={{ marginTop: theme.spacing.md }}>
            <Field
              label="Circuit"
              value={circuit}
              onChangeText={setCircuit}
              placeholder="Nom du circuit"
            />

            <DateField label="Début" onPress={openPicker}>
              {formatDateTime(startsAt.toISOString())}
            </DateField>

            <Field
              label="Capacité"
              value={capacity}
              onChangeText={setCapacity}
              placeholder="1"
              keyboardType="number-pad"
              helper="Nombre de pilotes que vous pouvez accueillir sur ce créneau."
            />

            <Field
              label="Notes"
              optional
              value={notes}
              onChangeText={setNotes}
              placeholder="Informations pratiques pour vos pilotes."
              multiline
              maxLength={600}
              showCounter
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Button label="Ouvrir le créneau" loading={creating} onPress={onCreate} />
          </View>
        </View>

        {/* Liste de mes créneaux. */}
        <View style={{ marginTop: theme.spacing.xxl }}>
          <SectionLabel>Mes créneaux</SectionLabel>

          <View style={{ marginTop: theme.spacing.md }}>
            {loading ? (
              <EmptyState label="Chargement" message="Vos créneaux apparaissent ici." />
            ) : slots.length === 0 ? (
              <EmptyState
                label="Aucun créneau"
                message="Aucun créneau ouvert. Ouvrez-en un ci-dessus pour le proposer sur votre fiche."
                source="coach_availability"
              />
            ) : (
              <View style={{ gap: theme.spacing.md }}>
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    busy={busyId === slot.id}
                    onClose={() => onUpdateStatus(slot.id, 'closed')}
                    onCancel={() => onUpdateStatus(slot.id, 'cancelled')}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {pickerOpen ? (
        <DateTimePicker
          value={startsAt}
          mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onPickerChange}
        />
      ) : null}
    </Screen>
  );
}

function SlotCard({
  slot,
  busy,
  onClose,
  onCancel,
}: {
  slot: MyAvailabilitySlot;
  busy: boolean;
  onClose: () => void;
  onCancel: () => void;
}) {
  const statusText = availabilityStatusLabel(slot.status);
  // Un créneau encore actif (ouvert/complet) peut être fermé ou annulé.
  const actionable = slot.status === 'open' || slot.status === 'full';
  const muted = !actionable;

  return (
    <Card style={muted ? { opacity: 0.85 } : { borderColor: theme.palette.coach }}>
      <View style={s.headRow}>
        <Text style={[s.slotDate, { flex: 1 }]} numberOfLines={1}>
          {formatDateTime(slot.startsAt)}
        </Text>
        {/* Statut toujours doublé d'un libellé (jamais couleur-seule). */}
        <Text style={s.statusLabel}>{statusText}</Text>
      </View>

      {slot.notes ? <Text style={s.notes}>{slot.notes}</Text> : null}

      <View style={s.factRow}>
        <View style={s.fact}>
          <Text style={s.factLabel}>Circuit</Text>
          <Text style={s.factValue}>{slot.circuitName}</Text>
        </View>
        <View style={s.fact}>
          <Text style={s.factLabel}>Capacité</Text>
          <Text style={s.factValue}>
            {slot.capacity} {slot.capacity > 1 ? 'pilotes' : 'pilote'}
          </Text>
        </View>
      </View>

      {actionable ? (
        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <Button label="Fermer" variant="ghost" disabled={busy} onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Annuler" loading={busy} onPress={onCancel} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Sélecteur date/heure présenté comme un champ : libellé lisible (même langage
 * que `Field`) collé à une zone pressable. Le picker n'est pas un TextInput,
 * d'où ce petit wrapper dédié plutôt que le `Field` partagé. Repris du motif de
 * `roulages/nouveau.tsx`.
 */
function DateField({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: string;
}) {
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={s.dateBox}
      >
        <Text style={s.inputText}>{children}</Text>
      </Pressable>
    </View>
  );
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
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    letterSpacing: 0.2,
    marginBottom: theme.spacing.xs,
  },
  dateBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.card2,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
  },
  inputText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginBottom: theme.spacing.lg,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  slotDate: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  // Statut = un mot, jamais en mono ; sobre, tracké, doublé du sens par le texte.
  statusLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginLeft: theme.spacing.sm,
  },
  notes: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.bodyLg * 1.55,
    marginTop: theme.spacing.md,
  },
  factRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  fact: { minWidth: 120 },
  factLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginBottom: 3,
  },
  factValue: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
};
