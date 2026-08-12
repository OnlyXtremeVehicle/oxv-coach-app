/**
 * PASS OXV — porte CLUB, écran 7/7 (V2-L5, mission C). Route `club/pass`.
 *
 * IL LIT `registrations` + `sessions` DEPUIS LE 12/08/2026.
 *
 * Il lisait `event_registrations`, jointe à `events`. Cette table contient ZÉRO
 * ligne en production et n'a jamais été écrite : l'écran affichait « aucune
 * inscription » à tous les pilotes, y compris à ceux qui avaient réservé et
 * réglé leur journée sur oxvehicle.fr. Il fonctionnait, ses tests passaient, et
 * il ne pouvait rien montrer.
 *
 * Les journées se réservent sur le site, qui écrit dans `registrations`. Un
 * seul projet Supabase pour les deux : ce sont les mêmes tables.
 *
 *   - inscriptions à venir en cartes (date, circuit, créneau, offre en chip)
 *     avec QR de présence PLEIN au tap (fond clair, dismiss swipe — source QR
 *     pass-oxv v1 via passLogic.qrCheckinPayload) ;
 *   - une journée PRIVÉE n'est pas lisible par le pilote qui y est inscrit
 *     (`sessions_select_authenticated`). Elle n'est plus écartée en silence :
 *     elle apparaît en disant ce qu'on ne sait pas d'elle ;
 *   - historique en lignes hairline dessous ;
 *   - aucune inscription → StateView (illustration circuit) + CTA vers la
 *     réservation (drapeau `app_payments`, fail-closed) ou la porte Club.
 *
 * Le partage à venir / historique, les libellés et l'éligibilité du QR sont
 * PURS et testés (passLogic). Le scan admin reste inchangé.
 *
 * Doctrine : un pass est un fait d'inscription du pilote à SA journée — aucun
 * classement, aucun chrono d'autrui. FR vouvoyé, sans emoji, jamais prescriptif.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { listMesJournees, type MaJournee } from '@/services/journeesService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  Chip,
  colors,
  ListRow,
  PressScale,
  radius,
  SectionHeader,
  space,
  StateView,
  staggerEntering,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import { passEmptyCta, URL_JOURNEES_SITE, qrCheckinPayload } from '@/features/club/passLogic';
import {
  libelleCreneau,
  libelleOffre,
  libelleStatut,
  ligneHoraire,
  ligneJournee,
  partagerJournees,
  qrAffichable,
  raisonSansQr,
} from '@/features/club/passJourneeLogic';

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/**
 * Les journées portent une DATE (`sessions.date`, `YYYY-MM-DD`), pas un
 * datetime. `new Date('2026-08-20')` l'interprète en UTC et rend la veille au
 * soir dans les fuseaux à l'ouest — le pilote lirait « vendredi 19 » pour une
 * journée du samedi 20. On construit donc la date en LOCAL, champ par champ.
 */
function dateLocale(dateIso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** « Samedi 19 juillet » depuis une date `YYYY-MM-DD`. */
function dayLabel(dateIso: string): string {
  const d = dateLocale(dateIso);
  if (d === null) return '';
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** « 12 mai 2026 » — historique compact. */
function shortDate(dateIso: string): string {
  const d = dateLocale(dateIso);
  if (d === null) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

type Phase = 'loading' | 'ready' | 'error';

export default function PassScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();

  const [phase, setPhase] = useState<Phase>('loading');
  const [regs, setRegs] = useState<MaJournee[]>([]);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);

  // QR plein écran.
  const [qrValue, setQrValue] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setPhase('loading');
    try {
      const [list, flag] = await Promise.all([
        // STRICT : `listMesJournees` LÈVE sur panne de base. Un `[]` avalé se
        // lirait « vous n'avez aucune journée » — l'affirmation exacte que cet
        // écran faisait à tort.
        listMesJournees(),
        isFlagEnabled('app_payments').catch(() => false),
      ]);
      setRegs(list);
      setPaymentsEnabled(flag);
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const { aVenir, historique, illisibles } = useMemo(
    () => partagerJournees(regs, Date.now()),
    [regs]
  );

  const onEmptyCta = useCallback(() => {
    // Paiements fermés → LE SITE, pas la porte Club. Le repli précédent
    // ramenait le pilote à l'écran dont il venait d'arriver ; il voulait
    // réserver une journée. Voir `passLogic.URL_JOURNEES_SITE` : ce chemin mène
    // à son espace, pas à l'URL de paiement d'une demande — celle-là est encore
    // attendue du site (D-06 du dossier de raccordement).
    if (passEmptyCta(paymentsEnabled) === 'reserve') {
      router.push('/(app2)/reserver' as never);
      return;
    }
    Linking.openURL(URL_JOURNEES_SITE).catch(() => {
      // Aucun navigateur disponible : on ne laisse pas le geste sans réponse.
      Toast.show({
        type: 'error',
        text1: 'Le site ne s’est pas ouvert.',
        text2: 'Retrouvez vos journées sur oxvehicle.fr, espace compte.',
      });
    });
  }, [paymentsEnabled]);

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.backDisc}>
            <BackChevron />
          </View>
        </PressScale>
        <View>
          <Text style={styles.eyebrow}>VOTRE JOURNÉE</Text>
          <Text style={styles.title} accessibilityRole="header">
            PASS OXV
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        {phase === 'loading' ? (
          <StateView state="loading" shape="card" />
        ) : phase === 'error' ? (
          <StateView
            state="error"
            errorMessage="Vos pass n'ont pas pu se charger."
            onRetry={reload}
          />
        ) : aVenir.length === 0 && historique.length === 0 && illisibles.length === 0 ? (
          <View style={styles.emptyBlock}>
            <StateView
              state="empty"
              emptyMessage="Aucune inscription pour l'instant. Votre prochaine journée s'affichera ici."
            />
            <PressScale
              onPress={onEmptyCta}
              accessibilityLabel={
                paymentsEnabled
                  ? 'Réserver une journée'
                  : 'Voir les journées sur le site OXV — ouvre votre navigateur'
              }
            >
              <View style={styles.emptyCta}>
                <Text style={styles.emptyCtaLabel}>
                  {paymentsEnabled ? 'Réserver une journée' : 'Voir les journées sur le site'}
                </Text>
              </View>
            </PressScale>
          </View>
        ) : (
          <>
            {aVenir.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader eyebrow="À VENIR" count={aVenir.length} />
                <View style={styles.cards}>
                  {aVenir.map((reg, index) => (
                    <PassCard
                      key={reg.registrationId}
                      reg={reg}
                      index={index}
                      onShowQr={() => setQrValue(qrCheckinPayload(reg.registrationId))}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/*
              LES JOURNÉES QU'ON NE PEUT PAS LIRE. `sessions` n'ouvre pas les
              journées privées au pilote qui y est inscrit. L'ancien écran les
              écartait des deux listes, en silence : le pilote payait et ne
              voyait rien. On dit son inscription, et on dit ce qu'on ignore.
            */}
            {illisibles.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader eyebrow="INSCRIPTIONS PRIVÉES" count={illisibles.length} />
                <View style={styles.historyCard}>
                  {illisibles.map((reg, index) => (
                    <ListRow
                      key={reg.registrationId}
                      icon="drapeau-damier"
                      label={libelleOffre(reg.offerType)}
                      sublabel="Le détail de cette journée ne vous est pas ouvert."
                      value={libelleStatut(reg.status)}
                      divider={index < illisibles.length - 1}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {historique.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader eyebrow="HISTORIQUE" count={historique.length} />
                <View style={styles.historyCard}>
                  {historique.map((reg, index) => (
                    <ListRow
                      key={reg.registrationId}
                      icon="drapeau-damier"
                      label={libelleOffre(reg.offerType)}
                      sublabel={
                        reg.journee
                          ? [shortDate(reg.journee.date), ligneJournee(reg.journee)]
                              .filter((x) => x !== '')
                              .join(' · ')
                          : undefined
                      }
                      value={libelleStatut(reg.status)}
                      divider={index < historique.length - 1}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={styles.footnote}>
              Pour annuler une inscription, écrivez-nous depuis le support.
            </Text>
          </>
        )}
      </Animated.ScrollView>

      <QrFullScreen value={qrValue} onClose={() => setQrValue(null)} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Carte d'inscription à venir — date, circuit, offre, QR compact
// ---------------------------------------------------------------------------

function PassCard({
  reg,
  index,
  onShowQr,
}: {
  reg: MaJournee;
  index: number;
  onShowQr: () => void;
}) {
  const j = reg.journee;
  if (!j) return null;

  // L'HORAIRE SEUL : le circuit est déjà le titre de la carte, juste au-dessus.
  const ligne = ligneHoraire(j);
  const creneau = libelleCreneau(reg.slot);
  const showQr = qrAffichable(reg.status);
  const sansQr = raisonSansQr(reg.status);

  return (
    <Animated.View entering={staggerEntering(index)}>
      <PressScale
        onPress={onShowQr}
        disabled={!showQr}
        accessibilityLabel={
          showQr
            ? `${dayLabel(j.date)}. Agrandir votre code de présence.`
            : `${dayLabel(j.date)}. ${sansQr ?? ''}`
        }
      >
        <View style={styles.card}>
          <View style={styles.cardMain}>
            <Text style={styles.cardCircuit} numberOfLines={1}>
              {(j.circuitName ?? 'JOURNÉE OXV').toUpperCase()}
            </Text>
            <Text style={styles.cardDate} numberOfLines={1}>
              {dayLabel(j.date)}
            </Text>
            {ligne !== '' ? <Text style={styles.cardTime}>{ligne}</Text> : null}
            <View style={styles.cardChips}>
              <Chip label={libelleOffre(reg.offerType)} />
              {creneau !== null ? <Chip label={creneau} /> : null}
            </View>
            {/*
              CE QUI EMPÊCHE LE QR SE DIT, ET SANS REPROCHE. Un code présenté
              au portail pour une journée non réglée fait vivre un refus devant
              les autres ; mieux vaut le lire la veille, ici.
            */}
            {sansQr !== null ? <Text style={styles.cardSansQr}>{sansQr}</Text> : null}
          </View>

          {showQr ? (
            <View style={styles.qrChip}>
              <QRCode
                value={qrCheckinPayload(reg.registrationId)}
                size={64}
                color={colors.bg.base}
                backgroundColor="#FFFFFF"
              />
              <Text style={styles.qrChipHint}>Agrandir</Text>
            </View>
          ) : null}
        </View>
      </PressScale>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// QR plein écran — fond clair (lecture optique), dismiss swipe (patron v1)
// ---------------------------------------------------------------------------

function QrFullScreen({ value, onClose }: { value: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const qrSize = Math.round(Math.min(width, height) * 0.7);
  const ty = useSharedValue(0);

  useEffect(() => {
    if (value !== null) ty.value = 0;
  }, [value, ty]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([16, 9999])
        .onUpdate((e) => {
          ty.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (ty.value > 120 || e.velocityY > 800) {
            runOnJS(onClose)();
          } else {
            ty.value = withTiming(0, { duration: 160 });
          }
        }),
    [onClose, ty]
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Modal
      visible={value !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.qrRoot}>
        <GestureDetector gesture={pan}>
          {/* Fond blanc plein : maximise la luminosité émise (expo-brightness
              n'est pas installé — impossible de forcer la luminosité système ;
              note honnête, même choix que la v1). QR sombre pour le contraste. */}
          <Animated.View
            style={[styles.qrScreen, sheetStyle]}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
          >
            {value !== null ? (
              <QRCode
                value={value}
                size={qrSize}
                color={colors.bg.base}
                backgroundColor="#FFFFFF"
              />
            ) : null}
            <Text style={styles.qrCaption}>Présentez ce code à l’accueil.</Text>
            <Text style={styles.qrDismiss}>Balayez vers le bas pour fermer</Text>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement (exception QR fond clair, justifiée)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  backDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.text.hi,
    marginTop: space.xs,
  },

  section: { marginTop: space.xl },
  cards: { gap: space.md, marginTop: space.md },

  // — Carte inscription à venir —
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  cardMain: { flex: 1, gap: space.xs },
  cardCircuit: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.mid,
  },
  cardDate: { fontFamily: typo.bodySemi, fontSize: 17, color: colors.text.hi },
  cardTime: { fontFamily: typo.body, fontSize: 13, color: colors.text.mid },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },

  // Fond clair NÉCESSAIRE à la lecture optique du QR (pas un décor, un code).
  qrChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.cell,
    padding: 6,
    alignItems: 'center',
    gap: 4,
  },
  cardSansQr: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  qrChipHint: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.bg.base,
  },

  // — Historique —
  historyCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    marginTop: space.md,
  },

  // — Vide —
  emptyBlock: { alignItems: 'center', paddingTop: space.xxl, gap: space.lg },
  emptyCta: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  emptyCtaLabel: { fontFamily: typo.bodyMedium, fontSize: 15, color: colors.text.hi },

  footnote: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.xxl,
  },

  // — QR plein écran —
  qrRoot: { flex: 1 },
  qrScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  qrCaption: { fontFamily: typo.bodySemi, fontSize: 15, color: colors.bg.base },
  qrDismiss: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.text.dim,
  },
});
