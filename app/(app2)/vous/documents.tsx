/**
 * LICENCE & DOCUMENTS — porte VOUS, écran 6/8 du lot V2-L4. Route `vous/documents`.
 *
 * Trois blocs :
 *   1. Carte LICENCE FFSA (ratio carte bancaire, fond card2, insigne, n° mono) —
 *      données RÉELLES de `users` (ffsa_license, kyc_status), ZÉRO champ inventé
 *      (source vérifiée sur app/(app)/carte-licence.tsx v1). Tap → plein écran
 *      + partage view-shot. NOTE : expo-brightness absent du projet → pas de
 *      montée de luminosité (dégradé honnête), la carte est simplement présentée
 *      en grand.
 *   2. DÉCHARGE (flag `pilot_waivers`, fail-closed) : OFF → ligne « disponible
 *      prochainement » (text.dim, non tappable) ; ON → flux e-sign v2 (route
 *      `vous/decharge`, qui re-vérifie le flag sur l'écran).
 *   3. Documents légaux bundlés (Pacte · CGU · Confidentialité) → lecteur
 *      markdown (route `vous/document/[doc]`).
 *
 * Doctrine : FR vouvoyé, zéro emoji, sobre. Le partage (view-shot) est déclenché
 * par le pilote (feuille de partage OS) — jamais un envoi autonome.
 */

import { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useAuthStore } from '@/store/useAuthStore';
import {
  colors,
  ListRow,
  OxvIcon,
  PressScale,
  radius,
  SectionHeader,
  space,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

import {
  fullName,
  hasLicenceIdentity,
  isLicenceValidated,
  LEGAL_DOC_LINKS,
  licenceNumberDisplay,
  validatedOnLabel,
  waiverRowState,
  waiverRowSublabel,
} from '@/features/vous/documentsLogic';
import { useDocuments } from '@/features/vous/useDocuments';

// Ratio carte bancaire (ISO 7810 ID-1) : 85.6 × 53.98 mm.
const CARD_RATIO = 1.586;

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const docs = useDocuments(profile?.id ?? null);

  const [fullscreen, setFullscreen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<View>(null);

  const name = fullName(profile?.first_name, profile?.last_name);
  const validated = isLicenceValidated(docs.identity.kycStatus);
  const validatedOn = validated ? validatedOnLabel(docs.identity.kycValidatedAt) : null;
  const hasIdentity = hasLicenceIdentity(!!profile, docs.identity);

  const waiver = waiverRowState(docs.waiverFlagOn);

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shotRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager ma licence OXV',
          UTI: 'public.png',
        });
      }
    } catch {
      // Feuille fermée ou capture impossible : rien à remonter.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Glyphe nu de 20 pt : hitSlop 12 porte la cible à 44 × 44.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          DOCUMENTS
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xl,
        }}
      >
        {docs.status === 'loading' ? (
          <StateView state="loading" shape="list" />
        ) : docs.status === 'error' ? (
          <StateView
            state="error"
            errorMessage="Vos documents n'ont pas pu se charger."
            onRetry={docs.reload}
          />
        ) : (
          <>
            {/* — Licence FFSA — */}
            <SectionHeader eyebrow="LICENCE CIRCUIT" style={styles.firstHeader} />
            {hasIdentity ? (
              <PressScale
                onPress={() => setFullscreen(true)}
                // Pressable groupe ses enfants : sans ce libellé composé, le
                // contenu de la carte (nom, n° FFSA, validité) n'est jamais dit.
                // Mêmes chaînes que celles rendues par LicenceCard / IdRow.
                // Le tiret d'absence ne se prononce pas : on dit l'absence.
                accessibilityLabel={`Licence circuit. ${name}. N° FFSA ${spokenOrAbsent(
                  licenceNumberDisplay(docs.identity.ffsaLicense)
                )}. Validité ${validated ? (validatedOn ?? 'Validée') : 'non validée'}. Agrandir.`}
                containerStyle={styles.licenceContainer}
              >
                <LicenceCard
                  name={name}
                  ffsa={licenceNumberDisplay(docs.identity.ffsaLicense)}
                  validated={validated}
                  validatedOn={validatedOn}
                />
              </PressScale>
            ) : (
              <StateView
                state="empty"
                emptyMessage="Votre licence apparaîtra dès que votre profil sera renseigné."
                style={styles.licenceEmpty}
              />
            )}

            {/* — Décharge (flag pilot_waivers, fail-closed) — */}
            <SectionHeader eyebrow="DÉCHARGE" style={styles.blockHeader} />
            <View style={styles.list}>
              <ListRow
                icon="drapeau-damier"
                label="Décharge de responsabilité"
                sublabel={waiverRowSublabel(waiver)}
                disabled={waiver === 'soon'}
                onPress={
                  waiver === 'available'
                    ? () => router.push('/(app2)/vous/decharge' as never)
                    : undefined
                }
                divider={false}
              />
            </View>

            {/* — Documents légaux bundlés — */}
            <SectionHeader eyebrow="DOCUMENTS LÉGAUX" style={styles.blockHeader} />
            <View style={styles.list}>
              {LEGAL_DOC_LINKS.map((doc, i) => (
                <ListRow
                  key={doc.slug}
                  label={doc.label}
                  onPress={() => router.push(`/(app2)/vous/document/${doc.slug}` as never)}
                  divider={i < LEGAL_DOC_LINKS.length - 1}
                />
              ))}
            </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Plein écran de la licence — présentation en grand + partage view-shot.
          (Sans expo-brightness dans le projet : pas de montée de luminosité.) */}
      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        transparent={false}
      >
        <View style={[styles.fsRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.fsBar}>
            <PressScale
              onPress={() => setFullscreen(false)}
              accessibilityLabel="Fermer"
              // Glyphe de 22 pt : hitSlop 11 porte la cible à 44 × 44.
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            >
              <CloseGlyph />
            </PressScale>
            <PressScale
              onPress={onShare}
              disabled={sharing}
              accessibilityLabel="Partager ma licence"
              // Glyphe de 22 pt : hitSlop 11 porte la cible à 44 × 44.
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            >
              <ShareGlyph />
            </PressScale>
          </View>
          <View style={styles.fsCenter}>
            <View ref={shotRef} collapsable={false} style={styles.fsCardWrap}>
              <LicenceCard
                name={name}
                ffsa={licenceNumberDisplay(docs.identity.ffsaLicense)}
                validated={validated}
                validatedOn={validatedOn}
                large
              />
            </View>
            <Text style={styles.fsHint}>
              {Platform.OS === 'ios'
                ? 'La feuille de partage couvre Enregistrer et Story.'
                : 'Partagez ou enregistrez la carte depuis la feuille système.'}
            </Text>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Carte licence — visuel (ratio carte bancaire, fond card2, insigne, n° mono)
// ---------------------------------------------------------------------------

function LicenceCard({
  name,
  ffsa,
  validated,
  validatedOn,
  large = false,
}: {
  name: string;
  ffsa: string;
  validated: boolean;
  validatedOn: string | null;
  large?: boolean;
}) {
  return (
    <View style={[styles.licence, large ? styles.licenceLarge : null]}>
      <View style={styles.licenceTop}>
        {/* Insigne NEUTRE : l'or heritage est réservé au tier Heritage — une
            licence est une identité commune, jamais un signe Heritage. */}
        <View style={styles.brandRow}>
          <OxvIcon name="insigne" size={large ? 22 : 18} color={colors.text.hi} />
          <Text style={[styles.brand, large && styles.brandLarge]}>OXV</Text>
        </View>
        {validated ? (
          <View style={styles.badge} accessible accessibilityLabel="Licence validée">
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Validé</Text>
          </View>
        ) : null}
      </View>

      <View>
        <Text style={styles.licenceEyebrow}>Licence circuit</Text>
        <Text style={[styles.licenceName, large && styles.licenceNameLarge]} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View style={styles.licenceMetas}>
        <IdRow label="N° FFSA" value={ffsa} />
        <IdRow label="Validité" value={validated ? (validatedOn ?? 'Validée') : '—'} />
      </View>

      <Text style={styles.licenceFoot}>oxvehicle.fr</Text>
    </View>
  );
}

/**
 * Rend une valeur PRONONÇABLE : le tiret cadratin qui marque l'absence à l'écran
 * est muet pour un lecteur d'écran (il se tait, ou dit « tiret »). Une absence
 * doit s'entendre comme une absence, pas comme un silence après un intitulé.
 */
function spokenOrAbsent(value: string): string {
  const v = value.trim();
  return v === '' || v === '—' ? 'non communiqué' : v;
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    // Libellé et valeur sont deux Text frères : groupés, ils se lisent d'un bloc.
    <View style={styles.idRow} accessible accessibilityLabel={`${label} ${spokenOrAbsent(value)}`}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={styles.idValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glyphes
// ---------------------------------------------------------------------------

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function CloseGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M6 6 L18 18 M18 6 L6 18"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function ShareGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M12 3.5 L12 14.5 M12 3.5 L8.5 7 M12 3.5 L15.5 7"
        stroke={colors.text.hi}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M6.5 11 L6.5 19 C6.5 19.8 7.2 20.5 8 20.5 L16 20.5 C16.8 20.5 17.5 19.8 17.5 19 L17.5 11"
        stroke={colors.text.hi}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },

  firstHeader: { marginBottom: space.md },
  blockHeader: { marginTop: space.xl, marginBottom: space.sm },
  list: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },

  licenceContainer: {},
  licenceEmpty: { marginTop: space.md },

  // Carte licence — surface card2, ratio carte bancaire.
  licence: {
    aspectRatio: CARD_RATIO,
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.hero,
    padding: space.lg,
    justifyContent: 'space-between',
  },
  licenceLarge: { padding: space.xl },
  licenceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brand: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  brandLarge: { fontSize: 22 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text.mid },
  badgeText: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.mid,
  },
  licenceEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  licenceName: {
    fontFamily: typo.display,
    fontSize: 20,
    letterSpacing: 0.3,
    color: colors.text.hi,
    marginTop: 2,
  },
  licenceNameLarge: { fontSize: 26 },
  licenceMetas: { gap: space.sm },
  idRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  idLabel: {
    width: 78,
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.dim,
    paddingTop: 2,
  },
  idValue: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.mid,
  },
  licenceFoot: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.text.dim,
  },

  // Plein écran
  fsRoot: { flex: 1, backgroundColor: colors.bg.base, paddingHorizontal: space.xl },
  fsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  fsCenter: { flex: 1, justifyContent: 'center', gap: space.lg },
  fsCardWrap: {},
  fsHint: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    textAlign: 'center',
  },
});
