/**
 * Écran Détail circuit — écosystème (§8 étape A OXV Mirror).
 *
 * Informations factuelles du circuit + services référencés autour
 * (restauration, hébergement, loisirs, journées de roulage), groupés par
 * type. Chaque service porte ses actions : lien, e-mail, téléphone, adresse.
 *
 * Référencement / mise en relation uniquement — aucun encaissement ni
 * réservation (étape A). Annuaire neutre (roulages OXV et concurrents).
 *
 * Doctrine : factuel, sobre, aucun classement.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import {
  type CircuitService,
  type DirectoryCircuit,
  SERVICE_KIND_LABELS,
  circuitSubtitle,
  groupServicesByKind,
} from '@/services/ecosystemLogic';
import { fetchDirectoryCircuits, listCircuitServices } from '@/services/ecosystemService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CircuitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(id) ? id[0] : id;

  const [circuit, setCircuit] = useState<DirectoryCircuit | null>(null);
  const [services, setServices] = useState<CircuitService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!circuitId) return;
    Promise.all([fetchDirectoryCircuits(), listCircuitServices(circuitId)]).then(
      ([circuits, svcs]) => {
        if (!cancelled) {
          setCircuit(circuits.find((c) => c.id === circuitId) ?? null);
          setServices(svcs);
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [circuitId]);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  const title = circuit?.officialName ?? circuit?.name ?? 'Circuit';
  const groups = groupServicesByKind(services);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>CIRCUIT</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>{title}</Text>
        {circuit && circuitSubtitle(circuit) ? (
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}
          >
            {circuitSubtitle(circuit)}
          </Text>
        ) : null}

        <Text
          style={[
            typography.eyebrow,
            { color: colors.text.tertiary, marginTop: spacing.xxl, marginBottom: spacing.md },
          ]}
        >
          AUTOUR DU CIRCUIT
        </Text>

        {groups.length === 0 ? (
          <View
            style={{
              padding: spacing.xxl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
            }}
          >
            <Text
              style={[typography.caption, { color: colors.text.tertiary, textAlign: 'center' }]}
            >
              Les services autour de ce circuit seront référencés ici.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.kind} style={{ marginBottom: spacing.xxl }}>
              <Text
                style={[typography.eyebrow, { color: colors.accent.red, marginBottom: spacing.md }]}
              >
                {SERVICE_KIND_LABELS[group.kind].toUpperCase()}
              </Text>
              <View style={{ gap: spacing.md }}>
                {group.items.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </View>
            </View>
          ))
        )}

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceCard({ service }: { service: CircuitService }) {
  const openUrl = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
        }}
      >
        {service.name}
      </Text>
      {service.organizer ? (
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}>
          {service.organizer}
        </Text>
      ) : null}
      {service.description ? (
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.caption,
            marginTop: spacing.sm,
            lineHeight: fontSize.caption * 1.5,
          }}
        >
          {service.description}
        </Text>
      ) : null}
      {service.address ? (
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}>
          {service.address}
        </Text>
      ) : null}

      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}
      >
        {service.url ? <Action label="Site" onPress={() => openUrl(service.url)} /> : null}
        {service.contactEmail ? (
          <Action label="E-mail" onPress={() => openUrl(`mailto:${service.contactEmail}`)} />
        ) : null}
        {service.contactPhone ? (
          <Action label="Téléphone" onPress={() => openUrl(`tel:${service.contactPhone}`)} />
        ) : null}
      </View>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 0.5,
        borderColor: colors.border.medium,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>{label}</Text>
    </Pressable>
  );
}
