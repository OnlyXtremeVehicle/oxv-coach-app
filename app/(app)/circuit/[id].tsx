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
 * Reskin V2 : Screen + AppBar, Card/SectionLabel. Le tracé (CircuitTraceHero)
 * et la logique de données sont inchangés.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { CircuitTraceHero } from '@/circuit/CircuitTraceHero';
import {
  type CircuitService,
  type DirectoryCircuit,
  SERVICE_KIND_LABELS,
  circuitSubtitle,
  groupServicesByKind,
} from '@/services/ecosystemLogic';
import { fetchDirectoryCircuits, listCircuitServices } from '@/services/ecosystemService';
import { fetchCircuitCenterline } from '@/services/circuitsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function CircuitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(id) ? id[0] : id;

  const [circuit, setCircuit] = useState<DirectoryCircuit | null>(null);
  const [services, setServices] = useState<CircuitService[]>([]);
  // Tracé affiché seulement si CE circuit a une géométrie réelle (jamais maquillé).
  const [hasTrace, setHasTrace] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!circuitId) return;
    Promise.all([
      fetchDirectoryCircuits(),
      listCircuitServices(circuitId),
      fetchCircuitCenterline(circuitId),
    ])
      .then(([circuits, svcs, centerline]) => {
        if (!cancelled) {
          setCircuit(circuits.find((c) => c.id === circuitId) ?? null);
          setServices(svcs);
          setHasTrace(!!centerline && centerline.length > 1);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [circuitId]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="CIRCUIT" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const title = circuit?.officialName ?? circuit?.name ?? 'Circuit';
  const groups = groupServicesByKind(services);

  return (
    <Screen>
      <AppBar title="CIRCUIT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
        {circuit && circuitSubtitle(circuit) ? (
          <Text style={s.subtitle}>{circuitSubtitle(circuit)}</Text>
        ) : null}

        {/* Tracé 3D du circuit (specs v4 §05 §5.2) — géométrie seule, sans session. */}
        {hasTrace ? (
          <View style={{ marginTop: theme.spacing.xxl }}>
            <View style={s.headRow}>
              <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
              <SectionLabel>Le tracé</SectionLabel>
            </View>
            <View style={{ marginTop: theme.spacing.md }}>
              <CircuitTraceHero circuitId={circuitId} height={300} defaultLayer="geometry" />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: theme.spacing.xxl }}>
          <View style={s.headRow}>
            <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
            <SectionLabel>Autour du circuit</SectionLabel>
          </View>
        </View>

        {groups.length === 0 ? (
          <Card
            style={[
              s.dataPanel,
              {
                alignItems: 'center',
                paddingVertical: theme.spacing.xxl,
                marginTop: theme.spacing.md,
              },
            ]}
          >
            <Text style={s.emptyHint}>
              Les services autour de ce circuit seront référencés ici.
            </Text>
          </Card>
        ) : (
          groups.map((group) => (
            <View key={group.kind} style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
              <SectionLabel>{SERVICE_KIND_LABELS[group.kind]}</SectionLabel>
              {group.items.map((svc) => (
                <ServiceCard key={svc.id} service={svc} />
              ))}
            </View>
          ))
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function ServiceCard({ service }: { service: CircuitService }) {
  const openUrl = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Card style={s.dataPanel}>
      <Text style={s.serviceName}>{service.name}</Text>
      {service.organizer ? <Text style={s.serviceMeta}>{service.organizer}</Text> : null}
      {service.description ? <Text style={s.serviceBody}>{service.description}</Text> : null}
      {service.address ? <Text style={s.serviceAddr}>{service.address}</Text> : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md,
        }}
      >
        {service.url ? <Action label="Site" onPress={() => openUrl(service.url)} /> : null}
        {service.contactEmail ? (
          <Action label="E-mail" onPress={() => openUrl(`mailto:${service.contactEmail}`)} />
        ) : null}
        {service.contactPhone ? (
          <Action label="Téléphone" onPress={() => openUrl(`tel:${service.contactPhone}`)} />
        ) : null}
      </View>
    </Card>
  );
}

// Libellé d'accessibilité explicite par action (le texte visible reste court).
const ACTION_A11Y: Record<string, string> = {
  Site: 'Ouvrir le site',
  'E-mail': 'Envoyer un e-mail',
  Téléphone: 'Appeler',
};

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ACTION_A11Y[label] ?? label}
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: 1,
        borderColor: theme.palette.edge,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={s.actionT}>{label}</Text>
    </Pressable>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
    marginTop: theme.spacing.sm,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  dataPanel: {
    backgroundColor: theme.palette.card2,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  serviceName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  serviceMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  serviceBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  serviceAddr: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  actionT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  // Cible tactile confortable pour le lien « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
