/**
 * Écran Coach — Ma fiche publique / compte pro (édition de la fiche vue par les
 * pilotes). Reskin refonte-v2 §12 (`coach/19-profil-public`), RESPONSIVE deux
 * formats.
 *
 * Le coach édite SA fiche `coach_profiles` (RLS owner) : présentation, circuits,
 * spécialités, tarif de saison, liens, médias, publication. L'écran affiche en
 * regard un APERÇU réel de ce que les pilotes voient — mêmes règles de rendu que
 * la fiche pilote (`app/(app)/coach/[id]`), pour que le coach voie SA fiche.
 *
 * Deux formats (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH, maquette `coach/19-profil-public`) :
 *     header (eyebrow PROFIL PUBLIC + titre + CTA rouge coach « Enregistrer »),
 *     puis 2 colonnes — l'aperçu (identité + tarif) + la publication à gauche,
 *     le formulaire d'édition à droite.
 *   - COMPAGNON (téléphone, maquette `coach-mobile/08-moi`) : 1 colonne, l'aperçu
 *     centré en tête (avatar cerclé rouge, nom, « Coach OXV »), puis publication,
 *     formulaire et « Enregistrer » en bas. Le rail (console) / les onglets
 *     (téléphone) viennent du layout : cet écran n'affiche que son corps.
 *
 * Adaptations honnêtes vis-à-vis de la maquette (backend inchangé côté app) :
 *   - la base porte DEUX tarifs (décision fondateur 2026-07-16, migration
 *     20260716200000) : `session_price_eur` — LE prix affiché aux pilotes, à la
 *     session — et `season_price_eur` en secondaire discret ; le détail des
 *     autres formules se convient de gré à gré (noté sous les champs).
 *   - « 12 ans / certifié » ne sont pas en base → non affichés ; les stats de
 *     l'aperçu sont dérivées du réel (nombre de circuits / spécialités saisis + le
 *     tarif). L'identité (nom, initiales) vient du profil de session (`users`).
 *   - le prix par session porte le registre d'offre heritageGold (décision Gabin
 *     2026-07-11) — l'or système (#FFB703) reste réservé au chrono/record.
 *
 * Doctrine : vouvoiement, aucun emoji, descriptif jamais prescriptif. Le tarif est
 * indicatif (règlement de gré à gré, hors app). Accent d'action = rouge coach.
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  getMyCoachProfile,
  parseTagList,
  updateMyCoachProfile,
} from '@/services/coachProfileService';
import {
  addMyCoachMedia,
  type CoachMediaType,
  type CoachMediaView,
  listMyCoachMedia,
  removeMyCoachMedia,
} from '@/services/coachMediaService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Tarif saisi → « 1 500 € » (fr, sans décimale), ou null si vide/invalide. */
function formatEuro(raw: string): string | null {
  const n = raw.trim() ? Number(raw.replace(',', '.').replace(/\s/g, '')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

/** Tarif saisi → entier ≥ 0 pour la sauvegarde, ou null si vide/invalide. */
function parseEuroInt(raw: string): number | null {
  const n = raw.trim() ? Number(raw.replace(',', '.').replace(/\s/g, '')) : null;
  return n != null && Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

export default function CoachProfileScreen() {
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const authProfile = useAuthStore((st) => st.profile);
  const initials =
    [authProfile?.first_name?.[0], authProfile?.last_name?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || 'OXV';
  const displayName =
    [authProfile?.first_name, authProfile?.last_name].filter(Boolean).join(' ') || 'Coach OXV';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [palmares, setPalmares] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [circuits, setCircuits] = useState('');
  const [sessionPrice, setSessionPrice] = useState('');
  const [price, setPrice] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [published, setPublished] = useState(false);
  const [media, setMedia] = useState<CoachMediaView[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listMyCoachMedia().then((m) => {
      if (!cancelled) setMedia(m);
    });
    getMyCoachProfile()
      .then((p) => {
        if (cancelled) return;
        setHeadline(p.headline ?? '');
        setBio(p.bio ?? '');
        setPalmares(p.palmares ?? '');
        setSpecialties(p.specialties.join(', '));
        setCircuits(p.circuits.join(', '));
        setSessionPrice(p.sessionPriceEur != null ? String(p.sessionPriceEur) : '');
        setPrice(p.seasonPriceEur != null ? String(p.seasonPriceEur) : '');
        setWebsite(p.websiteUrl ?? '');
        setInstagram(p.instagramUrl ?? '');
        setYoutube(p.youtubeUrl ?? '');
        setPublished(p.isPublished);
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

  async function onSave() {
    setSaving(true);
    const res = await updateMyCoachProfile({
      headline,
      bio,
      palmares,
      specialties: parseTagList(specialties),
      circuits: parseTagList(circuits),
      // Entiers ≥ 0, ou null si vide/invalide (jamais de valeur fabriquée).
      sessionPriceEur: parseEuroInt(sessionPrice),
      seasonPriceEur: parseEuroInt(price),
      websiteUrl: website,
      instagramUrl: instagram,
      youtubeUrl: youtube,
      isPublished: published,
    });
    setSaving(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error });
      return;
    }
    Toast.show({ type: 'success', text1: 'Fiche enregistrée.' });
  }

  async function onAddMedia(type: CoachMediaType) {
    setMediaBusy(true);
    const res = await addMyCoachMedia(type);
    setMediaBusy(false);
    if (res.ok) {
      setMedia(res.items);
      Toast.show({
        type: 'success',
        text1: type === 'video' ? 'Vidéo ajoutée.' : 'Photo ajoutée.',
      });
    } else if (!('cancelled' in res)) {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  async function onRemoveMedia(id: string) {
    const res = await removeMyCoachMedia(id);
    if (res.ok) {
      setMedia(res.items);
    } else {
      Toast.show({ type: 'error', text1: res.error });
    }
  }

  const state: ScreenState = loading ? 'loading' : error ? 'error' : 'nominal';

  // Aperçu vivant : dérivé du réel (session + saisie en cours), jamais un exemple.
  const specialtyList = parseTagList(specialties);
  const circuitList = parseTagList(circuits);
  // LE prix des pilotes : à la session (fondateur 2026-07-16) ; saison secondaire.
  const sessionLabel = formatEuro(sessionPrice);
  const seasonLabel = formatEuro(price);
  const hasStats = circuitList.length > 0 || specialtyList.length > 0 || sessionLabel !== null;

  // — Aperçu (ce que les pilotes voient) : identité + tarif d'offre —
  const preview = (
    <Card style={s.previewCard}>
      <View style={s.avatarRing}>
        <Text style={s.avatarInitials}>{initials}</Text>
      </View>
      <Text style={s.name} accessibilityRole="header">
        {displayName}
      </Text>
      <Text style={s.roleEyebrow}>Coach OXV</Text>

      {hasStats ? (
        <View style={s.statsRow}>
          {circuitList.length > 0 ? (
            <View style={s.statTile}>
              <Text style={s.statValue}>{circuitList.length}</Text>
              <Text style={s.statLabel}>circuit{circuitList.length > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
          {specialtyList.length > 0 ? (
            <View style={s.statTile}>
              <Text style={s.statValue}>{specialtyList.length}</Text>
              <Text style={s.statLabel}>spécialité{specialtyList.length > 1 ? 's' : ''}</Text>
            </View>
          ) : null}
          {sessionLabel ? (
            // Chiffre dominant : le prix À LA SESSION (fondateur 2026-07-16).
            // Registre d'offre heritageGold — l'or système (#FFB703) reste
            // réservé au chrono/record.
            <View style={s.statTile} accessibilityLabel={`${sessionLabel} par session`}>
              <Text style={[s.statValue, s.statValueGold]}>{sessionLabel}</Text>
              <Text style={s.statLabel}>la session</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={s.previewEmpty}>Complétez votre fiche pour l’aperçu.</Text>
      )}
      {seasonLabel ? (
        // La saison, secondaire discret — même règle que la fiche pilote.
        <Text style={s.seasonNote} accessibilityLabel={`Tarif de saison ${seasonLabel}`}>
          Saison : {seasonLabel}
        </Text>
      ) : null}
      {sessionLabel || seasonLabel ? (
        <Text style={s.tariffNote}>Tarif indicatif · réglé hors application</Text>
      ) : null}
    </Card>
  );

  // — Publication (contrôle réel : apparaît ou non dans la découverte) —
  const publication = (
    <View style={s.pubBlock}>
      <SectionLabel>Publication</SectionLabel>
      <View style={s.pubRow}>
        {[
          { v: true, label: 'Publiée' },
          { v: false, label: 'Masquée' },
        ].map((o) => {
          const on = published === o.v;
          return (
            <Pressable
              key={o.label}
              onPress={() => setPublished(o.v)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              hitSlop={6}
              style={[s.pubPill, on ? (o.v ? s.pubPillLive : s.pubPillHidden) : null]}
            >
              <Text style={[s.pubPillT, on ? s.pubPillTOn : null]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.pubHint}>Une fiche publiée apparaît dans la découverte des pilotes.</Text>
    </View>
  );

  // — Formulaire d'édition —
  const form = (
    <View style={{ gap: spacing.lg }}>
      <View>
        <SectionLabel>Présentation</SectionLabel>
        <View style={s.sectionBody}>
          <Field
            label="Accroche"
            value={headline}
            onChangeText={setHeadline}
            placeholder="Coach pilotage, circuit & data"
            maxLength={80}
          />
          <Field
            label="Présentation"
            value={bio}
            onChangeText={setBio}
            placeholder="Votre approche, votre parcours…"
            multiline
            maxLength={1000}
            showCounter
          />
          <Field
            label="Palmarès"
            optional
            value={palmares}
            onChangeText={setPalmares}
            placeholder="Titres, podiums, références…"
            multiline
            maxLength={500}
          />
        </View>
      </View>

      <View>
        <SectionLabel>Circuits & spécialités</SectionLabel>
        <View style={s.sectionBody}>
          <Field
            label="Spécialités"
            value={specialties}
            onChangeText={setSpecialties}
            placeholder="Trajectoire, freinage, data"
            helper="Séparées par des virgules."
          />
          <Field
            label="Circuits"
            value={circuits}
            onChangeText={setCircuits}
            placeholder="Haute Saintonge, Charente"
            helper="Séparés par des virgules."
          />
        </View>
      </View>

      <View>
        <SectionLabel>Formule & tarif</SectionLabel>
        <View style={s.sectionBody}>
          <Field
            label="Prix par session"
            optional
            value={sessionPrice}
            onChangeText={setSessionPrice}
            placeholder="120"
            keyboardType="number-pad"
            unit="€"
            helper="Réglé hors application."
          />
          <Field
            label="Tarif de saison"
            optional
            value={price}
            onChangeText={setPrice}
            placeholder="1500"
            keyboardType="number-pad"
            unit="€"
            helper="Indicatif, affiché en secondaire. Réglé hors application."
          />
          <Text style={s.formulaNote}>
            Le prix par session est celui que voient les pilotes ; la saison reste en secondaire. Le
            détail des formules (journée, programme) se convient de gré à gré, hors application.
          </Text>
        </View>
      </View>

      <View>
        <SectionLabel>Liens</SectionLabel>
        <View style={s.sectionBody}>
          <Field
            label="Site web"
            optional
            value={website}
            onChangeText={setWebsite}
            placeholder="https://…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Field
            label="Instagram"
            optional
            value={instagram}
            onChangeText={setInstagram}
            placeholder="https://instagram.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Field
            label="YouTube"
            optional
            value={youtube}
            onChangeText={setYoutube}
            placeholder="https://youtube.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
      </View>

      <View>
        <SectionLabel>Médias</SectionLabel>
        <Text style={s.mediaHint}>Photos et vidéos de votre fiche, visibles par les pilotes.</Text>

        {media.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.md }}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {media.map((m) => (
              <View key={m.id} style={s.mediaTile}>
                {m.type === 'photo' ? (
                  <Image
                    source={{ uri: m.url }}
                    style={s.mediaThumb}
                    resizeMode="cover"
                    accessibilityLabel="Photo de la fiche"
                  />
                ) : (
                  <View style={[s.mediaThumb, s.mediaVideo]}>
                    <Text style={s.mediaVideoT}>Vidéo</Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retirer ce média"
                  hitSlop={6}
                  onPress={() => onRemoveMedia(m.id)}
                  style={s.mediaRemove}
                >
                  <Text style={s.mediaRemoveT}>Retirer</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={s.mediaEmpty}>Aucun média pour l’instant.</Text>
        )}

        <View style={s.mediaActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une photo"
            disabled={mediaBusy}
            onPress={() => onAddMedia('photo')}
            style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
          >
            <Text style={s.mediaBtnT}>Ajouter une photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une vidéo"
            disabled={mediaBusy}
            onPress={() => onAddMedia('video')}
            style={[s.mediaBtn, mediaBusy ? { opacity: 0.5 } : null]}
          >
            <Text style={s.mediaBtnT}>Ajouter une vidéo</Text>
          </Pressable>
        </View>

        {mediaBusy ? (
          <ActivityIndicator
            color={palette.creamMute}
            style={{ marginTop: spacing.md }}
            accessibilityLabel="Envoi du média en cours"
          />
        ) : null}
      </View>
    </View>
  );

  // — Corps selon le format —
  const body = isConsole ? (
    <View style={s.cols}>
      <View style={s.aside}>
        {preview}
        {publication}
      </View>
      <View style={s.mainCol}>{form}</View>
    </View>
  ) : (
    <View style={{ gap: spacing.xl }}>
      {preview}
      {publication}
      {form}
      <CoachCTA label="Enregistrer ma fiche" loading={saving} onPress={onSave} block />
    </View>
  );

  return (
    <Screen>
      <View style={isConsole ? s.consolePad : s.companionPad}>
        {isConsole ? (
          <View style={s.consoleHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>PROFIL PUBLIC</Text>
              <Text style={s.title} accessibilityRole="header">
                Votre fiche vue par les pilotes
              </Text>
            </View>
            {state === 'nominal' ? (
              <CoachCTA label="Enregistrer" loading={saving} onPress={onSave} />
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: isConsole ? spacing.xl : spacing.md }}>
          <StateWrapper
            state={state}
            skeletonLines={6}
            errorCause="Votre fiche coach n'a pas pu être chargée."
            onRetry={reload}
          >
            {body}
          </StateWrapper>
        </View>
      </View>
    </Screen>
  );
}

/** CTA d'action réelle (rouge coach). L'or reste au chrono ; le coach porte le rouge. */
function CoachCTA({
  label,
  onPress,
  loading,
  block,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  block?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Enregistrer ma fiche"
      accessibilityState={{ busy: !!loading }}
      onPress={loading ? undefined : onPress}
      disabled={loading}
      style={({ pressed }) => [
        s.cta,
        block ? s.ctaBlock : null,
        pressed && !loading ? { opacity: 0.9 } : null,
      ]}
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
  companionPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // — En-tête console —
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
    marginTop: spacing.sm,
  },

  // — Colonnes console —
  cols: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  aside: { flex: 1, maxWidth: 360, gap: spacing.xl },
  mainCol: { flex: 1.6 },

  // — Aperçu (identité + tarif) —
  previewCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.mono,
    fontSize: fontSize.h3,
    letterSpacing: 1,
    color: palette.creamSoft,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  roleEyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.coachAccent,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  statValue: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.h3,
    color: palette.cream,
  },
  statValueGold: { color: palette.heritageGold },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    marginTop: spacing.xs,
  },
  previewEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  // La saison en secondaire discret (le chiffre dominant est la session).
  seasonNote: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  tariffNote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.faint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // — Publication —
  pubBlock: { gap: spacing.md },
  pubRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  pubPill: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  // Publiée = visible/actif → registre vert (validé) ; Masquée = neutre.
  pubPillLive: { borderColor: palette.green, backgroundColor: 'rgba(79,201,138,0.08)' },
  pubPillHidden: { borderColor: palette.creamMute, backgroundColor: 'rgba(154,154,163,0.08)' },
  pubPillT: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamMute,
  },
  pubPillTOn: { color: palette.cream },
  pubHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },

  // — Sections de formulaire —
  sectionBody: { marginTop: spacing.md },
  formulaNote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic',
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
  },

  // — Médias —
  mediaHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.xs,
  },
  mediaEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.md,
  },
  mediaTile: { width: 120 },
  mediaThumb: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  mediaVideo: { alignItems: 'center', justifyContent: 'center' },
  mediaVideoT: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  mediaRemove: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  mediaRemoveT: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  mediaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  mediaBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.coachAccent,
  },
  mediaBtnT: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    letterSpacing: 0.3,
    color: palette.coachAccent,
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
  ctaContent: { flexDirection: 'row', alignItems: 'center' },
  ctaTxt: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.cream,
  },
});
