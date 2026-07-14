/**
 * Coach — Priorités du bilan (§12 handoff · coach/07-priorites), RESKIN
 * refonte-v2 RESPONSIVE DEUX FORMATS (décision fondateur 2026-07-13).
 *
 * Le coach met en avant, pour CE pilote, les virages à regarder en premier
 * (ordre de lecture) et une note d'introduction. Sur le bilan du pilote, cela
 * apparaît « Mis en avant par votre coach » — voix ATTRIBUÉE (bande rouge §12),
 * jamais une consigne de l'app. Le coach oriente ; il ne prescrit pas le
 * pilotage : on désigne des virages, on n'écrit pas quoi y faire.
 *
 *   - CONSOLE tablette (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette
 *     coach/07-priorites) : deux colonnes — à gauche « Virages de la séance »
 *     (bascules ordonnées + note d'introduction + enregistrer), à droite
 *     « Aperçu côté pilote » (ce que le pilote verra, bande rouge attribuée).
 *   - COMPAGNON téléphone : une colonne, les mêmes blocs empilés.
 * Le rail §12 est porté par (coach)/_layout ; l'écran n'adapte que son corps.
 *
 * Données réelles : virages = topologie statique du circuit (BELTOISE_CORNERS,
 * name + pace) ; sélection/note = coach_pilot_highlight (getMyHighlightForPilot
 * / upsertHighlight). Nom du pilote = coach_pilots_view (listMyPilots),
 * best-effort ; absent → suffixe masqué. Aucun contrôle mort, aucune valeur
 * inventée. Identité COACH rouge (#E23A4E) ; pas d'or (aucun chrono ici) ;
 * couleurs QDI non convoquées (pas de donnée QDI/marge chargée sur cet écran).
 * Logique, services, états et navigation inchangés.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { BELTOISE_CORNERS, type CornerTopology } from '@/lib/circuitTopology';
import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import { toggleCornerIndex } from '@/services/coachCurationLogic';
import { getMyHighlightForPilot, upsertHighlight } from '@/services/coachCurationService';
import { listMyPilots } from '@/services/coachService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing, fonts, fontSize, radius } = theme;

/** Descripteur factuel du profil de virage (topologie réelle, jamais une consigne). */
function paceLabel(pace: CornerTopology['pace']): string {
  return pace === 'slow' ? 'Épingle' : pace === 'fast' ? 'Courbe rapide' : 'Virage moyen';
}

export default function CoachPrioritesScreen() {
  const params = useLocalSearchParams<{ pilotId?: string }>();
  const pilotId = params.pilotId;

  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [pilotName, setPilotName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pilotId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    getMyHighlightForPilot(pilotId)
      .then((h) => {
        if (cancelled) return;
        if (h) {
          setSelected(h.highlightCornerIndexes);
          setNote(h.note ?? '');
        }
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
  }, [pilotId, reloadKey]);

  // Nom du pilote (contexte d'en-tête) — best-effort, ne conditionne pas l'état
  // de l'écran. Source : coach_pilots_view (RLS). Jamais de coordonnées.
  useEffect(() => {
    let cancelled = false;
    if (!pilotId) return;
    listMyPilots()
      .then((rows) => {
        if (cancelled) return;
        const row = rows.find((p) => p.pilotId === pilotId);
        if (!row) return;
        const first = (row.firstName ?? '').trim();
        const last = (row.lastName ?? '').trim();
        const name = first && last ? `${first} ${last[0].toUpperCase()}.` : first || last || null;
        setPilotName(name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  const formState: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  function onToggle(idx: number) {
    setSelected((prev) => toggleCornerIndex(prev, idx));
    setSaved(false);
  }

  function onNoteChange(value: string) {
    setNote(value);
    setSaved(false);
  }

  async function onSave() {
    if (!pilotId || saving) return;
    setSaving(true);
    setSaved(false);
    const result = await upsertHighlight(pilotId, {
      highlightCornerIndexes: selected,
      note: note.trim() || null,
    });
    setSaving(false);
    if (result) setSaved(true);
  }

  const count = selected.length;
  const countLabel =
    count === 0 ? 'Aucun virage mis en avant' : `${count} mis en avant sur son bilan`;

  // — Fragments partagés par les deux formats (une seule source de vérité) —

  const cornerList = (
    <View style={{ gap: spacing.sm }}>
      {BELTOISE_CORNERS.map((corner) => {
        const order = selected.indexOf(corner.index);
        const active = order >= 0;
        return (
          <Pressable
            key={corner.index}
            accessibilityRole="switch"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`Virage ${corner.index}, ${corner.name}, ${paceLabel(corner.pace)}`}
            accessibilityHint={
              active ? 'Retirer du bilan du pilote' : 'Mettre en avant sur le bilan du pilote'
            }
            onPress={() => onToggle(corner.index)}
            style={({ pressed }) => [
              s.cornerRow,
              active && s.cornerRowActive,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={[s.badge, active ? s.badgeActive : s.badgeIdle]}>
              <Text style={[s.badgeNum, active ? s.badgeNumActive : s.badgeNumIdle]}>
                {corner.index}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cornerName}>
                Virage {corner.index} · {corner.name}
              </Text>
              <Text style={s.cornerMeta}>
                {paceLabel(corner.pace)}
                {active ? ` · lecture ${order + 1}` : ''}
              </Text>
            </View>
            <Toggle on={active} />
          </Pressable>
        );
      })}
    </View>
  );

  const noteField = (
    <View style={{ marginTop: spacing.xl }}>
      <Field
        label="Note d'introduction"
        optional
        value={note}
        onChangeText={onNoteChange}
        placeholder="Un mot pour orienter la lecture du bilan."
        multiline
        maxLength={280}
        showCounter
      />
    </View>
  );

  const saveBlock = (
    <View>
      {saved ? (
        <Text style={[s.savedTxt, { marginBottom: spacing.md }]} accessibilityLiveRegion="polite">
          Priorités enregistrées.
        </Text>
      ) : null}
      <Button label="Enregistrer" onPress={onSave} loading={saving} disabled={saving || !pilotId} />
    </View>
  );

  const preview = <PreviewPanel selected={selected} note={note} />;

  const backLink = (
    <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        hitSlop={theme.hitSlop}
        onPress={() => router.back()}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={s.backLink}>Retour</Text>
      </Pressable>
    </View>
  );

  const eyebrowText = pilotName ? `Sur le bilan de ${pilotName}` : 'Sur le bilan du pilote';

  return (
    <Screen scroll={false}>
      <AppBar title="PRIORITÉS" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: isConsole ? spacing.xl : spacing.lg,
            paddingBottom: spacing.xxl,
          }}
        >
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>

          {/* En-tête : contexte pilote + intention + compteur (côté droit sur console). */}
          <View style={isConsole ? s.headerRow : undefined}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{eyebrowText}</Text>
              <Text style={s.title} accessibilityRole="header">
                Ce que vous mettez en avant.
              </Text>
              <Text style={s.manifest}>
                Mettez en avant les virages à regarder en premier. Un ordre de lecture, pas une
                consigne.
              </Text>
            </View>
            {formState === 'nominal' ? (
              <Text style={[s.count, isConsole ? s.countConsole : s.countPhone]}>{countLabel}</Text>
            ) : null}
          </View>

          <StateWrapper
            state={formState}
            skeletonLines={5}
            errorCause="Les priorités n'ont pas pu être chargées."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {isConsole ? (
              <View style={s.columns}>
                <View style={s.colLeft}>
                  <SectionLabel>VIRAGES DE LA SÉANCE</SectionLabel>
                  <View style={{ marginTop: spacing.md }}>{cornerList}</View>
                  {noteField}
                  <View style={{ marginTop: spacing.lg }}>{saveBlock}</View>
                </View>
                <View style={s.colRight}>
                  <SectionLabel>APERÇU CÔTÉ PILOTE</SectionLabel>
                  <View style={{ marginTop: spacing.md }}>{preview}</View>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: spacing.lg }}>
                <SectionLabel>VIRAGES DE LA SÉANCE</SectionLabel>
                <View style={{ marginTop: spacing.md }}>{cornerList}</View>
                {noteField}
                <View style={{ marginTop: spacing.lg }}>{saveBlock}</View>
                <View style={{ marginTop: spacing.xxl }}>
                  <SectionLabel>APERÇU CÔTÉ PILOTE</SectionLabel>
                  <View style={{ marginTop: spacing.md }}>{preview}</View>
                </View>
              </View>
            )}
          </StateWrapper>

          {backLink}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * Aperçu côté pilote — reflète FIDÈLEMENT ce que le pilote verra dans la section
 * « Mis en avant par votre coach » : la voix du coach ATTRIBUÉE (bande rouge §12),
 * l'ordre de lecture des virages, et l'unique note d'introduction. Une seule
 * note dans le modèle (coach_pilot_highlight.note) → un seul mot d'intro, jamais
 * un texte par virage inventé.
 */
function PreviewPanel({ selected, note }: { selected: number[]; note: string }) {
  const trimmedNote = note.trim();
  const empty = selected.length === 0 && trimmedNote.length === 0;

  return (
    <Card>
      <Text style={s.previewLabel}>SON BILAN · SECTION COACH</Text>
      {empty ? (
        <Text style={s.previewEmpty}>
          Sélectionnez un virage pour prévisualiser ce que le pilote verra sur son bilan.
        </Text>
      ) : (
        <View style={s.attributed}>
          <Text style={s.attributedEyebrow}>MIS EN AVANT PAR VOUS</Text>
          {selected.length > 0 ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              {selected.map((idx, i) => {
                const corner = BELTOISE_CORNERS.find((c) => c.index === idx);
                return (
                  <Text key={idx} style={s.attributedItem}>
                    {i + 1}. Virage {idx}
                    {corner ? ` · ${corner.name}` : ''}
                  </Text>
                );
              })}
            </View>
          ) : null}
          {trimmedNote.length > 0 ? (
            <Text style={s.attributedNote}>« {trimmedNote} »</Text>
          ) : (
            <Text style={s.attributedHint}>Aucune note d'introduction pour l'instant.</Text>
          )}
        </View>
      )}
    </Card>
  );
}

/** Bascule visuelle (présentation) — l'interaction est portée par la carte parente
 *  (rôle « switch »). ON = rouge d'identité coach ; OFF = surface neutre. */
function Toggle({ on }: { on: boolean }) {
  return (
    <View
      style={[s.toggleTrack, on ? s.toggleTrackOn : s.toggleTrackOff]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <View style={[s.toggleThumb, on ? s.toggleThumbOn : s.toggleThumbOff]} />
    </View>
  );
}

const s = StyleSheet.create({
  // — En-tête —
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },
  count: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },
  countConsole: { textAlign: 'right', maxWidth: 180, marginTop: spacing.xs },
  countPhone: { marginTop: spacing.md },

  // — Colonnes console —
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginTop: spacing.xl,
  },
  colLeft: { flex: 1.15 },
  colRight: { flex: 1 },

  // — Carte de virage (bascule) —
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  cornerRowActive: { borderColor: palette.coachAccent },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIdle: { backgroundColor: palette.card2, borderWidth: 1, borderColor: palette.line },
  badgeActive: { backgroundColor: palette.coachAccent },
  badgeNum: { fontFamily: fonts.monoSemi, fontSize: 13 },
  badgeNumIdle: { color: palette.creamMute },
  badgeNumActive: { color: palette.night },
  cornerName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  cornerMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: palette.creamMute,
    marginTop: 3,
  },

  // — Bascule visuelle —
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: palette.coachAccent, alignItems: 'flex-end' },
  toggleTrackOff: {
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'flex-start',
  },
  toggleThumb: { width: 20, height: 20, borderRadius: 10 },
  toggleThumbOn: { backgroundColor: palette.cream },
  toggleThumbOff: { backgroundColor: palette.creamMute },

  // — Confirmation d'enregistrement (état, vert « validé ») —
  savedTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.green,
  },

  // — Aperçu côté pilote —
  previewLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  previewEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  // Bande attribuée = liseré rouge coach à gauche (§12 « voix attribuée »).
  attributed: {
    marginTop: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: palette.coachAccent,
    backgroundColor: 'rgba(226,58,78,0.06)',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  attributedEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.coachAccent,
  },
  attributedItem: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  attributedNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    lineHeight: fontSize.small * 1.5,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },
  attributedHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.md,
  },

  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
});
