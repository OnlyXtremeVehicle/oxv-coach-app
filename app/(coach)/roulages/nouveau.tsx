/**
 * Coach — Nouveau roulage (§8 OXV Mirror ; langage §12 handoff).
 *
 * Formulaire de création d'un roulage : titre, date/heure, lieu, places, prix,
 * notes. Validation via la logique pure `validateRoulageInput` ; à
 * l'enregistrement (`createRoulage`), retour à la liste où le roulage apparaît,
 * prêt à recevoir des invitations. Aucune maquette dédiée : on applique le
 * langage v2 de ses écrans frères (facture-nouvelle, roulages/index) — cohérence,
 * pas fidélité pixel.
 *
 * RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13) : un seul écran, deux
 * arrangements selon la largeur.
 *   - CONSOLE tablette (≥ COACH_CONSOLE_MIN_WIDTH) : en-tête (eyebrow ROULAGES +
 *     titre + insigne coach) puis deux colonnes — le formulaire à gauche, un
 *     aperçu du roulage (données réellement saisies) + l'action à droite. Le rail
 *     vertical est fourni par `_layout.tsx` (pas d'AppBar).
 *   - COMPAGNON téléphone (< seuil) : AppBar de retour + une colonne empilée
 *     (formulaire, aperçu, action).
 *
 * DONNÉES RÉELLES uniquement : chaque valeur de l'aperçu trace vers l'état de
 * saisie, lui-même écrit dans `coach_roulages` (zéro schéma nouveau). Un champ
 * non renseigné est masqué — jamais inventé. L'or reste réservé au chrono (aucun
 * chrono ici → aucun or) ; l'identité coach porte le ROUGE `#E23A4E` (CTA
 * d'enregistrement) — l'argent n'est jamais en or.
 *
 * Doctrine : vouvoiement, zéro emoji, libellés factuels, jamais prescriptifs.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { validateRoulageInput } from '@/services/roulagesLogic';
import { createRoulage } from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { CockpitPanel } from '@/ui/CockpitPanel';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { formatDateTime, formatPriceCents } from '@/utils/format';

const { palette, spacing, fonts, fontSize, radius } = theme;

function defaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function NouveauRoulageScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<Date>(defaultStart);
  const [location, setLocation] = useState('');
  const [maxPilots, setMaxPilots] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function onSubmit() {
    const parsedMax = maxPilots.trim() === '' ? null : Number(maxPilots.trim());
    // Prix saisi en euros (virgule ou point) → centimes entiers.
    const priceTrimmed = price.trim().replace(',', '.');
    const parsedPrice = priceTrimmed === '' ? null : Math.round(Number(priceTrimmed) * 100);
    const input = {
      title,
      startsAt: startsAt.toISOString(),
      location: location.trim() || null,
      maxPilots: parsedMax,
      pricePerPilot: Number.isNaN(parsedPrice as number) ? null : parsedPrice,
      notes: notes.trim() || null,
    };

    const validationError = validateRoulageInput(input, new Date().toISOString());
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    const created = await createRoulage(input);
    setSaving(false);

    if (!created) {
      setError("L'enregistrement a échoué. Réessayez dans un instant.");
      return;
    }
    router.replace('/(coach)/roulages' as never);
  }

  // ── Aperçu (colonne droite console / bas de pile compagnon) ────────────────
  // Reflète, en direct, la carte que verront les pilotes conviés — uniquement à
  // partir des valeurs saisies. Un champ vide est masqué (jamais inventé).
  const previewMeta = [formatDateTime(startsAt.toISOString()), location.trim()]
    .filter(Boolean)
    .join(' · ');

  const placesNum = maxPilots.trim() === '' ? null : Number(maxPilots.trim());
  const placesText =
    placesNum != null && Number.isInteger(placesNum) && placesNum > 0
      ? `${placesNum} place${placesNum > 1 ? 's' : ''}`
      : null;

  const previewPriceCents = (() => {
    const t = price.trim().replace(',', '.');
    if (t === '') return null;
    const cents = Math.round(Number(t) * 100);
    return Number.isFinite(cents) && cents >= 0 ? cents : null;
  })();
  const priceText =
    previewPriceCents != null ? `${formatPriceCents(previewPriceCents)} / place` : null;

  // ── Blocs partagés aux deux formats ────────────────────────────────────────
  const form = (
    <>
      <Field
        label="Titre"
        value={title}
        onChangeText={setTitle}
        placeholder="Journée piste, séance privée…"
        maxLength={120}
      />

      <DateField
        label="Date et heure"
        value={formatDateTime(startsAt.toISOString())}
        active={pickerOpen}
        onPress={openPicker}
      />

      <Field
        label="Lieu"
        optional
        value={location}
        onChangeText={setLocation}
        placeholder="Nom du circuit"
      />

      <Field
        label="Places"
        optional
        value={maxPilots}
        onChangeText={setMaxPilots}
        placeholder="Sans limite"
        keyboardType="number-pad"
        maxLength={4}
      />

      <Field
        label="Prix par place"
        optional
        value={price}
        onChangeText={setPrice}
        placeholder="Gratuit"
        keyboardType="decimal-pad"
        unit="€"
        maxLength={10}
      />

      <Field
        label="Notes"
        optional
        value={notes}
        onChangeText={setNotes}
        placeholder="Informations pratiques pour vos pilotes."
        multiline
        maxLength={500}
      />
    </>
  );

  const previewPanel = (
    <CockpitPanel plain>
      <Text style={s.panelEyebrow}>Aperçu</Text>
      <Text style={[s.previewTitle, title.trim() ? null : s.previewTitleEmpty]} numberOfLines={2}>
        {title.trim() || 'Titre à renseigner'}
      </Text>
      <Text style={s.previewMeta} numberOfLines={2}>
        {previewMeta}
      </Text>
      {placesText || priceText ? (
        <View style={s.chipsRow}>
          {placesText ? (
            <View style={s.chip}>
              <Text style={s.chipTxt}>{placesText}</Text>
            </View>
          ) : null}
          {priceText ? (
            <View style={s.chip}>
              <Text style={s.chipTxt}>{priceText}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </CockpitPanel>
  );

  const submitBlock = (
    <View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <CoachCTA label="Enregistrer le roulage" onPress={onSubmit} loading={saving} />
      <View style={{ marginTop: spacing.md }}>
        <Button label="Annuler" variant="ghost" onPress={() => router.back()} />
      </View>
      <Text style={s.footnote}>
        Une fois créé, ce roulage rejoint votre agenda. Vous conviez ensuite vos pilotes.
      </Text>
    </View>
  );

  // ── Assemblage selon le format ─────────────────────────────────────────────
  let body: React.ReactNode;
  if (isConsole) {
    body = (
      <View style={s.cols}>
        <View style={s.mainCol}>{form}</View>
        <View style={s.aside}>
          {previewPanel}
          <View style={{ marginTop: spacing.xl }}>{submitBlock}</View>
        </View>
      </View>
    );
  } else {
    body = (
      <View>
        {form}
        <View style={{ marginTop: spacing.md }}>{previewPanel}</View>
        <View style={{ marginTop: spacing.xl }}>{submitBlock}</View>
      </View>
    );
  }

  return (
    <Screen>
      {isConsole ? null : <AppBar title="NOUVEAU ROULAGE" onBack={() => router.back()} />}
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {isConsole ? (
          <View style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>ROULAGES</Text>
              <Text style={[s.title, { marginTop: spacing.sm }]} accessibilityRole="header">
                Nouveau roulage
              </Text>
            </View>
            <RoleBadge role="coach" />
          </View>
        ) : (
          <>
            <View style={{ marginBottom: spacing.md }}>
              <RoleBadge role="coach" />
            </View>
            <Text style={s.eyebrow}>COACH OXV</Text>
            <Text style={[s.title, { marginTop: spacing.sm }]} accessibilityRole="header">
              Un roulage à vous.
            </Text>
          </>
        )}

        <View style={{ marginTop: spacing.xl }}>{body}</View>

        {pickerOpen ? (
          <DateTimePicker
            value={startsAt}
            mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        ) : null}
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sélecteur date/heure présenté comme un champ (même langage que `Field`) : le
 * picker n'étant pas un TextInput, ce wrapper reproduit le label et l'encadré.
 * La bordure s'éclaire quand le picker est ouvert (or = actif, comme `Field`).
 */
function DateField({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <View style={s.dateFieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value}`}
        onPress={onPress}
        style={[s.dateBox, active ? s.dateBoxActive : null]}
      >
        <Text style={s.dateValue}>{value}</Text>
      </Pressable>
    </View>
  );
}

/**
 * CTA d'action réelle (rouge coach — identité de rôle). L'or reste au chrono ;
 * le coach porte le rouge. État en cours honnête (spinner + non cliquable). Le
 * bouton n'est jamais mort : au tap, la saisie est validée et l'erreur s'affiche.
 */
function CoachCTA({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading }}
      onPress={loading ? undefined : onPress}
      disabled={loading}
      style={({ pressed }) => [s.cta, pressed && !loading ? { opacity: 0.9 } : null]}
    >
      <View style={s.ctaContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.cream}
            style={{ marginRight: spacing.sm }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text style={s.ctaTxt}>{label}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // — Gouttières —
  consolePad: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  companionPad: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // — En-tête —
  consoleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.2,
  },

  // — Colonnes console —
  cols: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  mainCol: { flex: 1.7 },
  aside: { flex: 1, maxWidth: 340 },

  // — Champ date/heure (calqué sur Field) —
  dateFieldWrap: { marginBottom: spacing.lg },
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
  dateBoxActive: { borderColor: palette.gold },
  dateValue: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },

  // — Aperçu —
  panelEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  previewTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  previewTitleEmpty: { color: palette.creamMute },
  previewMeta: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.xs,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    backgroundColor: palette.card,
  },
  chipTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.creamSoft,
  },

  // — Erreur en ligne —
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.red,
    marginBottom: spacing.md,
    lineHeight: fontSize.small * 1.5,
  },

  // — CTA rouge coach —
  cta: {
    backgroundColor: palette.coachAccent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },

  footnote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    marginTop: spacing.lg,
    lineHeight: fontSize.small * 1.5,
  },
});
