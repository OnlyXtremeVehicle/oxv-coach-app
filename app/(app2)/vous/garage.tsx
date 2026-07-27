/**
 * GARAGE — écran 3/8 de la porte VOUS (V2-L4), « l'écran photo ». Route NOUVELLE.
 *
 * FlashList verticale de cartes véhicule plein cadre (HeroPhoto 150, première
 * photo réelle en cover, scrim, nom + specs), entrée en cascade. Tap → Sheet
 * véhicule : carrousel des photos (pager + points), spécifications, journal de
 * réglages (entrées datées + composer, date automatique via recorded_at).
 * Ajout : carte pointillée → Sheet de création (marque/modèle/année/couleur),
 * puis la fiche du véhicule s'ouvre pour y déposer ses photos.
 *
 * Données réelles uniquement (RLS own-row) :
 *   - véhicules `vehicles` (garageService.listMyVehicles) ;
 *   - covers = première photo par véhicule (pilotMediaService, URLs signées) ;
 *   - réglages `vehicle_setups` (listSetups/addSetup, recorded_at automatique).
 *  Colonne absente → « — », jamais un placeholder ; aucune photo → silhouette
 *  dessinée, jamais d'image stock.
 *
 * HONNÊTETÉ SCHÉMA (consignée au rapport de lot) :
 *   - PAS de colonne is_primary ni de setPrimary : le « véhicule en tête »
 *     (celui qui illustre l'accueil/hub) est le PREMIER enregistré, non
 *     modifiable — donc AUCUN bouton « Définir principal » n'est inventé, juste
 *     une mention factuelle ;
 *   - le picker n'ajoute qu'UNE photo à la fois (limite du service) — l'ajout
 *     multi se fait photo par photo dans la fiche.
 *
 * Doctrine : sobre, vouvoiement, zéro emoji, aucun jugement sur le matériel
 * (miroir) ; l'or reste au chrono (absent ici) — un seul accent rouge par zone.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  type Vehicle,
  type VehicleSetup,
  addSetup,
  addVehicle,
  getVehicle,
  listMyVehicles,
  listSetups,
} from '@/services/garageService';
import {
  type PilotMediaView,
  addMyPilotMedia,
  getMyVehicleCovers,
  listMyVehicleMedia,
} from '@/services/pilotMediaService';
import {
  EMPTY_SETUP_DRAFT,
  type GarageEntry,
  type SetupDraft,
  coverUriFor,
  formatSetupDate,
  hasSetupInput,
  markGarage,
  parseBar,
  primaryVehicleId,
  setupSummaryLines,
  specRows,
  vehicleName,
  vehicleSpecsLine,
} from '@/features/vous/garageLogic';
import {
  HeroPhoto,
  ListRow,
  Photo,
  PressScale,
  SectionHeader,
  Sheet,
  StateView,
  colors,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

type LoadState = 'loading' | 'ready';

// ---------------------------------------------------------------------------
// Fragments dessinés (aucune flèche/silhouette dans le registre d'icônes)
// ---------------------------------------------------------------------------

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

/** Silhouette d'auto — fallback de cover, jamais annoncée aux lecteurs d'écran. */
function CarSilhouette() {
  return (
    <Svg width={148} height={52} viewBox="0 0 132 46" accessibilityElementsHidden>
      <Path
        d="M8 34 L26 34 M104 34 L124 34 M14 34
           C14 27 28 25 40 24 C50 16 62 13 74 14 C88 15 98 22 106 25
           C116 26 120 29 120 34"
        stroke={colors.text.dim}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={40} cy={35} r={8} stroke={colors.text.dim} strokeWidth={2} fill="none" />
      <Circle cx={98} cy={35} r={8} stroke={colors.text.dim} strokeWidth={2} fill="none" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function GarageScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();

  const [state, setState] = useState<LoadState>('loading');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const reload = useCallback(() => {
    // garageService est fail-safe (retourne [] / {} sur incident réseau) : il
    // n'y a pas d'état d'erreur à distinguer d'un garage vide — on n'en fabrique
    // donc pas. Loading → contenu (vide ou liste).
    setState('loading');
    return Promise.all([listMyVehicles(), getMyVehicleCovers()]).then(([rows, cv]) => {
      setVehicles(rows);
      setCovers(cv);
      setState('ready');
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const entries: GarageEntry[] = markGarage(vehicles);
  const selectedIsPrimary = selectedId !== null && primaryVehicleId(vehicles) === selectedId;

  const openVehicle = (id: string) => setSelectedId(id);

  const onVehicleCreated = (newId: string) => {
    setAddOpen(false);
    void reload().then(() => setSelectedId(newId));
  };

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
        <Text style={styles.title} accessibilityRole="header">
          GARAGE
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {state === 'loading' ? (
        <View style={styles.body}>
          <StateView state="loading" shape="card" />
        </View>
      ) : vehicles.length === 0 ? (
        <View style={styles.body}>
          <StateView state="empty" emptyMessage="Votre garage vous attend." />
          <AddVehicleCard onPress={() => setAddOpen(true)} />
        </View>
      ) : (
        <View style={styles.listFill}>
          <FlashList
            data={entries}
            keyExtractor={(e) => e.vehicle.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: space.xl,
              paddingTop: space.md,
              paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
            }}
            renderItem={({ item, index }) => (
              <VehicleCard
                entry={item}
                index={index}
                cover={coverUriFor(item.vehicle.id, covers)}
                onPress={() => openVehicle(item.vehicle.id)}
              />
            )}
            ListFooterComponent={<AddVehicleCard onPress={() => setAddOpen(true)} />}
          />
        </View>
      )}

      <VehicleSheet
        vehicleId={selectedId}
        isPrimary={selectedIsPrimary}
        onClose={() => setSelectedId(null)}
        onChanged={reload}
      />

      <AddVehicleSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={onVehicleCreated}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Carte véhicule — plein cadre, cover réelle ou silhouette
// ---------------------------------------------------------------------------

function VehicleCard({
  entry,
  index,
  cover,
  onPress,
}: {
  entry: GarageEntry;
  index: number;
  cover?: string;
  onPress: () => void;
}) {
  const v = entry.vehicle;
  return (
    <Animated.View entering={staggerEntering(index)} style={styles.cardWrap}>
      <PressScale
        onPress={onPress}
        accessibilityLabel={`${vehicleName(v)}. ${vehicleSpecsLine(v)}`}
      >
        <HeroPhoto uri={cover} height={150} fallback={<CarSilhouette />}>
          {entry.isPrimary ? <Text style={styles.cardTag}>EN TÊTE</Text> : null}
          <Text style={styles.cardName} numberOfLines={1}>
            {vehicleName(v)}
          </Text>
          <Text style={styles.cardSpecs} numberOfLines={1}>
            {vehicleSpecsLine(v)}
          </Text>
        </HeroPhoto>
      </PressScale>
    </Animated.View>
  );
}

function AddVehicleCard({ onPress }: { onPress: () => void }) {
  return (
    <PressScale
      onPress={onPress}
      accessibilityLabel="Ajouter un véhicule"
      containerStyle={styles.addCardContainer}
      style={styles.addCard}
    >
      <Text style={styles.addPlus}>+</Text>
      <Text style={styles.addLabel}>Ajouter un véhicule</Text>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Sheet véhicule — carrousel + spécifications + journal de réglages
// ---------------------------------------------------------------------------

function VehicleSheet({
  vehicleId,
  isPrimary,
  onClose,
  onChanged,
}: {
  vehicleId: string | null;
  isPrimary: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [media, setMedia] = useState<PilotMediaView[]>([]);
  const [setups, setSetups] = useState<VehicleSetup[]>([]);
  const [carouselW, setCarouselW] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<SetupDraft>(EMPTY_SETUP_DRAFT);
  const [saving, setSaving] = useState(false);
  const [setupErr, setSetupErr] = useState<string | null>(null);

  useEffect(() => {
    if (vehicleId === null) return;
    let cancelled = false;
    setVehicle(null);
    setMedia([]);
    setSetups([]);
    setPhotoIndex(0);
    setComposerOpen(false);
    setDraft(EMPTY_SETUP_DRAFT);
    setSetupErr(null);
    Promise.all([getVehicle(vehicleId), listMyVehicleMedia(vehicleId), listSetups(vehicleId)]).then(
      ([v, m, sp]) => {
        if (cancelled) return;
        setVehicle(v);
        setMedia(m);
        setSetups(sp);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const photos = media.filter((m) => m.type === 'photo' && m.signedUrl);

  async function addPhoto() {
    if (!vehicleId || photoBusy) return;
    setPhotoBusy(true);
    const res = await addMyPilotMedia('photo', { vehicleId });
    setPhotoBusy(false);
    if (res.ok) {
      setMedia(res.items);
      void onChanged();
    } else if (!('cancelled' in res)) {
      setSetupErr(res.error);
    }
  }

  async function saveSetup() {
    if (!vehicleId || saving) return;
    if (!hasSetupInput(draft)) {
      setComposerOpen(false);
      return;
    }
    setSaving(true);
    setSetupErr(null);
    const res = await addSetup(vehicleId, {
      tires: draft.tires || undefined,
      brakes: draft.brakes || undefined,
      pressureFrontStart: parseBar(draft.pfs),
      pressureRearStart: parseBar(draft.prs),
      pressureFrontEnd: parseBar(draft.pfe),
      pressureRearEnd: parseBar(draft.pre),
      notes: draft.notes || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setSetupErr(res.error ?? 'Le réglage n’a pas pu être enregistré.');
      return;
    }
    setDraft(EMPTY_SETUP_DRAFT);
    setComposerOpen(false);
    const sp = await listSetups(vehicleId);
    setSetups(sp);
  }

  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (carouselW <= 0) return;
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / carouselW));
  };

  return (
    <Sheet
      visible={vehicleId !== null}
      onClose={onClose}
      snapHeight={Math.round(windowHeight * 0.86)}
    >
      {vehicle === null ? (
        <StateView state="loading" shape="card" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: tabBarSpace(insets.bottom) + space.xl }}
        >
          {/* ── CARROUSEL ── */}
          <View
            style={[styles.carousel, { height: 200 }]}
            onLayout={(e) => setCarouselW(e.nativeEvent.layout.width)}
          >
            {carouselW > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onCarouselScroll}
              >
                {photos.map((p) => (
                  <View key={p.id} style={{ width: carouselW, height: 200 }}>
                    <Photo
                      uri={p.signedUrl as string}
                      style={styles.carouselPhoto}
                      accessibilityLabel={`Photo de ${vehicleName(vehicle)}`}
                    />
                  </View>
                ))}
                {/* Dernière vue : ajout d'une photo (le service en ajoute une à
                    la fois — l'ajout multi se fait vue par vue). */}
                <View style={{ width: carouselW, height: 200 }}>
                  <PressScale
                    onPress={addPhoto}
                    disabled={photoBusy}
                    accessibilityLabel="Ajouter une photo"
                    style={styles.addPhotoTile}
                  >
                    {photos.length === 0 ? <CarSilhouette /> : null}
                    <Text style={styles.addPhotoLabel}>
                      {photoBusy ? 'Envoi…' : 'Ajouter une photo'}
                    </Text>
                  </PressScale>
                </View>
              </ScrollView>
            ) : null}
          </View>
          {photos.length > 1 ? (
            <View style={styles.dots}>
              {photos.map((p, i) => (
                <View key={p.id} style={[styles.dot, i === photoIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}

          {/* ── IDENTITÉ ── */}
          <Text style={styles.sheetName}>{vehicleName(vehicle)}</Text>
          <Text style={styles.sheetSpecs}>{vehicleSpecsLine(vehicle)}</Text>
          <Text style={styles.primaryNote}>
            {isPrimary
              ? 'Ce véhicule illustre votre accueil.'
              : 'Le véhicule en tête (le premier enregistré) illustre votre accueil.'}
          </Text>

          {/* ── SPÉCIFICATIONS ── */}
          <View style={styles.sheetSection}>
            <SectionHeader eyebrow="SPÉCIFICATIONS" />
            <View style={styles.specList}>
              {specRows(vehicle).map((r, i, arr) => (
                <ListRow key={r.key} label={r.label} value={r.value} divider={i < arr.length - 1} />
              ))}
            </View>
          </View>

          {/* ── JOURNAL DE RÉGLAGES (date automatique) ── */}
          <View style={styles.sheetSection}>
            <SectionHeader eyebrow="RÉGLAGES" count={setups.length} />

            {composerOpen ? (
              <View style={styles.composer}>
                <SheetField
                  label="Pneus"
                  value={draft.tires}
                  onChange={(v) => setDraft({ ...draft, tires: v })}
                />
                <SheetField
                  label="Freins"
                  value={draft.brakes}
                  onChange={(v) => setDraft({ ...draft, brakes: v })}
                />
                <View style={styles.composerRow}>
                  <SheetField
                    label="Pression AV départ"
                    value={draft.pfs}
                    onChange={(v) => setDraft({ ...draft, pfs: v })}
                    keyboardType="decimal-pad"
                    flex
                  />
                  <SheetField
                    label="Pression AR départ"
                    value={draft.prs}
                    onChange={(v) => setDraft({ ...draft, prs: v })}
                    keyboardType="decimal-pad"
                    flex
                  />
                </View>
                <View style={styles.composerRow}>
                  <SheetField
                    label="Pression AV retour"
                    value={draft.pfe}
                    onChange={(v) => setDraft({ ...draft, pfe: v })}
                    keyboardType="decimal-pad"
                    flex
                  />
                  <SheetField
                    label="Pression AR retour"
                    value={draft.pre}
                    onChange={(v) => setDraft({ ...draft, pre: v })}
                    keyboardType="decimal-pad"
                    flex
                  />
                </View>
                <SheetField
                  label="Notes"
                  value={draft.notes}
                  onChange={(v) => setDraft({ ...draft, notes: v })}
                  multiline
                />
                {setupErr ? <Text style={styles.errorText}>{setupErr}</Text> : null}
                <View style={styles.composerActions}>
                  <PressScale
                    onPress={() => {
                      setComposerOpen(false);
                      setDraft(EMPTY_SETUP_DRAFT);
                    }}
                    accessibilityLabel="Annuler le réglage"
                    containerStyle={styles.ghostContainer}
                    style={styles.ghostBtn}
                  >
                    <Text style={styles.ghostLabel}>Annuler</Text>
                  </PressScale>
                  <PressScale
                    onPress={saveSetup}
                    disabled={saving}
                    accessibilityLabel="Enregistrer le réglage"
                    containerStyle={styles.primaryContainer}
                    style={[styles.primaryBtn, saving && styles.primaryDisabled]}
                  >
                    <Text style={styles.primaryLabel}>
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </Text>
                  </PressScale>
                </View>
              </View>
            ) : (
              <PressScale
                onPress={() => setComposerOpen(true)}
                accessibilityLabel="Consigner un réglage"
                containerStyle={styles.consignerContainer}
                style={styles.consignerBtn}
              >
                <Text style={styles.consignerLabel}>Consigner un réglage</Text>
              </PressScale>
            )}

            {setups.length === 0 ? (
              <Text style={styles.emptySetups}>Aucun réglage consigné.</Text>
            ) : (
              <View style={styles.setupList}>
                {setups.map((sp) => (
                  <View key={sp.id} style={styles.setupEntry}>
                    <Text style={styles.setupDate}>{formatSetupDate(sp.recordedAt)}</Text>
                    {setupSummaryLines(sp).map((line, i) => (
                      <Text key={i} style={styles.setupLine}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Sheet d'ajout de véhicule
// ---------------------------------------------------------------------------

function AddVehicleSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBrand('');
      setModel('');
      setYear('');
      setColor('');
      setErr(null);
    }
  }, [visible]);

  async function create() {
    if (saving) return;
    if (!brand.trim() || !model.trim()) {
      setErr('Marque et modèle requis.');
      return;
    }
    setSaving(true);
    const y = parseInt(year, 10);
    const res = await addVehicle({
      brand,
      model,
      year: Number.isFinite(y) ? y : null,
      color: color || undefined,
    });
    setSaving(false);
    if (res.ok && res.id) {
      onCreated(res.id);
    } else {
      setErr(res.error ?? 'Création impossible.');
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarSpace(insets.bottom) + space.md }}
      >
        <Text style={styles.sheetName}>Nouveau véhicule</Text>
        <Text style={styles.addHint}>Enregistrez-le, puis ajoutez ses photos depuis sa fiche.</Text>
        <View style={styles.composer}>
          <SheetField label="Marque" value={brand} onChange={setBrand} />
          <SheetField label="Modèle" value={model} onChange={setModel} />
          <View style={styles.composerRow}>
            <SheetField
              label="Année"
              value={year}
              onChange={setYear}
              keyboardType="number-pad"
              flex
            />
            <SheetField label="Couleur" value={color} onChange={setColor} flex />
          </View>
          {err ? <Text style={styles.errorText}>{err}</Text> : null}
          <PressScale
            onPress={create}
            disabled={saving}
            accessibilityLabel="Enregistrer le véhicule"
            containerStyle={styles.submitContainer}
            style={[styles.primaryBtn, saving && styles.primaryDisabled]}
          >
            <Text style={styles.primaryLabel}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Text>
          </PressScale>
        </View>
      </ScrollView>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Champ de saisie v2 (partagé composer réglage / ajout véhicule)
// ---------------------------------------------------------------------------

function SheetField({
  label,
  value,
  onChange,
  keyboardType,
  multiline,
  flex,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'number-pad';
  multiline?: boolean;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex ? styles.fieldFlex : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.text.dim}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
        accessibilityLabel={label}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerSpacer: { width: 36 },
  title: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  body: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  listFill: { flex: 1 },

  // Carte véhicule
  cardWrap: { marginBottom: space.lg },
  cardTag: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.xs,
  },
  cardName: {
    fontFamily: typo.bodySemi,
    fontSize: 18,
    color: colors.text.hi,
  },
  cardSpecs: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.text.mid,
    marginTop: 2,
  },

  // Carte d'ajout (pointillée)
  addCardContainer: { marginTop: space.sm },
  addCard: {
    minHeight: 96,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    borderRadius: radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  addPlus: {
    fontFamily: typo.body,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text.mid,
  },
  addLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },

  // Sheet — carrousel
  carousel: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.bg.card2,
  },
  carouselPhoto: { width: '100%', height: '100%' },
  addPhotoTile: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.bg.card2,
  },
  addPhotoLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.strong,
  },
  dotActive: { backgroundColor: colors.text.hi },

  // Sheet — identité + sections
  sheetName: {
    fontFamily: typo.display,
    fontSize: 20,
    letterSpacing: 0.4,
    color: colors.text.hi,
    marginTop: space.lg,
  },
  sheetSpecs: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  primaryNote: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
  },
  sheetSection: { marginTop: space.xl },
  specList: { marginTop: space.sm },

  // Composer réglage / véhicule
  composer: { marginTop: space.md, gap: space.md },
  composerRow: { flexDirection: 'row', gap: space.md },
  composerActions: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.xs,
  },
  addHint: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.mid,
    marginTop: space.xs,
  },

  field: {},
  fieldFlex: { flex: 1 },
  fieldLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.low,
    marginBottom: space.sm,
  },
  input: {
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  inputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  errorText: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.accent,
  },

  // Boutons
  consignerContainer: { marginTop: space.md },
  consignerBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  consignerLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
  },
  ghostContainer: { flex: 1 },
  ghostBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ghostLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
  primaryContainer: { flex: 2 },
  submitContainer: { alignSelf: 'stretch', marginTop: space.xs },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.6 },
  primaryLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 14,
    letterSpacing: 0.4,
    color: colors.text.hi,
  },

  // Journal
  emptySetups: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.low,
    marginTop: space.md,
  },
  setupList: { marginTop: space.md, gap: space.sm },
  setupEntry: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.md,
    gap: 2,
  },
  setupDate: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text.mid,
    marginBottom: space.xs,
  },
  setupLine: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.hi,
  },
});
