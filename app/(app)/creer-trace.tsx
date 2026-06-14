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
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { CircuitTrace } from '@/circuit/CircuitTrace';
import {
  fetchOsmWay,
  generateCircuit,
  type Circuit,
  type LatLon,
} from '@/circuit/circuitGenerator';
import { createUserCircuit, type TraceVisibility } from '@/services/userCircuitsService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>CARTE</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Créer un tracé
        </Text>

        <Text
          style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.sm }]}
        >
          Identifiant du way OpenStreetMap
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={wayId}
            onChangeText={setWayId}
            keyboardType="number-pad"
            placeholder="ex. 54412766"
            placeholderTextColor={colors.text.tertiary}
            style={{
              flex: 1,
              color: colors.text.primary,
              fontSize: fontSize.body,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.medium,
              backgroundColor: colors.background.secondary,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={loadingOsm}
            onPress={handleLoad}
            style={{
              paddingHorizontal: spacing.lg,
              justifyContent: 'center',
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.medium,
              backgroundColor: colors.background.secondary,
              opacity: loadingOsm ? 0.6 : 1,
            }}
          >
            {loadingOsm ? (
              <ActivityIndicator color={colors.text.secondary} />
            ) : (
              <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>Charger</Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <Text
            style={{
              color: colors.system.error,
              fontSize: fontSize.caption,
              marginTop: spacing.md,
            }}
          >
            {error}
          </Text>
        ) : null}

        {circuit ? (
          <View style={{ marginTop: spacing.xl }}>
            <CircuitTrace circuit={circuit} height={300} defaultLayer="geometry" />
            <Text
              style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.md }]}
            >
              {(circuit.length_m / 1000).toFixed(2)} km · {circuit.corners.length} virages détectés
              · © contributeurs OpenStreetMap
            </Text>

            <Text
              style={[
                typography.caption,
                { color: colors.text.tertiary, marginTop: spacing.xl, marginBottom: spacing.sm },
              ]}
            >
              Nom du tracé
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nom du tracé"
              placeholderTextColor={colors.text.tertiary}
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.border.medium,
                backgroundColor: colors.background.secondary,
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {(
                [
                  { id: 'private', label: 'Privé' },
                  { id: 'submitted', label: 'Proposer à OXV' },
                ] as { id: TraceVisibility; label: string }[]
              ).map((v) => {
                const on = v.id === visibility;
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setVisibility(v.id)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: borderRadius.md,
                      borderWidth: 1,
                      borderColor: on ? colors.text.secondary : colors.border.subtle,
                      backgroundColor: on ? colors.background.secondary : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: on ? colors.text.primary : colors.text.secondary,
                        fontSize: fontSize.caption,
                      }}
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text
              style={{
                color: colors.text.tertiary,
                fontSize: fontSize.caption,
                marginTop: spacing.sm,
              }}
            >
              Privé : visible de vous seul. Proposer à OXV : soumis pour référencement officiel.
            </Text>

            <Pressable
              accessibilityRole="button"
              disabled={saving || !name.trim()}
              onPress={handleSave}
              style={({ pressed }) => ({
                marginTop: spacing.xl,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                borderWidth: 0.5,
                borderColor: colors.border.medium,
                backgroundColor: colors.background.secondary,
                alignItems: 'center',
                opacity: pressed || saving || !name.trim() ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
                }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le tracé'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
