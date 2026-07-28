/**
 * Écran Pilote — Garage (reskin fidèle refonte-v2 §7bis, 39-garage.png).
 *
 * Maquette : un véhicule « en tête » en grande carte (silhouette auto + méta
 * année/puissance/plaque), les autres véhicules en lignes, un « + » en barre
 * pour en ajouter. Le CRUD existant (ajout, ouverture de fiche → journal de
 * réglages / édition) est PRÉSERVÉ, restylé au langage v2.
 *
 * Photos (retour fondateur build 23 : « relier les véhicules et les photos ») :
 * quand un véhicule a une VRAIE photo (média `users.media` rattaché par
 * `vehicleId`, bucket privé → URL signée), elle remplace la silhouette SVG en
 * cover (carte de tête et lignes). Sans photo : silhouette conservée — jamais
 * d'image factice.
 *
 * Données réelles uniquement (table `vehicles`, RLS own-row via garageService) :
 *  - marque, modèle, année, couleur, notes — seules colonnes réelles.
 *  - Il N'EXISTE PAS de colonne `is_primary` : le maquette montre un badge
 *    PRINCIPALE, mais aucune donnée réelle ne le porte. On rend donc le premier
 *    véhicule enregistré (ordre `created_at`) en tête, SANS badge inventé.
 *  - Il N'EXISTE PAS non plus de colonne puissance (ch) ni plaque : la méta de
 *    la carte se limite au réel (année, couleur), « — » si absent. (Cf.
 *    sharedChangesNeeded : colonnes is_primary / power / plate à créer si ces
 *    éléments du maquette doivent devenir réels.)
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji, descriptif jamais prescriptif ;
 * l'or est réservé au chrono (absent ici) — aucune couleur de donnée sur le
 * matériel. Aucun jugement sur les véhicules (miroir).
 */

import { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';

import { EmptyState } from '@/components/instruments';
import { AnimatedPresence, FadeInSection, PressableScale, Stagger } from '@/components/motion';
import { type Vehicle, addVehicle, listMyVehicles } from '@/services/garageService';
import { getMyVehicleCovers } from '@/services/pilotMediaService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** Nom lisible d'un véhicule (marque + modèle), repli neutre si vide. */
function vehicleName(v: Vehicle): string {
  return [v.brand, v.model].filter(Boolean).join(' ').trim() || 'Véhicule';
}

/** Valeur factuelle ou « — » (jamais inventée). */
function metaValue(v: string | number | null | undefined): string {
  if (v == null) return '—';
  const t = String(v).trim();
  return t.length > 0 ? t : '—';
}

/** Silhouette d'auto minimale (décor, non annoncée aux lecteurs d'écran). */
function CarSilhouette() {
  return (
    <Svg width={132} height={46} viewBox="0 0 132 46" accessibilityElementsHidden>
      <Path
        d="M8 34 L26 34 M104 34 L124 34 M14 34
           C14 27 28 25 40 24 C50 16 62 13 74 14 C88 15 98 22 106 25
           C116 26 120 29 120 34"
        stroke={palette.eyebrow}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={40} cy={35} r={8} stroke={palette.eyebrow} strokeWidth={2} fill="none" />
      <Circle cx={98} cy={35} r={8} stroke={palette.eyebrow} strokeWidth={2} fill="none" />
    </Svg>
  );
}

/** Méta réelle sous le nom (année · couleur), séparées par des points milieu. */
function metaLine(v: Vehicle): string {
  const parts = [metaValue(v.year), metaValue(v.color)];
  return parts.join('  ·  ');
}

export default function GarageScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listMyVehicles(), getMyVehicleCovers()]).then(([rows, cv]) => {
      if (!cancelled) {
        setVehicles(rows);
        setCovers(cv);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  function openComposer() {
    setError(null);
    setComposing(true);
  }

  function openVehicle(id: string) {
    router.push(`/(app)/garage/${id}` as never);
  }

  async function onAdd() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const y = parseInt(year, 10);
    const res = await addVehicle({
      brand,
      model,
      year: Number.isFinite(y) ? y : null,
      color: color || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setComposing(false);
      setBrand('');
      setModel('');
      setYear('');
      setColor('');
      reload();
    } else {
      setError(res.error ?? 'Création impossible.');
    }
  }

  const primary = vehicles[0] ?? null;
  const others = vehicles.slice(1);
  const heroCover = primary ? covers[primary.id] : undefined;

  return (
    <Screen>
      <AppBar
        title="Garage"
        onBack={() => router.back()}
        trailing={
          <PressableScale
            onPress={openComposer}
            accessibilityRole="button"
            accessibilityLabel="Ajouter un véhicule"
            hitSlop={8}
            haptic="tap"
            style={s.plusBtn}
          >
            <Text style={s.plusGlyph}>+</Text>
          </PressableScale>
        }
      />

      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        {/* ── Composer d'ajout (CRUD existant, restylé v2). Présence animée :
            le panneau monte en fondu à l'ouverture, sort avant démontage. ── */}
        <AnimatedPresence visible={composing}>
          <Card style={s.composer}>
            <SectionLabel>Nouveau véhicule</SectionLabel>
            <Field label="Marque" value={brand} onChangeText={setBrand} />
            <Field label="Modèle" value={model} onChangeText={setModel} />
            <Field
              label="Année"
              optional
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
            />
            <Field label="Couleur" optional value={color} onChangeText={setColor} />
            {error ? (
              <Text style={s.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label="Enregistrer"
              onPress={onAdd}
              loading={saving}
              disabled={!brand.trim() || !model.trim()}
            />
            <Button label="Annuler" variant="ghost" onPress={() => setComposing(false)} />
          </Card>
        </AnimatedPresence>

        {/* ── Contenu : vide / véhicule en tête + autres véhicules. ─────── */}
        {!loading && vehicles.length === 0 ? (
          <FadeInSection>
            <View style={{ marginTop: composing ? spacing.xl : spacing.sm }}>
              <EmptyState
                label="Garage vide"
                message="Ajoutez un véhicule pour le retrouver ici et consigner ses réglages."
                source="vehicles"
              />
            </View>
          </FadeInSection>
        ) : null}

        {primary ? (
          <>
            {/* Véhicule en tête — grande carte : VRAIE photo (cover signée) si
                elle existe, silhouette sinon + méta réelle.
                (Pas de badge PRINCIPALE : aucune colonne is_primary réelle.)
                La photo de couverture arrive en fondu pur (translateY 0). */}
            <FadeInSection>
              <PressableScale
                onPress={() => openVehicle(primary.id)}
                accessibilityRole="button"
                accessibilityLabel={`${vehicleName(primary)}. ${metaLine(primary)}`}
                style={s.hero}
              >
                <View style={[s.heroArt, heroCover ? s.heroArtPhoto : null]}>
                  {heroCover ? (
                    <FadeInSection
                      key={heroCover}
                      translateY={0}
                      style={StyleSheet.absoluteFillObject}
                    >
                      <Image
                        source={{ uri: heroCover }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessible={false}
                      />
                    </FadeInSection>
                  ) : (
                    <CarSilhouette />
                  )}
                </View>
                <View style={s.heroBody}>
                  <Text style={s.heroName} numberOfLines={1}>
                    {vehicleName(primary)}
                  </Text>
                  <Text style={s.heroMeta} numberOfLines={1}>
                    {metaLine(primary)}
                  </Text>
                </View>
              </PressableScale>
            </FadeInSection>

            {others.length > 0 ? (
              <View style={s.othersBlock}>
                <SectionLabel>Autres véhicules</SectionLabel>
                <Stagger
                  initialDelay={120}
                  interval={60}
                  style={{ gap: spacing.sm, marginTop: spacing.md }}
                >
                  {others.map((v) => (
                    <PressableScale
                      key={v.id}
                      onPress={() => openVehicle(v.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${vehicleName(v)}. ${metaLine(v)}`}
                      style={s.row}
                    >
                      <View style={s.rowIcon} accessibilityElementsHidden>
                        {covers[v.id] ? (
                          <Image
                            source={{ uri: covers[v.id] }}
                            style={s.rowThumb}
                            resizeMode="cover"
                            accessible={false}
                          />
                        ) : (
                          <Svg width={30} height={12} viewBox="0 0 30 12">
                            <Path
                              d="M2 9 C2 6 8 5 12 5 C15 3 20 3 24 5 C27 5 28 7 28 9"
                              stroke={palette.creamMute}
                              strokeWidth={1.4}
                              strokeLinecap="round"
                              fill="none"
                            />
                          </Svg>
                        )}
                      </View>
                      <View style={s.rowBody}>
                        <Text style={s.rowName} numberOfLines={1}>
                          {vehicleName(v)}
                        </Text>
                        <Text style={s.rowMeta} numberOfLines={1}>
                          {metaLine(v)}
                        </Text>
                      </View>
                      <View style={s.chev} accessibilityElementsHidden />
                    </PressableScale>
                  ))}
                </Stagger>
              </View>
            ) : null}

            <FadeInSection delay={240}>
              <Text style={s.footNote}>
                Année et couleur telles que vous les avez renseignées. Ouvrez un véhicule pour
                ajouter ses photos et consigner ses réglages.
              </Text>
            </FadeInSection>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  // Pastille « + » de la barre (langage v2, cf. carnet).
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusGlyph: {
    fontFamily: fonts.body,
    fontSize: 20,
    lineHeight: 22,
    color: palette.creamSoft,
  },

  composer: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },

  // Véhicule en tête — grande surface, silhouette centrée puis identité.
  hero: {
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    overflow: 'hidden',
  },
  heroArt: {
    height: 128,
    backgroundColor: palette.card2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
    overflow: 'hidden',
  },
  // Avec une vraie photo, la scène gagne en hauteur (cover pleine largeur).
  heroArtPhoto: { height: 168 },
  heroBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  heroName: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  heroMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.creamMute,
  },

  othersBlock: { marginTop: spacing.xl },

  // Ligne « autre véhicule » — icône fine + identité + chevron.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.separator,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowThumb: { width: '100%', height: '100%' },
  rowBody: { flex: 1, gap: 2 },
  rowName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.5,
    color: palette.creamMute,
  },
  chev: {
    width: 8,
    height: 8,
    borderRightWidth: 1.6,
    borderTopWidth: 1.6,
    borderColor: palette.faint,
    transform: [{ rotate: '45deg' }],
  },

  footNote: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.6,
    color: palette.eyebrow,
    marginTop: spacing.xl,
  },

  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.red,
  },
});
