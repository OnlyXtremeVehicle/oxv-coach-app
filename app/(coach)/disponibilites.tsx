/**
 * Coach — Disponibilités (handoff §12 `coach/20-disponibilites.png`).
 * Reskin refonte-v2 §12, RESPONSIVE deux formats (décision fondateur 2026-07-13).
 *
 * Le pendant coach de la fiche pilote : ici le coach OUVRE des créneaux qui
 * deviennent réservables sur sa fiche publique (`app/(app)/coach/[id].tsx` les
 * consomme via `getCoachProfile`, filtrés sur `open`/`full`). Édition réelle :
 *   - créer un créneau (circuit, début, capacité, notes) → `createAvailability`.
 *   - fermer / annuler un créneau `open`/`full` → `updateAvailabilityStatus`.
 * Chaque statut est DOUBLÉ d'un libellé humain (jamais une couleur seule —
 * doctrine + a11y).
 *
 * Deux arrangements, un seul écran :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette `coach/20`) : header
 *     (eyebrow DISPONIBILITÉS + titre + CTA rouge coach « Ouvrir un créneau »),
 *     grille semaine 7 colonnes (LUN…DIM) où chaque créneau à venir se pose dans
 *     sa colonne de jour — vert = ouvert, rouge d'identité coach = complet.
 *     Toucher un créneau ouvre son détail (gestion : fermer / annuler).
 *   - COMPAGNON (téléphone) : 1 colonne compacte — CTA, formulaire repliable,
 *     puis la liste de MES créneaux (cartes à statut).
 * Le rail (console) / les onglets (téléphone) viennent de `_layout.tsx` : cet
 * écran n'affiche que son corps, il ne touche à aucune navigation.
 *
 * Adaptations honnêtes vis-à-vis de la maquette (services & schéma inchangés) :
 *   - la maquette groupe les créneaux dans UNE semaine (LUN…DIM). Nos créneaux
 *     portent une date absolue : la grille les range par JOUR DE SEMAINE (tous
 *     les à-venir), chaque carte affichant sa date pour lever l'ambiguïté. Les
 *     créneaux passés ne sont pas des « disponibilités » → la grille ne montre
 *     que l'à-venir (même parti pris que le Calendrier). La liste téléphone,
 *     elle, conserve l'affichage de tous les créneaux (aucune régression).
 *   - la carte rouge « réservé » de la maquette nomme le pilote (« Adrien ») :
 *     `coach_availability` ne porte AUCUN nom de pilote (les réservations vivent
 *     dans `coaching_bookings`) → on n'invente rien, un créneau `full` s'affiche
 *     « Complet », sans identité (RGPD).
 *   - pas de tuile « + ajouter » par colonne : elle ne pourrait pas pré-cibler
 *     une date honnêtement. L'ouverture passe par le CTA « Ouvrir un créneau ».
 *
 * Doctrine : vouvoiement, aucun emoji, DESCRIPTIF jamais prescriptif, aucun
 * classement. Accent coach = rouge (`coachAccent`) ; vert = ouvert ; l'or reste
 * réservé au chrono (aucun chrono ici → aucun or). Multi-circuit : le coach
 * saisit le sien, aucun nom en dur.
 */

import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type AvailabilityStatus,
  availabilityStatusLabel,
  createAvailability,
  listMyAvailability,
  type MyAvailabilitySlot,
  updateAvailabilityStatus,
} from '@/services/coachMarketplaceService';
import { messageChangement, messageCreation } from '@/services/creneauMessageLogic';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateTime } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius } = theme;

// Vert « ouvert » (créneau disponible) — translucide, dérivé de palette.green.
// Source cohérente avec la grille du Calendrier (§12).
const OPEN_FILL = 'rgba(79,201,138,0.10)';
const OPEN_BORDER = 'rgba(79,201,138,0.42)';

const WEEKDAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] as const;

type Tone = 'open' | 'full' | 'muted';

function statusTone(status: AvailabilityStatus): Tone {
  if (status === 'open') return 'open';
  if (status === 'full') return 'full';
  return 'muted';
}

/** Index de jour de semaine, 0 = lundi … 6 = dimanche. */
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Heure fr courte : « 9 h », « 9 h 30 ». */
function frTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Plage « 9 h – 12 h » si la fin est connue, sinon l'heure de début seule. */
function frTimeRange(start: Date, end: Date | null): string {
  return end ? `${frTime(start)} – ${frTime(end)}` : frTime(start);
}

/** Date courte sans année : « 19 juil ». */
function frDayMonth(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Jour + date : « sam 19 juil » (la casse est gérée par le style). */
function frWeekdayDate(d: Date): string {
  const wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
  return `${wd} ${frDayMonth(d)}`;
}

function defaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function CoachDisponibilitesScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  // Formulaire de création (replié par défaut ; ouvert par le CTA).
  const [showForm, setShowForm] = useState(false);
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
  const [loadError, setLoadError] = useState(false);
  // Identifiant du créneau en cours de mise à jour (verrouille SES boutons).
  const [busyId, setBusyId] = useState<string | null>(null);
  // Créneau sélectionné dans la grille console (ouvre son détail de gestion).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await listMyAvailability();
      setSlots(rows);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setLoadError(false);
      listMyAvailability()
        .then((rows) => {
          if (!cancelled) {
            setSlots(rows);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadError(true);
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Début de la journée courante : la grille ne montre que l'à-venir (un créneau
  // passé n'est plus une disponibilité). Stable sur la durée de la vue.
  const floor = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  // Créneaux à venir, rangés par jour de semaine (LUN…DIM). Le service renvoie
  // déjà `starts_at` croissant → chaque colonne reste triée.
  const upcoming = useMemo(
    () => slots.filter((sl) => new Date(sl.startsAt).getTime() >= floor),
    [slots, floor]
  );
  const byDay = useMemo(() => {
    const cols: MyAvailabilitySlot[][] = [[], [], [], [], [], [], []];
    for (const sl of upcoming) cols[weekdayIndex(new Date(sl.startsAt))].push(sl);
    return cols;
  }, [upcoming]);
  const selected = useMemo(
    () => upcoming.find((sl) => sl.id === selectedId) ?? null,
    [upcoming, selectedId]
  );

  function openPicker() {
    setPickerMode('date');
    setPickerOpen(true);
  }

  function onPickerChange(event: { type: string }, selectedDate?: Date) {
    // Android : annulation explicite.
    if (event.type === 'dismissed') {
      setPickerOpen(false);
      return;
    }
    if (!selectedDate) {
      setPickerOpen(false);
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'date') {
      // Conserver la date, enchaîner sur l'heure.
      const merged = new Date(startsAt);
      merged.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      setStartsAt(merged);
      setPickerMode('time');
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'time') {
      const merged = new Date(startsAt);
      merged.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setStartsAt(merged);
      setPickerOpen(false);
      return;
    }
    // iOS : mode datetime unique.
    setStartsAt(selectedDate);
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

    // On annonce le statut RETENU par la base, pas celui demandé. Le déclencheur
    // `oxv_coach_availability_open_gate` rabat `open` sur `closed` : l'ancien
    // message — « Créneau ouvert. Il apparaît désormais sur votre fiche. » —
    // était faux sur ses deux phrases.
    const message = messageCreation(result.statusEffectif);
    Toast.show({
      type: message.ecart ? 'info' : 'success',
      text1: message.titre,
      text2: message.detail,
    });
    // Réinitialise le formulaire (sauf la date, prête pour le créneau suivant),
    // le replie, et recharge la grille.
    setCircuit('');
    setCapacity('1');
    setNotes('');
    setShowForm(false);
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
    const message = messageChangement(status, result.statusEffectif);
    Toast.show({
      type: message.ecart ? 'info' : 'success',
      text1: message.titre,
      text2: message.detail,
    });
    await reload();
  }

  // État data selon le jeu affiché (grille = à-venir ; liste téléphone = tout).
  const state: ScreenState = loading
    ? 'loading'
    : loadError
      ? 'error'
      : (isConsole ? upcoming.length : slots.length) === 0
        ? 'empty'
        : 'nominal';

  const form = (
    <Card>
      <SectionLabel>Nouveau créneau</SectionLabel>
      <View style={{ marginTop: spacing.md }}>
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
    </Card>
  );

  return (
    <Screen>
      {isConsole ? null : <AppBar title="DISPONIBILITÉS" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {/* En-tête */}
        {isConsole ? (
          <View style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>DISPONIBILITÉS</Text>
              <Text style={s.title} accessibilityRole="header">
                Quand vous pouvez coacher
              </Text>
            </View>
            <CoachCTA
              label={showForm ? 'Fermer' : '+ Ouvrir un créneau'}
              expanded={showForm}
              onPress={() => setShowForm((v) => !v)}
            />
          </View>
        ) : (
          <Text style={[s.title, { marginTop: spacing.sm }]} accessibilityRole="header">
            Quand vous pouvez coacher
          </Text>
        )}

        <Text style={s.intro}>
          Ouvrez les créneaux que les pilotes pourront demander depuis votre fiche. La séance et son
          règlement se conviennent de gré à gré, hors application.
        </Text>

        {/* Compagnon : CTA pleine largeur (le CTA console vit dans le header). */}
        {!isConsole ? (
          <View style={{ marginTop: spacing.lg }}>
            <CoachCTA
              label={showForm ? 'Fermer le formulaire' : '+ Ouvrir un créneau'}
              expanded={showForm}
              block
              onPress={() => setShowForm((v) => !v)}
            />
          </View>
        ) : null}

        {/* Formulaire de création (repliable). */}
        {showForm ? (
          <View style={isConsole ? s.formPanelConsole : { marginTop: spacing.lg }}>{form}</View>
        ) : null}

        {/* Corps : grille console / liste téléphone. */}
        <View style={{ marginTop: spacing.xl }}>
          <StateWrapper
            state={state}
            skeletonLines={5}
            emptyLabel="Aucun créneau"
            emptyMessage="Aucun créneau à venir. Ouvrez-en un pour le proposer sur votre fiche."
            emptySource="coach_availability"
            errorCause="Vos créneaux n'ont pas pu être chargés."
            onRetry={reload}
          >
            {isConsole ? (
              <View>
                <Text style={s.gridHint}>Touchez un créneau pour le gérer.</Text>
                <View style={s.grid}>
                  <View style={s.gridHeader}>
                    {WEEKDAYS.map((label) => (
                      <Text key={label} style={s.dayName}>
                        {label}
                      </Text>
                    ))}
                  </View>
                  <View style={s.gridBody}>
                    {WEEKDAYS.map((label, i) => (
                      <View key={label} style={s.dayCol}>
                        {byDay[i].map((sl) => (
                          <SlotChip
                            key={sl.id}
                            slot={sl}
                            selected={sl.id === selectedId}
                            onPress={() => setSelectedId((cur) => (cur === sl.id ? null : sl.id))}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>

                {selected ? (
                  <View style={s.detailWrap}>
                    <SlotCard
                      slot={selected}
                      busy={busyId === selected.id}
                      onClose={() => onUpdateStatus(selected.id, 'closed')}
                      onCancel={() => onUpdateStatus(selected.id, 'cancelled')}
                    />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
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
          </StateWrapper>
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

/**
 * Puce d'un créneau dans la grille semaine (console). Compacte : date + plage
 * horaire + statut (toujours DOUBLÉ du libellé, jamais la couleur seule).
 * Vert = ouvert · rouge d'identité coach = complet · neutre = fermé/annulé.
 */
function SlotChip({
  slot,
  selected,
  onPress,
}: {
  slot: MyAvailabilitySlot;
  selected: boolean;
  onPress: () => void;
}) {
  const tone = statusTone(slot.status);
  const start = new Date(slot.startsAt);
  const end = slot.endsAt ? new Date(slot.endsAt) : null;
  const statusText = availabilityStatusLabel(slot.status);
  const a11y = `${frDayMonth(start)}, ${frTimeRange(start, end)}, ${statusText}.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        tone === 'open' && s.chipOpen,
        tone === 'full' && s.chipFull,
        tone === 'muted' && s.chipMuted,
        selected && s.chipSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[s.chipDate, tone === 'full' && s.chipDateFull]} numberOfLines={1}>
        {frDayMonth(start)}
      </Text>
      <Text
        style={[
          s.chipTime,
          tone === 'open' && s.chipTimeOpen,
          tone === 'full' && s.chipTimeFull,
          tone === 'muted' && s.chipTimeMuted,
        ]}
        numberOfLines={2}
      >
        {frTimeRange(start, end)}
      </Text>
      <Text
        style={[
          s.chipStatus,
          tone === 'open' && s.chipStatusOpen,
          tone === 'full' && s.chipStatusFull,
          tone === 'muted' && s.chipStatusMuted,
        ]}
        numberOfLines={1}
      >
        {statusText}
      </Text>
    </Pressable>
  );
}

/**
 * Carte détaillée d'un créneau (détail console + liste téléphone). Statut doublé
 * d'un libellé humain. Un créneau encore actif (ouvert/complet) peut être fermé
 * ou annulé ; sinon, carte en lecture seule atténuée.
 */
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
  const tone = statusTone(slot.status);
  const statusText = availabilityStatusLabel(slot.status);
  const actionable = slot.status === 'open' || slot.status === 'full';
  const start = new Date(slot.startsAt);
  const end = slot.endsAt ? new Date(slot.endsAt) : null;

  return (
    <Card
      style={[
        tone === 'open' && { borderColor: OPEN_BORDER },
        tone === 'full' && { borderColor: palette.coachAccent },
        tone === 'muted' && { opacity: 0.85 },
      ]}
    >
      <View style={s.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.slotDay} numberOfLines={1}>
            {frWeekdayDate(start)}
          </Text>
          <Text style={s.slotTime}>{frTimeRange(start, end)}</Text>
        </View>
        {/* Statut toujours doublé d'un libellé (jamais couleur-seule). */}
        <Text
          style={[
            s.statusLabel,
            tone === 'open' && { color: palette.green },
            tone === 'full' && { color: palette.coachAccent },
          ]}
        >
          {statusText}
        </Text>
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
 * CTA d'action réelle (rouge coach). L'or reste au chrono ; le coach porte le
 * rouge d'identité. Ouvre / replie le formulaire de création.
 */
function CoachCTA({
  label,
  onPress,
  block,
  expanded,
}: {
  label: string;
  onPress: () => void;
  block?: boolean;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Fermer le formulaire' : 'Ouvrir un créneau'}
      accessibilityState={{ expanded: !!expanded }}
      onPress={onPress}
      style={({ pressed }) => [s.cta, block ? s.ctaBlock : null, pressed ? { opacity: 0.9 } : null]}
    >
      <Text style={s.ctaTxt}>{label}</Text>
    </Pressable>
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
    <View style={{ marginBottom: spacing.lg }}>
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

const s = StyleSheet.create({
  // — Gouttières —
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },

  // — En-tête —
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
    marginTop: spacing.sm,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.6,
    marginTop: spacing.md,
    maxWidth: 640,
  },

  // — CTA rouge coach —
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBlock: { alignSelf: 'stretch', minHeight: 48 },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },

  // — Formulaire (console : panneau contraint) —
  formPanelConsole: { marginTop: spacing.xl, maxWidth: 620, width: '100%' },

  // — Grille semaine (console) —
  gridHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: palette.faint,
    marginBottom: spacing.md,
  },
  grid: {},
  gridHeader: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
  },
  gridBody: { flexDirection: 'row', gap: 6, paddingTop: spacing.md },
  dayCol: { flex: 1, gap: spacing.sm },

  // — Puce de créneau —
  chip: {
    minHeight: 44,
    borderRadius: radius.hud,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
    justifyContent: 'center',
  },
  chipOpen: { backgroundColor: OPEN_FILL, borderColor: OPEN_BORDER },
  chipFull: { backgroundColor: palette.coachAccent, borderColor: palette.coachAccent },
  chipMuted: { backgroundColor: palette.card2, borderColor: palette.line },
  chipSelected: { borderColor: palette.cream, borderWidth: 1.5 },
  chipDate: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  chipDateFull: { color: 'rgba(245,245,247,0.72)' },
  chipTime: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: -0.3,
  },
  chipTimeOpen: { color: palette.green },
  chipTimeFull: { color: palette.cream },
  chipTimeMuted: { color: palette.creamMute },
  chipStatus: {
    fontFamily: fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipStatusOpen: { color: palette.green },
  chipStatusFull: { color: 'rgba(245,245,247,0.82)' },
  chipStatusMuted: { color: palette.faint },

  // — Détail sélectionné (console) —
  detailWrap: { marginTop: spacing.xl, maxWidth: 620, width: '100%' },

  // — Carte de créneau (détail / liste) —
  headRow: { flexDirection: 'row', alignItems: 'center' },
  slotDay: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  slotTime: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.h3,
    letterSpacing: -0.3,
    color: palette.cream,
    marginTop: 2,
  },
  statusLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginLeft: spacing.sm,
  },
  notes: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.creamSoft,
    lineHeight: fontSize.bodyLg * 1.55,
    marginTop: spacing.md,
  },
  factRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  fact: { minWidth: 120 },
  factLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    marginBottom: 3,
  },
  factValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  // — Champ date (wrapper picker) —
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    letterSpacing: 0.2,
    marginBottom: spacing.xs,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card2,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputText: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.red,
    marginBottom: spacing.lg,
  },
});
