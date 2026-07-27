/**
 * BILAN DE SÉANCE — porte Miroir (V2-L1, écran 2/3). Route NOUVELLE du
 * groupe (app2) : `/bilan/[sessionId]`.
 *
 * Le rendez-vous post-piste. Données via useBilan (services existants,
 * allSettled, décisions pures dans bilanLogic — testées). DA Instrument :
 * zéro couleur hors tokens, aucun spinner (Shimmer), tout tappable en
 * PressScale, or Heritage réservé au chrono/record et à la note du coach.
 *
 * Entrée : HeroMorph si l'accueil a capturé la géométrie (id
 * `bilanHeroMorphId(sessionId)`), sinon repli porte — géré par
 * useHeroMorphTarget. Le bloc héros (cible du morph) est monté DÈS le mount,
 * pendant le chargement : le morph part au moment du geste, vers le héros
 * réel si l'accueil a passé `heroChronoMs`/`heroPhotoUrl`/`heroMeta` en
 * params de route (contrat OPTIONNEL — données déjà affichées au moment du
 * geste, source réelle), sinon vers son squelette. Le RESTE de l'écran entre
 * par la porte AU PASSAGE À 'ready' (DoorIn — la porte démarrerait sinon
 * pendant le skeleton et serait finie à l'arrivée des données).
 *
 * Célébration record : ChronoHero `celebrate` (front montant — RecordFlash +
 * haptic('record') intégrés) — UNE fois par séance TOUS écrans confondus
 * (garde partagée recordCelebration, posée par le hook).
 *
 * Doctrine : descriptif uniquement, vouvoiement, jamais de consigne. La voix
 * du coach est ATTRIBUÉE (bande or, bulles au liseré rouge) — jamais celle
 * de l'app.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BiometryStrip,
  ChronoHero,
  CondensingHeaderBar,
  HeroPhoto,
  ListRow,
  Photo,
  PillarBar,
  PressScale,
  SectionHeader,
  Sheet,
  Stagger,
  StateView,
  TraceCircuit,
  centerlineToTrace,
  clamp,
  colors,
  motionTokens,
  msToLapLabel,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  useCondensingHeader,
  useDoorTransition,
  useHeroMorphTarget,
  typo,
} from '@/ui/v2';
import {
  bilanHeroMorphId,
  DEBRIEF_PENDING_TEXT,
  lastThreadMessages,
  momentColor,
  viewerShouldDismiss,
  VIEWER_PAN_ZOOM_THRESHOLD,
} from '@/features/miroir/bilanLogic';
import { useBilan } from '@/features/miroir/useBilan';
import { exportAndShareBilanPdf } from '@/services/bilanPdfExportService';
import type { SessionMediaItem } from '@/services/sessionMediaService';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDateShort } from '@/utils/format';

const HERO_HEIGHT = 180;
const SOUVENIR_CELL = 64;

export default function BilanScreen() {
  const params = useLocalSearchParams<{
    sessionId?: string;
    heroChronoMs?: string;
    heroPhotoUrl?: string;
    heroMeta?: string;
  }>();
  const sessionId = params.sessionId;
  const insets = useSafeAreaInsets();
  // Identité de l'utilisateur COURANT — l'attribution des bulles du fil se
  // fait sur elle (jamais déduite du rôle coach du binôme).
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);

  const { status, data, reload, messages, sendReply } = useBilan(sessionId);

  const header = useCondensingHeader({ titleFrom: 14, titleTo: 12 });
  // Le héros arrive par HeroMorph (géométrie capturée à l'accueil) ; le
  // RESTE de l'écran entre par la porte AU PASSAGE À 'ready' (DoorIn).
  const morph = useHeroMorphTarget(bilanHeroMorphId(sessionId ?? 'session'));

  // Contrat OPTIONNEL accueil → bilan : les données déjà affichées au moment
  // du geste (chrono ms, photo signée, ligne méta — source réelle) peuvent
  // arriver en params de route pour que le héros RÉEL soit monté pendant le
  // chargement. Params absents ou invalides → squelette héros (honnête).
  const heroPreview = useMemo(() => {
    const ms = params.heroChronoMs ? Number(params.heroChronoMs) : Number.NaN;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return {
      bestLapMs: Math.round(ms),
      photoUrl: params.heroPhotoUrl || null,
      metaLine: params.heroMeta || null,
    };
  }, [params.heroChronoMs, params.heroPhotoUrl, params.heroMeta]);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [notePage, setNotePage] = useState(0);
  const [draft, setDraft] = useState('');
  const [sendFailed, setSendFailed] = useState(false);
  const [sending, setSending] = useState(false);

  const contextLine = useMemo(() => {
    if (!data) return '';
    const date = data.session.started_at ? formatDateShort(data.session.started_at) : null;
    return [date, data.session.circuit_name || null].filter(Boolean).join(' · ').toUpperCase();
  }, [data]);

  const heroPhoto = useMemo(
    () => data?.media.find((m) => m.mediaType === 'photo' && m.signedUrl) ?? null,
    [data?.media]
  );

  const souvenirPhotos = useMemo(
    () => (data?.media ?? []).filter((m) => m.mediaType === 'photo' && m.signedUrl),
    [data?.media]
  );

  const onExportPdf = useCallback(async () => {
    if (!sessionId || exporting) return;
    setExporting(true);
    setExportFailed(false);
    const res = await exportAndShareBilanPdf({ sessionId });
    setExporting(false);
    if (!res.ok) setExportFailed(true);
  }, [sessionId, exporting]);

  const onSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendFailed(false);
    const ok = await sendReply(body);
    setSending(false);
    if (ok) setDraft('');
    else setSendFailed(true);
  }, [draft, sending, sendReply]);

  // ── États non nominaux — jamais de spinner ────────────────────────────
  if (status !== 'ready' || !data) {
    if (status === 'loading') {
      // Le bloc héros (CIBLE HeroMorph) est monté DÈS le chargement, à la
      // position qu'il occupera à 'ready' : morph.onLayout part au moment du
      // geste (géométrie source fraîche), le chrono vole vers le héros réel
      // (params du geste) ou vers son squelette — jamais en retard, jamais
      // par-dessus un contenu déjà en place.
      const previewOverlay = heroPreview ? (
        <HeroOverlay
          data={{
            bestLapMs: heroPreview.bestLapMs,
            celebrate: false,
            metaLine: heroPreview.metaLine,
          }}
        />
      ) : null;
      return (
        <View style={styles.root}>
          <View style={{ paddingTop: insets.top + 48 + space.md }}>
            <Animated.View style={[styles.heroWrap, morph.style]}>
              <View ref={morph.ref} onLayout={morph.onLayout} collapsable={false}>
                {heroPreview ? (
                  heroPreview.photoUrl ? (
                    <HeroPhoto uri={heroPreview.photoUrl} height={HERO_HEIGHT}>
                      {previewOverlay}
                    </HeroPhoto>
                  ) : (
                    <View style={styles.heroBare}>
                      <View style={styles.heroBareContent}>{previewOverlay}</View>
                    </View>
                  )
                ) : (
                  <StateView state="loading" shape="hero" />
                )}
              </View>
            </Animated.View>
            {/* Le squelette n'est que du Shimmer, masqué aux lecteurs
                d'écran : sans ce libellé, l'écran est annoncé vide, sans dire
                qu'il charge. */}
            <View
              style={styles.stateWrap}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Chargement du bilan"
            >
              <StateView state="loading" shape="list" style={{ marginTop: space.xl }} />
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <View style={[styles.stateWrap, { paddingTop: insets.top + space.xl }]}>
          {status === 'error' ? (
            <StateView
              state="error"
              errorMessage="Le bilan n'a pas pu être chargé."
              onRetry={reload}
            />
          ) : (
            <StateView state="empty" emptyMessage="Cette séance est introuvable." />
          )}
        </View>
      </View>
    );
  }

  const noteCount = data.coachNotes.length;
  const note = noteCount > 0 ? data.coachNotes[Math.min(notePage, noteCount - 1)] : null;
  const bubbles = lastThreadMessages(messages, 3);
  const showSouvenirs = souvenirPhotos.length > 0 || data.videoOverlayEnabled;

  // Bande annotation coach — une note GÉNÉRIQUE (non rattachée à cette
  // séance) est étiquetée « REPÈRE GÉNÉRAL », jamais présentée comme une
  // note posée sur la séance du jour (les notes de séance passent d'abord,
  // ordre garanti par buildCoachNotes).
  const noteBand = note ? (
    <View>
      <Text style={styles.noteEyebrow}>
        {(note.generic ? 'REPÈRE GÉNÉRAL' : 'NOTE DU COACH') +
          (note.coachName ? ` · ${note.coachName.toUpperCase()}` : '')}
      </Text>
      <Text style={styles.noteCorner}>{note.cornerName}</Text>
      <Text style={styles.noteBody}>« {note.body} »</Text>
      {noteCount > 1 ? (
        <View style={styles.noteDots}>
          {data.coachNotes.map((n, i) => (
            <PressScale
              key={n.id}
              onPress={() => setNotePage(i)}
              accessibilityLabel={`Note ${i + 1} sur ${noteCount}`}
              // La puce affichée est signalée par la seule couleur : l'état doit
              // être dit.
              //
              // La cible est agrandie par du PADDING, jamais par hitSlop. Un
              // hitSlop déborde du cadre sans réserver d'espace : sur des puces
              // de 6 px espacées de 4, des zones élargies se RECOUVRENT, et
              // React Native teste les frères du dernier au premier — la
              // dernière puce raflait le toucher des précédentes, rendant la
              // première injoignable. Le padding, lui, est de la mise en page :
              // les cadres s'écartent réellement, aucun recouvrement possible.
              accessibilityState={{ selected: i === notePage }}
              style={styles.noteDotHit}
            >
              <View style={[styles.noteDot, i === notePage && styles.noteDotActive]} />
            </PressScale>
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={header.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 48 + space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        {/* ── Ouverture émotionnelle — le bloc qui voyage (HeroMorph) ──── */}
        <Animated.View style={[styles.heroWrap, morph.style]}>
          <View ref={morph.ref} onLayout={morph.onLayout} collapsable={false}>
            {heroPhoto?.signedUrl ? (
              <HeroPhoto uri={heroPhoto.signedUrl} height={HERO_HEIGHT}>
                <HeroOverlay data={data} />
              </HeroPhoto>
            ) : (
              <View style={styles.heroBare}>
                {/* Filigrane : le tracé réel du circuit, 8 %, derrière le chrono. */}
                <FiligreeTrace centerline={data.centerline} />
                <View style={styles.heroBareContent}>
                  <HeroOverlay data={data} />
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Le reste entre par la porte (démarrée au passage à ready) ── */}
        <DoorIn>
          {/* Carte tracé + puces + bande annotation coach (absente sans note) */}
          <View style={styles.section}>
            <SectionHeader eyebrow="LE TRACÉ" />
            <View style={styles.traceCard}>
              {data.centerline ? (
                <TraceCircuit
                  centerline={data.centerline}
                  height={190}
                  markers={data.traceMarkers.map((m) => ({ t: m.t, color: m.color }))}
                  annotationBand={noteBand ?? undefined}
                />
              ) : (
                <>
                  {/* Centerline STRICTE absente (séance sans circuit rattaché
                      ou géométrie manquante) : état honnête — jamais la
                      silhouette d'un AUTRE circuit sous le chrono. */}
                  <Text style={styles.traceUnavailable}>Tracé indisponible pour cette séance.</Text>
                  {noteBand ? <View style={styles.noteBandBare}>{noteBand}</View> : null}
                </>
              )}
            </View>
          </View>

          {/* Quatre piliers — branches QDI, « — » si non mesuré */}
          <View style={styles.section}>
            <SectionHeader eyebrow="QUATRE PILIERS" />
            <View style={styles.pillarStack}>
              {data.pillars.map((p) => (
                <PillarBar key={p.key} label={p.label} value={p.value} color={p.color} />
              ))}
            </View>
          </View>

          {/* Moments-clés — des faits, jamais des consignes */}
          {data.keyMoments.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader eyebrow="MOMENTS-CLÉS" count={data.keyMoments.length} />
              <Stagger>
                {data.keyMoments.map((m) => (
                  <View key={m.key} style={styles.momentRow}>
                    <View style={[styles.momentDot, { backgroundColor: momentColor(m.key) }]} />
                    <View style={styles.momentBody}>
                      <ListRow
                        label={m.title}
                        sublabel={m.fact}
                        // Lot L6 — la séance s'ouvre bien dans Data. L'ANCRE sur
                        // ce moment précis reste impossible : l'écran de séance
                        // ne lit que l'identifiant, pas de position. Le pilote
                        // arrive donc en haut de SA séance, pas sur ce moment.
                        onPress={() =>
                          router.navigate(`/(app2)/data/session/${sessionId}` as never)
                        }
                      />
                    </View>
                  </View>
                ))}
              </Stagger>
            </View>
          ) : null}

          {/* Biométrie — flag + consentement + données, sinon RIEN */}
          {data.biometry ? (
            <View style={styles.section}>
              <SectionHeader eyebrow="FRÉQUENCE CARDIAQUE" />
              <View style={styles.bioCard}>
                <BiometryStrip
                  samples={data.biometry.samples}
                  source={data.biometry.source}
                  quality={data.biometry.quality}
                />
              </View>
            </View>
          ) : null}

          {/* Debrief J+1 — 3 actes, ou l'attente dite simplement */}
          <View style={styles.section}>
            <SectionHeader eyebrow="DEBRIEF J+1" />
            <View style={styles.debriefCard}>
              {data.debrief.kind === 'pending' ? (
                // Texte UNIQUE : la constante testée de bilanLogic (jamais
                // dupliquée en dur — le grep doctrine porte sur une source).
                <Text style={styles.debriefPending}>{DEBRIEF_PENDING_TEXT}</Text>
              ) : (
                <>
                  {data.debrief.kind === 'generated' ? (
                    <Text style={styles.debriefProvenance}>
                      RÉCIT GÉNÉRÉ AUTOMATIQUEMENT À PARTIR DE VOTRE SÉANCE
                    </Text>
                  ) : null}
                  {data.debrief.acts.map((act, i) => (
                    <View key={act.title} style={i > 0 ? { marginTop: space.lg } : undefined}>
                      <Text style={styles.debriefActTitle} accessibilityRole="header">
                        {`ACTE ${i + 1} · ${act.title.toUpperCase()}`}
                      </Text>
                      <Text style={styles.debriefActBody}>{act.body}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>

          {/* Fil présentiel — la parole attribuée du binôme. Titre HONNÊTE :
              le fil couvre TOUS les échanges avec le coach (pas seulement
              cette séance) — aucune formulation « de la séance ». */}
          {data.thread ? (
            <View style={styles.section}>
              <SectionHeader
                eyebrow={`VOTRE FIL AVEC ${data.thread.otherName.toUpperCase()}`}
                count={bubbles.length > 0 ? bubbles.length : undefined}
              />
              {bubbles.length === 0 ? (
                <Text style={styles.threadEmpty}>Aucune note échangée pour le moment.</Text>
              ) : (
                <View style={styles.bubbleStack}>
                  {bubbles.map((msg) => {
                    // « VOUS » = l'identité AUTH courante — jamais déduite du
                    // rôle coach du binôme (un coach qui roule verrait sinon
                    // ses bulles attribuées au pilote, et inversement).
                    const mine = msg.senderId === myUserId;
                    return (
                      <View
                        key={msg.id}
                        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}
                      >
                        <Text style={styles.bubbleAuthor}>
                          {mine ? 'VOUS' : data.thread?.otherName.toUpperCase()}
                        </Text>
                        <Text style={styles.bubbleBody}>{msg.body}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.replyRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Votre réponse"
                  // text.low (pas dim) : sur bg.base, `dim` tombe à 2,8:1 —
                  // sous le seuil AA, pour le seul indice de ce que le champ
                  // attend. Même arbitrage que le « — » de PillarBar.
                  placeholderTextColor={colors.text.low}
                  style={styles.replyInput}
                  multiline
                  accessibilityLabel="Votre réponse au fil"
                />
                <PressScale
                  onPress={onSend}
                  disabled={sending || draft.trim().length === 0}
                  accessibilityLabel="Envoyer la réponse"
                  style={styles.replySend}
                >
                  <Text style={styles.replySendLabel}>{sending ? 'ENVOI' : 'ENVOYER'}</Text>
                </PressScale>
              </View>
              {sendFailed ? (
                <Text style={styles.sendFailed}>
                  La note n&apos;a pas pu partir. Réessayez dans un instant.
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Souvenirs — photos réelles de la séance */}
          {showSouvenirs ? (
            <View style={styles.section}>
              <SectionHeader
                eyebrow="SOUVENIRS"
                count={souvenirPhotos.length > 0 ? souvenirPhotos.length : undefined}
              />
              {/* FlashList horizontale : hauteur bornée obligatoire. */}
              <View style={styles.souvenirTrack}>
                <FlashList
                  horizontal
                  data={souvenirPhotos}
                  keyExtractor={(item: SessionMediaItem) => item.id}
                  showsHorizontalScrollIndicator={false}
                  ListFooterComponent={
                    data.videoOverlayEnabled ? (
                      <View style={styles.videoCell}>
                        <Text style={styles.videoCellLabel}>◉ VIDÉO DU TOUR</Text>
                      </View>
                    ) : null
                  }
                  renderItem={({ item, index }: { item: SessionMediaItem; index: number }) => (
                    <Animated.View entering={staggerEntering(index)} style={styles.souvenirCell}>
                      <PressScale
                        onPress={() => setViewerUri(item.signedUrl ?? null)}
                        accessibilityLabel={item.caption ?? 'Photo de la séance'}
                      >
                        <Photo
                          uri={item.signedUrl as string}
                          recyclingKey={item.id}
                          style={styles.souvenirPhoto}
                        />
                      </PressScale>
                    </Animated.View>
                  )}
                />
              </View>
            </View>
          ) : null}

          {/* Footer — l'unique rangée accentuée de la zone */}
          <View style={styles.section}>
            <View style={styles.footerRow}>
              <ListRow
                label="Ouvrir dans Data"
                divider={false}
                // Lot L6 — dette levée : la séance elle-même, plus la porte Data.
                onPress={() => router.navigate(`/(app2)/data/session/${sessionId}` as never)}
                accessibilityLabel="Ouvrir cette séance dans Data"
              />
            </View>
          </View>
        </DoorIn>
      </Animated.ScrollView>

      {/* Fond blur de la barre condensée — fondu au scroll, sous les contrôles */}
      <CondensingHeaderBar condensedStyle={header.condensedStyle} height={insets.top + 48} />

      {/* Contrôles FIXES du header : back · {date} · {circuit} mono · partage.
          Toujours tappables — seule la barre blur apparaît/disparaît dessous. */}
      <View style={[styles.headerFixed, { height: insets.top + 48, paddingTop: insets.top }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Glyphe 20 × 20 : hitSlop 12 porte la cible à 44 × 44.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {contextLine}
        </Text>
        <PressScale
          onPress={() => setSheetVisible(true)}
          accessibilityLabel="Partager ce bilan"
          // Glyphe 20 × 20 : hitSlop 12 porte la cible à 44 × 44.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ShareGlyph />
        </PressScale>
      </View>

      {/* Sheet export — PDF v1 + carte trophée v1, réutilisés tels quels */}
      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)} snapHeight={280}>
        <SectionHeader eyebrow="PARTAGER" />
        <ListRow
          icon="data"
          label={exporting ? 'Préparation du PDF' : 'Partager en PDF'}
          sublabel="Le bilan complet, à envoyer"
          disabled={exporting}
          onPress={onExportPdf}
        />
        <ListRow
          icon="insigne"
          label="Carte trophée"
          sublabel="La carte à partager de la séance"
          divider={false}
          onPress={() => {
            setSheetVisible(false);
            router.push(`/(app)/carte-trophee?sessionId=${sessionId}` as never);
          }}
        />
        {exportFailed ? (
          <Text style={styles.sendFailed}>
            Le PDF n&apos;a pas pu être généré. Réessayez dans un instant.
          </Text>
        ) : null}
      </Sheet>

      {/* Viewer plein écran — pinch + dismiss swipe bas */}
      {viewerUri ? <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} /> : null}
    </View>
  );
}

/**
 * La porte de l'écran, démarrée au MONTAGE de ce bloc — c'est-à-dire au
 * passage à 'ready' (le withTiming de useDoorTransition part au mount du
 * hook) : appelée au niveau de l'écran, la porte jouerait pendant le
 * skeleton et serait déjà finie quand les données arrivent (contenu qui
 * pop sans fondu).
 */
function DoorIn({ children }: { children: ReactNode }) {
  const door = useDoorTransition(60);
  return <Animated.View style={door}>{children}</Animated.View>;
}

/** Superposé du héros : eyebrow BILAN, chrono roi, faits de séance. */
function HeroOverlay({
  data,
}: {
  data: {
    bestLapMs: number | null;
    celebrate: boolean;
    metaLine: string | null;
  };
}) {
  return (
    // Le chiffre roi de l'écran, lu d'un seul tenant : sans regroupement,
    // « BILAN », le chrono nu (sans dire de quelle donnée il s'agit) et la
    // ligne méta arrivent en trois fragments sans lien. Le « — » de l'absence
    // se dit « non mesuré » — un tiret n'est pas un mot.
    <View
      accessible
      accessibilityLabel={`Bilan, meilleur tour ${
        data.bestLapMs !== null ? msToLapLabel(data.bestLapMs) : 'non mesuré'
      }${data.metaLine ? `. ${data.metaLine}` : ''}`}
    >
      <Text style={styles.heroEyebrow}>BILAN</Text>
      {data.bestLapMs !== null ? (
        <ChronoHero chronoMs={data.bestLapMs} size="l" celebrate={data.celebrate} />
      ) : (
        <Text style={styles.heroNoChrono}>—</Text>
      )}
      {data.metaLine ? <Text style={styles.heroMeta}>{data.metaLine}</Text> : null}
    </View>
  );
}

/**
 * Filigrane : le tracé RÉEL du circuit en trait `text.dim` à 8 %, derrière
 * le chrono quand la séance n'a pas de photo. Centerline absente → rien
 * (jamais une silhouette inventée).
 */
function FiligreeTrace({
  centerline,
}: {
  centerline: readonly { lat: number; lon: number }[] | null;
}) {
  const [width, setWidth] = useState(0);
  const trace = useMemo(
    () =>
      centerline && width > 0
        ? centerlineToTrace(centerline, width, HERO_HEIGHT, 18)
        : { path: '', points: [] },
    [centerline, width]
  );
  return (
    <View
      style={styles.filigree}
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {trace.path !== '' ? (
        <Canvas style={{ width, height: HERO_HEIGHT }}>
          <Path
            path={trace.path}
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
            strokeJoin="round"
            color={colors.text.dim}
          />
        </Canvas>
      ) : null}
    </View>
  );
}

/**
 * Viewer photo plein écran : pinch pour zoomer (1×-4×), pan pour déplacer
 * une photo zoomée (rappel dans les bornes), swipe vers le bas pour fermer
 * (décision pure viewerShouldDismiss, testée). Bouton Fermer DANS la vue
 * accessibilityViewIsModal (patron Sheet — hors d'elle, VoiceOver ignore
 * les frères et piège le lecteur).
 *
 * Rendu dans un Modal RN TRANSPARENT : c'est le seul rendu qui recouvre
 * AUSSI le header fixe (zIndex 11), la CondensingHeaderBar (zIndex 10) ET
 * la TabBar rendue par le _layout au-dessus du Stack — un zIndex local ne
 * peut pas gagner contre des frères d'un autre sous-arbre. Le Modal gère en
 * prime le bouton back Android (onRequestClose). GestureHandlerRootView
 * OBLIGATOIRE à l'intérieur : les gestes RNGH ne traversent pas un Modal
 * (Android) sans leur propre racine.
 */
function PhotoViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          scale.value = clamp(savedScale.value * e.scale, 1, 4);
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          // MÊME seuil que le pan (VIEWER_PAN_ZOOM_THRESHOLD) : aucune zone
          // morte 1.02-1.05 où l'échelle resterait « presque 1 » avec des
          // translations sauvegardées orphelines (photo coincée de biais).
          if (scale.value <= VIEWER_PAN_ZOOM_THRESHOLD) {
            scale.value = withSpring(1, motionTokens.spring);
            savedScale.value = 1;
            tx.value = withSpring(0, motionTokens.spring);
            ty.value = withSpring(0, motionTokens.spring);
            savedTx.value = 0;
            savedTy.value = 0;
          }
        }),
    [scale, savedScale, tx, ty, savedTx, savedTy]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          if (scale.value > VIEWER_PAN_ZOOM_THRESHOLD) {
            tx.value = savedTx.value + e.translationX;
            ty.value = savedTy.value + e.translationY;
          } else {
            // Non zoomé : seul le tirage vers le bas compte (dismiss).
            ty.value = Math.max(0, e.translationY);
          }
        })
        .onEnd((e) => {
          if (scale.value > VIEWER_PAN_ZOOM_THRESHOLD) {
            // Rappel dans les bornes : l'image ne se gare jamais hors écran
            // (débord max = moitié du surplus d'échelle de chaque côté).
            const maxTx = (winW * (scale.value - 1)) / 2;
            const maxTy = (winH * (scale.value - 1)) / 2;
            const cx = clamp(tx.value, -maxTx, maxTx);
            const cy = clamp(ty.value, -maxTy, maxTy);
            if (cx !== tx.value) tx.value = withSpring(cx, motionTokens.spring);
            if (cy !== ty.value) ty.value = withSpring(cy, motionTokens.spring);
            savedTx.value = cx;
            savedTy.value = cy;
            return;
          }
          if (viewerShouldDismiss(ty.value, e.velocityY)) {
            runOnJS(onClose)();
          } else {
            ty.value = withSpring(0, motionTokens.spring);
          }
        }),
    [scale, tx, ty, savedTx, savedTy, onClose, winW, winH]
  );

  const composed = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Le fond suit le tirage (manipulation directe, pas une animation).
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - clamp(ty.value / 480, 0, 0.5),
  }));

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.viewerRoot}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.viewerBackdrop, backdropStyle]}
        />
        <GestureDetector gesture={composed}>
          <Animated.View
            style={styles.viewerBody}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
          >
            <Animated.View style={[styles.viewerImageWrap, imageStyle]}>
              <Photo
                uri={uri}
                contentFit="contain"
                style={styles.viewerImage}
                accessibilityLabel="Photo de la séance, plein écran"
              />
            </Animated.View>
            {/* FERMER DANS la vue modale a11y (patron Sheet) : focusable au
                lecteur d'écran, en plus du geste d'échappement. */}
            <View style={[styles.viewerClose, { top: insets.top + space.md }]}>
              <PressScale
                onPress={onClose}
                accessibilityLabel="Fermer la photo"
                // Libellé mono 11 px (~13 pts de haut) : hitSlop 16 porte la
                // cible à 45 dans la hauteur.
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Text style={styles.viewerCloseLabel}>FERMER</Text>
              </PressScale>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Chevron retour, trait 1.8 comme le chevron du ListRow. */
function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <SvgPath
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

/** Glyphe partage (flèche sortante d'un plateau), au trait 1.6. */
function ShareGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <SvgPath
        d="M12 3.5 L12 14.5 M12 3.5 L8.5 7 M12 3.5 L15.5 7"
        stroke={colors.text.hi}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
      <SvgPath
        d="M5 11 L5 18.5 C5 19.6 5.9 20.5 7 20.5 L17 20.5 C18.1 20.5 19 19.6 19 18.5 L19 11"
        stroke={colors.text.hi}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text.mid,
    textAlign: 'center',
  },
  heroWrap: {
    paddingHorizontal: space.xl,
  },
  heroBare: {
    height: HERO_HEIGHT,
    borderRadius: radius.hero,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroBareContent: {
    padding: space.lg,
  },
  filigree: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  heroEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    marginBottom: space.xs,
  },
  heroNoChrono: {
    fontFamily: typo.monoSemi,
    fontSize: 56,
    color: colors.text.low,
  },
  heroMeta: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  section: {
    paddingHorizontal: space.xl,
    marginTop: space.xxl,
  },
  traceCard: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  traceUnavailable: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    paddingVertical: space.md,
  },
  // Bande annotation hors TraceCircuit (tracé indisponible) : même signal
  // que la bande du kit — bord OR Heritage 2 px, réservé à la parole du coach.
  noteBandBare: {
    marginTop: space.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.heritage.gold,
    paddingLeft: space.md,
    paddingVertical: space.sm,
  },
  noteEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.heritage.gold,
  },
  noteCorner: {
    fontFamily: typo.bodySemi,
    fontSize: 14,
    color: colors.text.hi,
    marginTop: space.xs,
  },
  noteBody: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.heritage.text,
    marginTop: space.xs,
  },
  noteDots: {
    flexDirection: 'row',
    // L'écart visuel entre puces vient désormais du padding de leur cible
    // tactile (noteDotHit), pas d'un gap : sans cela les deux s'additionneraient.
    gap: 0,
    marginTop: space.sm,
  },
  /**
   * Cible tactile de la puce : 44 px de haut (aucun voisin vertical), et
   * 6 + 2 × 8 = 22 px de large. La largeur reste sous 44 parce que des puces
   * plus écartées cesseraient de se lire comme un indicateur de pagination —
   * la contrainte est celle du motif, pas un oubli. L'essentiel est tenu :
   * chaque puce est atteignable, aucune ne vole le toucher d'une autre.
   */
  noteDotHit: {
    paddingVertical: 19,
    paddingHorizontal: space.sm,
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border.strong,
  },
  noteDotActive: {
    backgroundColor: colors.heritage.gold,
  },
  pillarStack: {
    marginTop: space.lg,
    gap: space.lg,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  momentDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  momentBody: {
    flex: 1,
  },
  bioCard: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  debriefCard: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.lg,
  },
  debriefProvenance: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginBottom: space.md,
  },
  debriefPending: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
  },
  debriefActTitle: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.text.low,
    marginBottom: space.xs,
  },
  debriefActBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
  },
  threadEmpty: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.lg,
  },
  bubbleStack: {
    marginTop: space.lg,
    gap: space.sm,
  },
  bubble: {
    borderRadius: radius.cell,
    padding: space.md,
  },
  bubbleCoach: {
    backgroundColor: colors.bg.card,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  bubbleMine: {
    backgroundColor: colors.bg.card2,
  },
  bubbleAuthor: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginBottom: 2,
  },
  bubbleBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.hi,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    marginTop: space.md,
  },
  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.hi,
  },
  replySend: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  replySendLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text.hi,
  },
  sendFailed: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  souvenirTrack: {
    height: SOUVENIR_CELL,
    marginTop: space.lg,
  },
  souvenirCell: {
    marginRight: space.sm,
  },
  souvenirPhoto: {
    width: SOUVENIR_CELL,
    height: SOUVENIR_CELL,
    borderRadius: radius.cell,
  },
  videoCell: {
    height: SOUVENIR_CELL,
    borderRadius: radius.cell,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  videoCellLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.mid,
  },
  footerRow: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  viewerRoot: {
    flex: 1,
  },
  viewerBackdrop: {
    backgroundColor: colors.bg.base,
  },
  viewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImageWrap: {
    width: '100%',
    height: '100%',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerClose: {
    position: 'absolute',
    right: space.xl,
  },
  viewerCloseLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
});
