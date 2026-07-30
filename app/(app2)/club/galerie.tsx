/**
 * GALERIE — porte Club (V2-L5 CLUB, Mission D, écran 6/7 · l'écran émotion).
 * Route NOUVELLE : `/(app2)/club/galerie`.
 *
 * Deux onglets :
 *   - Galerie : mosaïque 2 colonnes (masonry) de TOUS vos médias, groupés par
 *     séance (en-têtes date/circuit collants discrets), Stagger, Photo blurhash.
 *     Une photo s'ouvre en viewer plein écran (pinch, swipe horizontal entre
 *     photos, dismiss vers le bas — même patron que le Bilan L1, rendu dans un
 *     Modal au-dessus de la TabBar). Cellule « ◉ VIDÉO DU TOUR » seulement si
 *     le flag video_overlay est actif.
 *   - Partages : carte-souvenir (view-shot, chrono + tracé or sur titane —
 *     TrophyCard v1 réutilisée), Carnet Heritage (C3, tier Heritage UNIQUEMENT
 *     — sinon ABSENT, pas teasé), et les liens de partage scopés révocables.
 *
 * Données RÉELLES uniquement (useGalerie) ; décisions pures dans galerieLogic
 * (groupement, mosaïque, gating vidéo/Heritage) — testées. DA Instrument : zéro
 * couleur hors tokens v2, aucun spinner (StateView), tout tappable en PressScale,
 * or Heritage réservé au Carnet, or chrono réservé à la carte-souvenir.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import {
  Button,
  Chip,
  Dial,
  HeritageBand,
  ListRow,
  Photo,
  PressScale,
  SectionHeader,
  StateView,
  Sheet,
  clamp,
  colors,
  haptic,
  motionTokens,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import {
  heritageBookVisible,
  videoOverlayCellVisible,
  type GalleryRow,
} from '@/features/club/galerieLogic';
import { useGalerie } from '@/features/club/useGalerie';
import { useHeritageBook } from '@/features/club/useHeritageBook';
import { VIEWER_PAN_ZOOM_THRESHOLD, viewerShouldDismiss } from '@/features/miroir/bilanLogic';
import { TrophyCard } from '@/components/TrophyCard';
import {
  SHAREABLE_METRICS,
  createShare,
  revokeShare,
  sanitizeIncludedMetrics,
  shareUrlFor,
  type ShareLink,
  type ShareScope,
} from '@/services/sharesService';
import type { SessionMediaItem } from '@/services/sessionMediaService';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDateShort } from '@/utils/format';

type Tab = 'galerie' | 'partages';

const GRID_GUTTER = space.sm;

const SCOPES: { key: ShareScope; label: string }[] = [
  { key: 'last_session', label: 'Dernière séance' },
  { key: 'last_5_sessions', label: '5 dernières séances' },
  { key: 'progression_only', label: 'Progression seule' },
  { key: 'full_history', label: "Tout l'historique" },
];

function scopeLabel(scope: ShareScope): string {
  return SCOPES.find((s) => s.key === scope)?.label ?? 'Partage';
}

/**
 * Durées d'expiration offertes — décision fondateur du 29/07/2026.
 *
 * L'écran V1 `app/(app)/partage.tsx` en proposait TROIS : 7 jours, 30 jours et
 * « sans limite ». Le portage n'en retient que deux : **tout lien finit par
 * expirer**, conformément à l'esprit de minimisation de l'article 25 déjà porté
 * à l'avocat.
 *
 * Ce qui existait ici avant ce portage était pire que « sans limite » : la
 * galerie appelait `createShare({ scope })` sans durée du tout, et
 * `sharesService.ts` ne pose `expires_at` que si `expiresInDays` est fourni.
 * Tout lien créé depuis app2 n'expirait donc JAMAIS, sans que personne ne
 * l'ait choisi.
 */
const DUREES: { days: number; label: string }[] = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
];

export default function GalerieScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const g = useGalerie(userId);
  const heritageBook = useHeritageBook();

  const [tab, setTab] = useState<Tab>('galerie');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [shareSheet, setShareSheet] = useState(false);
  const [creating, setCreating] = useState(false);
  // Le lien se COMPOSE avant d'exister : portée, durée, données exposées.
  // Défaut des métriques = ensemble VIDE — le pilote construit son partage
  // activement, il ne retire pas ce qu'on aurait coché pour lui (RGPD §2.2).
  const [shareScope, setShareScope] = useState<ShareScope | null>(null);
  const [shareDays, setShareDays] = useState<number>(DUREES[0].days);
  const [shareMetrics, setShareMetrics] = useState<string[]>([]);
  const [shareErreur, setShareErreur] = useState<string | null>(null);
  const door = useDoorTransition();

  const { width: winW } = useWindowDimensions();
  const contentWidth = winW - 2 * space.xl;
  const colWidth = (contentWidth - GRID_GUTTER) / 2;

  // Index d'une photo (id) dans la liste ouvrable — pour lancer le viewer au
  // bon endroit. Les vidéos / photos sans URL n'y figurent pas (non ouvrables).
  const photoIndexById = useMemo(() => {
    const map = new Map<string, number>();
    g.photos.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [g.photos]);

  // Méta par séance pour l'info bas du viewer (circuit · date) — donnée réelle.
  const metaBySession = useMemo(() => {
    const map: Record<string, { circuitName: string | null; dateIso: string | null }> = {};
    for (const sec of g.sections) {
      map[sec.sessionId] = { circuitName: sec.circuitName, dateIso: sec.dateIso };
    }
    return map;
  }, [g.sections]);

  const activeShares = useMemo(
    () =>
      g.shares.filter(
        (s) =>
          s.revokedAt === null &&
          (s.expiresAt === null || new Date(s.expiresAt).getTime() > Date.now())
      ),
    [g.shares]
  );

  const toggleShareMetric = useCallback((key: string) => {
    setShareMetrics((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  }, []);

  // Un lien sans métrique n'expose rien : le créer n'aurait aucun sens, et
  // c'est la garde que portait déjà l'écran V1.
  const shareReady = shareScope !== null && shareMetrics.length > 0;

  /** Ramène le composeur à zéro — appelé à la fermeture, quelle qu'en soit la cause. */
  const reinitialiserComposeur = useCallback(() => {
    setShareScope(null);
    setShareDays(DUREES[0].days);
    setShareMetrics([]);
    setShareErreur(null);
  }, []);

  const fermerComposeur = useCallback(() => {
    setShareSheet(false);
    // La composition ne survit PAS à la feuille, y compris quand elle est
    // abandonnée : rouvrir doit repartir d'un choix explicite. Sans cela, des
    // métriques cochées puis oubliées se retrouveraient dans le lien suivant.
    reinitialiserComposeur();
  }, [reinitialiserComposeur]);

  const onCreateShare = useCallback(() => {
    if (creating || shareScope === null || shareMetrics.length === 0) return;
    setCreating(true);
    setShareErreur(null);
    createShare({
      scope: shareScope,
      expiresInDays: shareDays,
      includedMetrics: sanitizeIncludedMetrics(shareMetrics),
    })
      .then((link) => {
        if (link) {
          g.reloadShares();
          setShareSheet(false);
          reinitialiserComposeur();
          return;
        }
        // ÉCHEC. La feuille RESTE ouverte et le dit. La fermer comme si de rien
        // n'était laisserait le pilote croire qu'un lien existe — et il
        // partagerait une adresse qui n'a jamais été créée.
        setShareErreur(
          "Le lien n'a pas pu être créé. Réessayez quand votre connexion sera revenue."
        );
      })
      .finally(() => setCreating(false));
  }, [creating, shareScope, shareDays, shareMetrics, g, reinitialiserComposeur]);

  const onRevoke = useCallback(
    (id: string) => {
      revokeShare(id).then((ok) => {
        if (ok) g.reloadShares();
      });
    },
    [g]
  );

  const onOpenShareLink = useCallback((sh: ShareLink) => {
    const url = shareUrlFor(sh.token);
    Share.share({ message: `Ma progression OXV — ${url}`, url }).catch(() => undefined);
  }, []);

  // ── Rendu de la grille ────────────────────────────────────────────────
  const renderRow = useCallback(
    ({ item }: { item: GalleryRow<SessionMediaItem> }) => {
      if (item.kind === 'header') {
        const line =
          [item.dateIso ? formatDateShort(item.dateIso) : null, item.circuitName]
            .filter(Boolean)
            .join(' · ')
            .toUpperCase() || 'SÉANCE';
        return (
          <View
            style={styles.gridHeader}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${line}, ${item.count}`}
          >
            <Text style={styles.gridHeaderText} numberOfLines={1}>
              {line}
            </Text>
            <Text style={styles.gridHeaderCount}>{item.count}</Text>
          </View>
        );
      }
      let staggerIndex = 0;
      return (
        <View style={styles.bodyRow}>
          {item.columns.map((col, ci) => (
            <View key={ci} style={styles.col}>
              {col.map((media) => {
                const idx = photoIndexById.get(media.id);
                const openable = idx !== undefined && media.signedUrl != null;
                const si = staggerIndex++;
                return (
                  <Tile
                    key={media.id}
                    media={media}
                    width={colWidth}
                    staggerIndex={si}
                    onOpen={openable ? () => setViewerIndex(idx as number) : undefined}
                  />
                );
              })}
            </View>
          ))}
        </View>
      );
    },
    [colWidth, photoIndexById]
  );

  const galleryTab = (
    <View style={styles.tabBody}>
      {videoOverlayCellVisible(g.videoOverlayEnabled) ? (
        <View style={[styles.videoCell, { marginHorizontal: space.xl }]}>
          <Text style={styles.videoCellLabel}>◉ VIDÉO DU TOUR</Text>
        </View>
      ) : null}

      {g.status === 'loading' ? (
        <View style={styles.stateWrap}>
          <StateView state="loading" shape="list" />
        </View>
      ) : g.status === 'error' ? (
        <View style={styles.stateWrap}>
          <StateView
            state="error"
            errorMessage="Vos souvenirs n'ont pas pu être chargés."
            onRetry={g.reload}
          />
        </View>
      ) : g.media.length === 0 ? (
        <View style={styles.stateWrap}>
          <StateView
            state="empty"
            emptyMessage="Vos photos et vidéos de roulage apparaîtront ici. Elles sont déposées par OXV après chaque journée sur circuit."
          />
        </View>
      ) : (
        <FlashList
          data={g.rows}
          keyExtractor={(row) => `${row.kind}-${row.sessionId}`}
          getItemType={(row) => row.kind}
          stickyHeaderIndices={g.stickyHeaderIndices}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          style={styles.fill}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
          }}
        />
      )}
    </View>
  );

  const partagesTab = (
    <PartagesTab
      trophy={g.trophy}
      year={g.year}
      showHeritage={heritageBookVisible(g.heritage)}
      heritageBook={heritageBook}
      shares={activeShares}
      onOpenShareLink={onOpenShareLink}
      onRevoke={onRevoke}
      onCreate={() => setShareSheet(true)}
      bottomInset={tabBarSpace(insets.bottom)}
    />
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.fill, door]}>
        <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
          <Text style={styles.eyebrow}>VOS SOUVENIRS</Text>
          <Text style={styles.title} accessibilityRole="header">
            GALERIE
          </Text>
          <View style={styles.tabs}>
            <Chip
              label="Galerie"
              icon="camera"
              active={tab === 'galerie'}
              onPress={() => {
                haptic('tap');
                setTab('galerie');
              }}
            />
            <Chip
              label="Partages"
              icon="insigne"
              active={tab === 'partages'}
              onPress={() => {
                haptic('tap');
                setTab('partages');
              }}
            />
          </View>
        </View>

        <View style={styles.content}>{tab === 'galerie' ? galleryTab : partagesTab}</View>
      </Animated.View>

      {viewerIndex !== null ? (
        <GalleryViewer
          photos={g.photos}
          metaBySession={metaBySession}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}

      <Sheet visible={shareSheet} onClose={fermerComposeur} snapHeight={620}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionHeader eyebrow="CRÉER UN LIEN" />
          <Text style={styles.sheetNote}>
            Un lien public, révocable à tout moment. Seules des données factuelles — jamais de
            jugement — sont exposées.
          </Text>

          <SectionHeader eyebrow="CE QUE LE LIEN COUVRE" />
          {SCOPES.map((sc, i) => (
            <ListRow
              key={sc.key}
              label={sc.label}
              divider={i < SCOPES.length - 1}
              disabled={creating}
              chevron={false}
              value={shareScope === sc.key ? 'CHOISI' : undefined}
              onPress={() => setShareScope(sc.key)}
            />
          ))}

          <SectionHeader eyebrow="JUSQU'À QUAND" />
          <View style={styles.sheetChips}>
            {DUREES.map((d) => (
              <Chip
                key={d.days}
                label={d.label}
                active={shareDays === d.days}
                onPress={() => setShareDays(d.days)}
              />
            ))}
          </View>
          <Text style={styles.sheetNote}>
            Passé ce délai, le lien cesse de répondre. Aucun partage ne reste ouvert indéfiniment.
          </Text>

          <SectionHeader eyebrow="CE QUI EST EXPOSÉ" />
          <View style={styles.sheetChips}>
            {SHAREABLE_METRICS.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                active={shareMetrics.includes(m.key)}
                onPress={() => toggleShareMetric(m.key)}
              />
            ))}
          </View>
          <Text style={styles.sheetNote}>
            Rien n&apos;est coché par défaut : vous ajoutez ce que vous acceptez de montrer.
          </Text>

          {shareErreur !== null ? <Text style={styles.sheetErreur}>{shareErreur}</Text> : null}

          <View style={styles.sheetAction}>
            <Button
              label="Créer le lien"
              onPress={onCreateShare}
              disabled={!shareReady}
              loading={creating}
              accessibilityLabel={
                shareReady
                  ? 'Créer le lien de partage'
                  : 'Créer le lien de partage — choisissez une portée et au moins une donnée'
              }
            />
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Onglet Partages
// ---------------------------------------------------------------------------

function PartagesTab({
  trophy,
  year,
  showHeritage,
  heritageBook,
  shares,
  onOpenShareLink,
  onRevoke,
  onCreate,
  bottomInset,
}: {
  trophy: ReturnType<typeof useGalerie>['trophy'];
  year: number;
  showHeritage: boolean;
  heritageBook: ReturnType<typeof useHeritageBook>;
  shares: ShareLink[];
  onOpenShareLink: (sh: ShareLink) => void;
  onRevoke: (id: string) => void;
  onCreate: () => void;
  bottomInset: number;
}) {
  const trophyRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const onShareTrophy = useCallback(async () => {
    if (sharing || !trophy) return;
    setSharing(true);
    try {
      const uri = await captureRef(trophyRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Partager ma carte OXV',
          UTI: 'public.png',
        });
      }
    } catch {
      // Feuille fermée ou capture impossible : rien à remonter.
    } finally {
      setSharing(false);
    }
  }, [sharing, trophy]);

  const progressPct = heritageBook.progress !== null ? Math.round(heritageBook.progress * 100) : 0;

  return (
    <ScrollView
      style={styles.fill}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: bottomInset + space.xxl }}
    >
      <View>
        {/* Carte-souvenir — chrono + tracé or sur titane (view-shot). */}
        <View style={styles.section}>
          <SectionHeader eyebrow="CARTE-SOUVENIR" />
          {trophy ? (
            <>
              <View style={styles.trophyWrap}>
                <TrophyCard
                  ref={trophyRef}
                  bestLapLabel={trophy.bestLapLabel}
                  circuitName={trophy.circuitName}
                  dateLabel={trophy.dateLabel}
                  subLabel={trophy.subLabel}
                  tracePoints={trophy.tracePoints}
                />
              </View>
              <PressScale
                onPress={onShareTrophy}
                disabled={sharing}
                accessibilityLabel="Partager la carte-souvenir"
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnLabel}>{sharing ? 'PRÉPARATION…' : 'PARTAGER'}</Text>
              </PressScale>
            </>
          ) : (
            <StateView
              state="empty"
              emptyMessage="Aucune séance à mettre en carte pour l'instant."
            />
          )}
        </View>

        {/* C3 Carnet Heritage — tier Heritage UNIQUEMENT (sinon absent). */}
        {showHeritage ? (
          <View style={styles.section}>
            <HeritageBand label={`VOTRE SAISON ${year}`}>
              <Text style={styles.heritageBody}>
                Un livret relié de votre saison — chrono, tracé, piliers, photos. Gravé pour durer.
              </Text>
              <View style={styles.heritageRow}>
                {heritageBook.generating ? (
                  <Dial value={progressPct} max={100} size="s" label="Génération" unit="%" />
                ) : (
                  <PressScale
                    onPress={heritageBook.generate}
                    accessibilityLabel="Générer le Carnet Heritage"
                    containerStyle={styles.heritageBtnContainer}
                    style={styles.heritageBtn}
                  >
                    <Text style={styles.heritageBtnLabel}>GÉNÉRER LE CARNET</Text>
                  </PressScale>
                )}
              </View>
              {heritageBook.error ? <Text style={styles.errText}>{heritageBook.error}</Text> : null}
            </HeritageBand>
          </View>
        ) : null}

        {/* Liens de partage scopés — révocables. */}
        <View style={styles.section}>
          <SectionHeader
            eyebrow="LIENS DE PARTAGE"
            count={shares.length > 0 ? shares.length : undefined}
          />
          <View style={styles.card}>
            {shares.length === 0 ? (
              <StateView
                state="empty"
                emptyMessage="Aucun lien actif. Créez-en un pour partager votre progression."
              />
            ) : (
              shares.map((sh, i) => (
                <ListRow
                  key={sh.id}
                  label={scopeLabel(sh.scope)}
                  sublabel={shareSubLabel(sh)}
                  divider={i < shares.length - 1}
                  onPress={() => onOpenShareLink(sh)}
                  // Le rôle bouton porte déjà l'action : le libellé dit ce que
                  // la ligne MONTRE (portée + vues + expiration).
                  accessibilityLabel={`${scopeLabel(sh.scope)}, ${shareSubLabel(sh)}`}
                  right={
                    <PressScale
                      onPress={() => onRevoke(sh.id)}
                      accessibilityLabel="Révoquer ce lien"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.revoke}>Révoquer</Text>
                    </PressScale>
                  }
                />
              ))
            )}
            <ListRow
              icon="insigne"
              label="Créer un lien de partage"
              divider={false}
              onPress={onCreate}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function shareSubLabel(sh: ShareLink): string {
  const parts: string[] = [];
  parts.push(`${sh.viewCount} ${sh.viewCount > 1 ? 'vues' : 'vue'}`);
  if (sh.expiresAt !== null) parts.push(`expire le ${formatDateShort(sh.expiresAt)}`);
  else parts.push('sans expiration');
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Tuile de la mosaïque
// ---------------------------------------------------------------------------

function Tile({
  media,
  width,
  staggerIndex,
  onOpen,
}: {
  media: SessionMediaItem;
  width: number;
  staggerIndex: number;
  onOpen?: () => void;
}) {
  const aspect =
    typeof media.widthPx === 'number' &&
    typeof media.heightPx === 'number' &&
    media.widthPx > 0 &&
    media.heightPx > 0
      ? media.heightPx / media.widthPx
      : 1;
  const isVideo = media.mediaType === 'video';

  return (
    <Animated.View entering={staggerEntering(staggerIndex)}>
      <PressScale
        onPress={onOpen}
        disabled={onOpen === undefined}
        accessibilityLabel={
          media.caption ?? (isVideo ? 'Vidéo de la séance' : 'Photo de la séance')
        }
      >
        <View style={[styles.tile, { width, aspectRatio: aspect }]}>
          {media.signedUrl ? (
            <Photo
              uri={media.signedUrl}
              recyclingKey={media.id}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={styles.tilePlaceholder}>
              <Text style={styles.tilePlaceholderMark}>—</Text>
            </View>
          )}
          {isVideo ? (
            <View style={styles.videoBadge}>
              <Text style={styles.videoBadgeText}>Vidéo</Text>
            </View>
          ) : null}
        </View>
      </PressScale>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Viewer plein écran — pinch + swipe horizontal entre photos + dismiss bas
// ---------------------------------------------------------------------------

interface ViewablePhotoLite {
  id: string;
  uri: string;
  sessionId: string;
}

/**
 * Viewer rendu dans un Modal RN (au-dessus de la TabBar, comme le viewer du
 * Bilan L1). Paging horizontal via une FlatList (natif, fiable) ; chaque page
 * porte son pinch-zoom et son dismiss vers le bas (décisions pures réutilisées
 * du Bilan : viewerShouldDismiss / VIEWER_PAN_ZOOM_THRESHOLD). Le paging se
 * fige tant qu'une page est zoomée. Fond noir pur.
 */
function GalleryViewer({
  photos,
  metaBySession,
  initialIndex,
  onClose,
}: {
  photos: ViewablePhotoLite[];
  metaBySession: Record<string, { circuitName: string | null; dateIso: string | null }>;
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const current = photos[Math.min(index, photos.length - 1)];
  const meta = current ? metaBySession[current.sessionId] : undefined;
  const infoLine = meta
    ? [meta.dateIso ? formatDateShort(meta.dateIso) : null, meta.circuitName]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* Vue modale : le contenu de l'écran dessous reste sinon atteignable, et
          le dismiss gestuel (pan vers le bas) est hors de portée d'un lecteur
          d'écran — même patron que Sheet et le QR du Pass. */}
      <GestureHandlerRootView
        style={styles.viewerRoot}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        <FlatList
          data={photos}
          keyExtractor={(p) => p.id}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: winW, offset: winW * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / winW);
            setIndex(i);
            setZoomed(false);
          }}
          renderItem={({ item }) => (
            <PagerImage
              uri={item.uri}
              width={winW}
              height={winH}
              onZoomChange={setZoomed}
              onDismiss={onClose}
            />
          )}
        />

        {infoLine.length > 0 ? (
          <View style={[styles.viewerInfo, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.viewerInfoText}>{infoLine.toUpperCase()}</Text>
          </View>
        ) : null}

        <View style={[styles.viewerClose, { top: insets.top + space.md }]}>
          <PressScale
            onPress={onClose}
            accessibilityLabel="Fermer la photo"
            // Seule sortie non gestuelle du viewer : texte mono de 11 px
            // (~30 pt) — hitSlop 16 pour une cible confortable.
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <Text style={styles.viewerCloseLabel}>FERMER</Text>
          </PressScale>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function PagerImage({
  uri,
  width,
  height,
  onZoomChange,
  onDismiss,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const isZoomed = useSharedValue(false);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          scale.value = clamp(savedScale.value * e.scale, 1, 4);
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          if (scale.value <= VIEWER_PAN_ZOOM_THRESHOLD) {
            scale.value = withSpring(1, motionTokens.spring);
            savedScale.value = 1;
            tx.value = withSpring(0, motionTokens.spring);
            ty.value = withSpring(0, motionTokens.spring);
            savedTx.value = 0;
            savedTy.value = 0;
            isZoomed.value = false;
            runOnJS(onZoomChange)(false);
          } else {
            isZoomed.value = true;
            runOnJS(onZoomChange)(true);
          }
        }),
    [scale, savedScale, tx, ty, savedTx, savedTy, isZoomed, onZoomChange]
  );

  // Un seul pan : horizontal défère à la FlatList (failOffsetX) ; vertical =
  // déplacement de l'image zoomée, sinon dismiss vers le bas.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .failOffsetX([-16, 16])
        .onUpdate((e) => {
          if (isZoomed.value) {
            tx.value = savedTx.value + e.translationX;
            ty.value = savedTy.value + e.translationY;
          } else {
            ty.value = Math.max(0, e.translationY);
          }
        })
        .onEnd((e) => {
          if (isZoomed.value) {
            const maxTx = (width * (scale.value - 1)) / 2;
            const maxTy = (height * (scale.value - 1)) / 2;
            const cx = clamp(tx.value, -maxTx, maxTx);
            const cy = clamp(ty.value, -maxTy, maxTy);
            if (cx !== tx.value) tx.value = withSpring(cx, motionTokens.spring);
            if (cy !== ty.value) ty.value = withSpring(cy, motionTokens.spring);
            savedTx.value = cx;
            savedTy.value = cy;
            return;
          }
          if (viewerShouldDismiss(ty.value, e.velocityY)) {
            runOnJS(onDismiss)();
          } else {
            ty.value = withSpring(0, motionTokens.spring);
          }
        }),
    [scale, tx, ty, savedTx, savedTy, isZoomed, width, height, onDismiss]
  );

  const composed = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ width, height }, imageStyle]}>
          <Photo
            uri={uri}
            contentFit="contain"
            style={styles.viewerImage}
            accessibilityLabel="Photo de la séance, plein écran"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    marginBottom: space.xs,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  tabs: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.lg,
  },
  content: {
    flex: 1,
  },
  tabBody: {
    flex: 1,
  },
  stateWrap: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
  },
  // ── Grille ────────────────────────────────────────────────────────────
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.base,
    paddingVertical: space.sm,
  },
  gridHeaderText: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.low,
  },
  gridHeaderCount: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.dim,
    marginLeft: space.sm,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: GRID_GUTTER,
    marginBottom: GRID_GUTTER,
  },
  col: {
    flex: 1,
    gap: GRID_GUTTER,
  },
  tile: {
    borderRadius: radius.cell,
    overflow: 'hidden',
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
  },
  tilePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePlaceholderMark: {
    fontFamily: typo.mono,
    fontSize: 16,
    color: colors.text.low,
  },
  videoBadge: {
    position: 'absolute',
    bottom: space.sm,
    right: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.scrim,
  },
  videoBadgeText: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.hi,
  },
  videoCell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  videoCellLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.mid,
  },
  // ── Partages ──────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: space.xl,
    marginTop: space.xxl,
  },
  trophyWrap: {
    marginTop: space.lg,
  },
  primaryBtn: {
    marginTop: space.lg,
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.text.hi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.bg.base,
  },
  heritageBody: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.heritage.text,
  },
  heritageRow: {
    marginTop: space.lg,
    alignItems: 'center',
  },
  heritageBtnContainer: {
    alignSelf: 'stretch',
  },
  heritageBtn: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.heritage.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heritageBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.heritage.text,
  },
  errText: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: space.md,
    textAlign: 'center',
  },
  card: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    paddingHorizontal: space.lg,
  },
  revoke: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.accent,
  },
  sheetNote: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `space.sm` en écart : les hitSlop verticaux des Chip ne se recouvrent
    // pas horizontalement, et deux pills voisines restent deux cibles.
    gap: space.sm,
    marginTop: space.sm,
  },
  sheetAction: {
    marginTop: space.lg,
    marginBottom: space.xl,
  },
  sheetErreur: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.accent,
    marginTop: space.md,
  },
  // ── Viewer ────────────────────────────────────────────────────────────
  viewerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  viewerInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: space.md,
  },
  viewerInfoText: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.mid,
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
