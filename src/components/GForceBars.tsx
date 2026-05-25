/**
 * GForceBars — visualisation sobre des accélérations vécues sur un virage.
 *
 * Trois barres horizontales (latéral, freinage, accélération) avec la
 * valeur numérique alignée à droite. Échelle commune (0 à 2.0 g par
 * défaut) pour comparer visuellement les 3 axes d'un coup d'œil.
 *
 * Doctrine : pas de gauge circulaire criarde façon cockpit F1. Juste
 * une lecture claire qui dit « voici ce que la voiture a vécu » sans
 * juger.
 *
 * Utilisé sur l'écran #15 Zoom virage. Le coach et le pilote pro
 * lisent les g comme indicateur d'engagement ; le particulier voit
 * « gros chiffre = c'était engagé ici » sans avoir besoin de comprendre
 * la physique.
 */

import { View, Text } from 'react-native';

import { colors, fontSize, fontWeight, spacing } from '@/theme/tokens';

export interface GForceBarsProps {
  /** G latéral max (positif). */
  lateralG: number | null;
  /** G freinage max (positif, valeur absolue de la décélération). */
  brakingG: number | null;
  /** G accélération max (positif). */
  accelG: number | null;
  /** Échelle max en g pour la largeur des barres. Par défaut 2.0. */
  scaleMaxG?: number;
  /** Compare avec une 2e session (mêmes 3 valeurs). Optionnel. */
  compare?: {
    lateralG: number | null;
    brakingG: number | null;
    accelG: number | null;
    label?: string;
  };
}

export function GForceBars({
  lateralG,
  brakingG,
  accelG,
  scaleMaxG = 2.0,
  compare,
}: GForceBarsProps) {
  return (
    <View style={{ gap: spacing.md }}>
      <Bar
        label="Latéral"
        value={lateralG}
        compareValue={compare?.lateralG ?? null}
        compareLabel={compare?.label}
        scaleMaxG={scaleMaxG}
        color={colors.accent.red}
      />
      <Bar
        label="Freinage"
        value={brakingG}
        compareValue={compare?.brakingG ?? null}
        compareLabel={compare?.label}
        scaleMaxG={scaleMaxG}
        color={colors.margin.yellow}
      />
      <Bar
        label="Accélération"
        value={accelG}
        compareValue={compare?.accelG ?? null}
        compareLabel={compare?.label}
        scaleMaxG={scaleMaxG}
        color={colors.margin.green}
      />
    </View>
  );
}

function Bar({
  label,
  value,
  compareValue,
  compareLabel,
  scaleMaxG,
  color,
}: {
  label: string;
  value: number | null;
  compareValue: number | null;
  compareLabel?: string;
  scaleMaxG: number;
  color: string;
}) {
  const pct = value !== null ? Math.min(100, (Math.abs(value) / scaleMaxG) * 100) : 0;
  const comparePct =
    compareValue !== null ? Math.min(100, (Math.abs(compareValue) / scaleMaxG) * 100) : null;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: spacing.xs,
        }}
      >
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.caption,
            fontWeight: fontWeight.regular,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
            fontFamily: 'Menlo',
          }}
        >
          {value !== null ? `${value.toFixed(2)} g` : '—'}
        </Text>
      </View>

      {/* Rail */}
      <View
        style={{
          height: 8,
          backgroundColor: colors.background.elevated,
          borderRadius: 4,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        {/* Barre principale */}
        <View
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </View>

      {/* Barre comparée (session B) sous la principale */}
      {comparePct !== null ? (
        <View style={{ marginTop: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 2,
            }}
          >
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.eyebrow }}>
              {compareLabel ?? 'Comparée'}
            </Text>
            <Text
              style={{
                color: colors.text.tertiary,
                fontSize: fontSize.eyebrow,
                fontFamily: 'Menlo',
              }}
            >
              {compareValue !== null ? `${compareValue.toFixed(2)} g` : '—'}
            </Text>
          </View>
          <View
            style={{
              height: 4,
              backgroundColor: colors.background.elevated,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${comparePct}%`,
                backgroundColor: colors.text.tertiary,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
