/**
 * Importer un tracé — depuis OpenStreetMap. Arbre `app/(app2)`, kit V2.
 *
 * L'utilisateur saisit l'identifiant d'un « way » OSM, on récupère ses points,
 * on génère la géométrie (générateur testé), on prévisualise, puis on
 * enregistre dans `circuits`.
 *
 * Visibilité (décision fondateur) : tracé PRIVÉ par défaut, ou PROPOSÉ à OXV
 * (`review_status = 'submitted'`). Un tracé créé n'est jamais officiel d'office.
 *
 * Attribution OBLIGATOIRE pour la source OSM : « © contributeurs
 * OpenStreetMap ». Modes « tracé manuel » et « depuis une session » : à venir.
 *
 * ---
 *
 * PORTÉ EN app2 LE 29/07/2026 — LOT 19, DERNIER DES TROIS
 *
 * Depuis `app/(app)/creer-trace.tsx`. La logique n'a pas bougé :
 * `fetchOsmWay`, `generateCircuit`, `createUserCircuit`.
 *
 * Deux substitutions de kit, faute d'équivalent V2 :
 *
 *   · `Segmented` → deux `Chip`. Le kit V2 n'a pas de sélecteur segmenté, et
 *     deux options se disent très bien en deux pastilles — l'état sélectionné
 *     est porté par `accessibilityState`, pas par la seule couleur.
 *   · `Card` → une vue à fond `bg.card`, comme partout ailleurs dans app2.
 *
 * `TraceCircuit` venait DÉJÀ du kit V2 : la prévisualisation n'a rien coûté.
 */

import { useState } from 'react';
// L'indicateur de chargement est désormais porté par le `Button` du kit V2
// (prop `loading`) : plus besoin d'un ActivityIndicator posé à la main.
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchOsmWay,
  generateCircuit,
  type Circuit,
  type LatLon,
} from '@/circuit/circuitGenerator';
import { createUserCircuit, type TraceVisibility } from '@/services/userCircuitsService';
import {
  Button,
  Chip,
  Field,
  PressScale,
  SectionHeader,
  TraceCircuit,
  colors,
  radius,
  space,
  tabBarSpace,
  typo,
} from '@/ui/v2';

const VISIBILITES: { id: TraceVisibility; label: string; note: string }[] = [
  { id: 'private', label: 'Privé', note: 'Visible de vous seul.' },
  { id: 'submitted', label: 'Proposer à OXV', note: 'Soumis pour référencement officiel.' },
];

export default function ImporterTraceScreen() {
  const insets = useSafeAreaInsets();
  const [wayId, setWayId] = useState('');
  const [points, setPoints] = useState<LatLon[] | null>(null);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TraceVisibility>('private');
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charger = async () => {
    const id = parseInt(wayId.trim(), 10);
    if (!Number.isFinite(id)) {
      setError('Identifiant OSM invalide.');
      return;
    }
    setError(null);
    setLoadingOsm(true);
    try {
      const parsed = await fetchOsmWay(id);
      if (parsed.points.length < 3) {
        setError('Ce tracé ne contient pas assez de points.');
        return;
      }
      setPoints(parsed.points);
      setCircuit(generateCircuit(parsed.points));
      setName((current) => current || parsed.name || `Tracé OSM ${id}`);
    } catch {
      setError('Impossible de récupérer ce tracé depuis OpenStreetMap.');
    } finally {
      setLoadingOsm(false);
    }
  };

  const enregistrer = async () => {
    if (!points || !name.trim()) return;
    setSaving(true);
    const id = await createUserCircuit(points, name, visibility);
    setSaving(false);
    if (id) router.back();
    else setError('L’enregistrement a échoué.');
  };

  const noteVisibilite = VISIBILITES.find((v) => v.id === visibility)?.note ?? '';

  return (
    <View style={s.root}>
      <View style={[s.entete, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.chevron}>‹</Text>
        </PressScale>
        <Text style={s.enteteTitre} accessibilityRole="header">
          IMPORTER UN TRACÉ
        </Text>
        <View style={s.enteteEspaceur} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader eyebrow="DEPUIS OPENSTREETMAP" />

        <View style={s.carte}>
          <View style={s.ligneSaisie}>
            <Field
              label="Tracé OpenStreetMap"
              value={wayId}
              onChangeText={setWayId}
              keyboardType="number-pad"
              placeholder="ex. 54412766"
              helper="Collez l’identifiant du « way » OSM, ou laissez vide pour dessiner à la main."
              error={error}
              containerStyle={s.champLarge}
            />
            <View style={s.actionCharger}>
              <Button
                label={loadingOsm ? 'Chargement' : 'Charger'}
                onPress={() => void charger()}
                loading={loadingOsm}
                variant="ghost"
              />
            </View>
          </View>
        </View>

        {circuit ? (
          <View style={s.blocApercu}>
            <View style={s.carteApercu}>
              <TraceCircuit centerline={circuit.centerline} closed={circuit.closed} height={300} />
            </View>
            {/* Chaque valeur vient du générateur — aucune n'est arrondie à l'aveugle. */}
            <Text style={s.attribution}>
              {(circuit.length_m / 1000).toFixed(2)} km · {circuit.corners.length} virages détectés
              · © contributeurs OpenStreetMap
            </Text>

            <View style={s.carte}>
              <Field
                label="Nom du tracé"
                value={name}
                onChangeText={setName}
                placeholder="Épingle Sud, boucle nord…"
              />

              <Text style={s.labelVisibilite}>Visibilité</Text>
              <View style={s.ligneChips}>
                {VISIBILITES.map((v) => (
                  <Chip
                    key={v.id}
                    label={v.label}
                    active={v.id === visibility}
                    onPress={() => setVisibility(v.id)}
                  />
                ))}
              </View>
              <Text style={s.note}>{noteVisibilite}</Text>

              <View style={s.actionEnregistrer}>
                <Button
                  label="Enregistrer le tracé"
                  onPress={() => void enregistrer()}
                  loading={saving}
                  disabled={!name.trim()}
                />
              </View>
            </View>
          </View>
        ) : null}

        <Text style={s.pied}>
          Un tracé importé n’est jamais officiel d’office. Le référencement passe par OXV.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text.hi,
    width: 24,
  },
  enteteTitre: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.mid,
  },
  enteteEspaceur: { width: 24 },
  carte: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    marginTop: space.md,
  },
  ligneSaisie: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  champLarge: { flex: 1, marginBottom: 0 },
  actionCharger: { marginBottom: 0 },
  blocApercu: { marginTop: space.xl },
  carteApercu: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  attribution: {
    fontFamily: typo.mono,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: colors.text.dim,
    marginTop: space.sm,
  },
  labelVisibilite: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
    letterSpacing: 0.2,
    marginBottom: space.xs,
  },
  ligneChips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  note: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.sm,
  },
  actionEnregistrer: { marginTop: space.lg },
  pied: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.xl,
  },
});
