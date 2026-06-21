/**
 * Écran Créer un tracé — le point innovant de la Carte (specs v4 §08 §5.3).
 *
 * Mode « import OpenStreetMap » : l'utilisateur saisit l'identifiant d'un « way »
 * OSM, on récupère ses points, on génère la géométrie (générateur testé), on
 * prévisualise le tracé 3D, puis on enregistre dans `circuits`.
 *
 * Visibilité (décision fondateur) : tracé PRIVÉ par défaut, ou PROPOSÉ à OXV
 * (review_status='submitted'). Le partage via social viendra ensuite. Un tracé
 * créé n'est jamais officiel d'office (is_official=false).
 *
 * Attribution OBLIGATOIRE pour la source OSM : « © contributeurs OpenStreetMap ».
 * Modes « tracé manuel » et « depuis une session » : à venir (carte / frames).
 *
 * Reskin V2 : Screen + AppBar, Card/Segmented/Button. Logique inchangée.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { CircuitTrace } from '@/circuit/CircuitTrace';
import {
  fetchOsmWay,
  generateCircuit,
  type Circuit,
  type LatLon,
} from '@/circuit/circuitGenerator';
import { createUserCircuit, type TraceVisibility } from '@/services/userCircuitsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { Segmented } from '@/ui/Segmented';

const VISIBILITY_OPTIONS: { id: TraceVisibility; label: string }[] = [
  { id: 'private', label: 'Privé' },
  { id: 'submitted', label: 'Proposer à OXV' },
];

export default function CreerTraceScreen() {
  const [wayId, setWayId] = useState('');
  const [points, setPoints] = useState<LatLon[] | null>(null);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<TraceVisibility>('private');
  const [loadingOsm, setLoadingOsm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
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
        setError('Ce way ne contient pas assez de points.');
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

  const handleSave = async () => {
    if (!points || !name.trim()) return;
    setSaving(true);
    const id = await createUserCircuit(points, name, visibility);
    setSaving(false);
    if (id) router.back();
    else setError("L'enregistrement a échoué.");
  };

  const visibilityLabel = VISIBILITY_OPTIONS.find((v) => v.id === visibility)?.label ?? '';

  return (
    <Screen>
      <AppBar title="CRÉER UN TRACÉ" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Créer un tracé</Text>

        <Card>
          <SectionLabel>Identifiant du way OpenStreetMap</SectionLabel>
          <View
            style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}
          >
            <TextInput
              value={wayId}
              onChangeText={setWayId}
              keyboardType="number-pad"
              placeholder="ex. 54412766"
              placeholderTextColor={theme.palette.creamMute}
              style={[s.input, { flex: 1 }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={loadingOsm}
              onPress={handleLoad}
              style={({ pressed }) => [
                s.loadBtn,
                { opacity: loadingOsm ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              {loadingOsm ? (
                <ActivityIndicator color={theme.palette.creamSoft} />
              ) : (
                <Text style={s.loadBtnTxt}>Charger</Text>
              )}
            </Pressable>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}
        </Card>

        {circuit ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <CircuitTrace circuit={circuit} height={300} defaultLayer="geometry" />
            </Card>
            <Text style={s.attribution}>
              {(circuit.length_m / 1000).toFixed(2)} km · {circuit.corners.length} virages détectés
              · © contributeurs OpenStreetMap
            </Text>

            <Card style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>Nom du tracé</SectionLabel>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom du tracé"
                placeholderTextColor={theme.palette.creamMute}
                style={[s.input, { marginTop: theme.spacing.sm }]}
              />

              <View style={{ marginTop: theme.spacing.lg }}>
                <Segmented
                  options={VISIBILITY_OPTIONS.map((v) => v.label)}
                  value={visibilityLabel}
                  onChange={(label) => {
                    const next = VISIBILITY_OPTIONS.find((v) => v.label === label);
                    if (next) setVisibility(next.id);
                  }}
                />
              </View>
              <Text style={s.help}>
                Privé : visible de vous seul. Proposer à OXV : soumis pour référencement officiel.
              </Text>

              <View style={{ marginTop: theme.spacing.xl }}>
                <Button
                  label={saving ? 'Enregistrement…' : 'Enregistrer le tracé'}
                  onPress={handleSave}
                  disabled={saving || !name.trim()}
                />
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  input: {
    color: theme.palette.cream,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  loadBtn: {
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
  },
  loadBtnTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginTop: theme.spacing.md,
  },
  attribution: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  help: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
