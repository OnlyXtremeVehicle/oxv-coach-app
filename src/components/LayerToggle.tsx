/**
 * LayerToggle (V9 §17 Data) — sélecteur de couches du tracé.
 *
 * Bascule entre les angles de lecture d'une séance (tracé, vitesse, marges).
 * Une couche sans matière reste VISIBLE mais désactivée, avec sa raison
 * factuelle juste dessous — on n'efface pas en douce ce qui manque (doctrine
 * d'honnêteté). Aucune couche n'est une note : ce sont des lectures.
 *
 * Présentation sobre : la puce active se distingue par le contour, pas par l'or
 * ni le rouge (réservés donnée / marque). Vouvoiement, pas d'emoji.
 */

import { Pressable, Text, View } from 'react-native';

import * as haptics from '@/lib/haptics';
import type { MapLayer, MapLayerKey } from '@/services/mapLayersLogic';
import { theme } from '@/theme/v2';

export function LayerToggle({
  layers,
  active,
  onSelect,
}: {
  layers: MapLayer[];
  active: MapLayerKey;
  onSelect: (key: MapLayerKey) => void;
}) {
  const activeHint = layers.find((l) => l.key === active)?.hint ?? null;
  const unavailable = layers.filter((l) => !l.available);

  return (
    <View>
      <View style={s.row} accessibilityRole="tablist">
        {layers.map((layer) => {
          const isActive = layer.key === active;
          return (
            <Pressable
              key={layer.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive, disabled: !layer.available }}
              accessibilityLabel={
                layer.available
                  ? layer.label
                  : `${layer.label}. ${layer.unavailableReason ?? 'Indisponible'}`
              }
              disabled={!layer.available}
              onPress={() => {
                if (!layer.available) return;
                haptics.tap();
                onSelect(layer.key);
              }}
              style={[
                s.chip,
                isActive ? s.chipActive : null,
                !layer.available ? s.chipDisabled : null,
              ]}
            >
              <Text
                style={[
                  s.chipLabel,
                  isActive ? s.chipLabelActive : null,
                  !layer.available ? s.chipLabelDisabled : null,
                ]}
              >
                {layer.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeHint ? <Text style={s.hint}>{activeHint}</Text> : null}

      {unavailable.length > 0 ? (
        <View style={s.reasons}>
          {unavailable.map((l) => (
            <Text key={l.key} style={s.reason}>
              {l.label} — {l.unavailableReason}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = {
  row: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chipActive: {
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  chipLabelActive: {
    color: theme.palette.cream,
  },
  chipLabelDisabled: {
    color: theme.palette.faint,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  reasons: {
    marginTop: theme.spacing.sm,
    gap: 2,
  },
  reason: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: theme.palette.faint,
    lineHeight: 15,
  },
};
