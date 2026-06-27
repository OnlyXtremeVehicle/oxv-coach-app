/**
 * GForceBars — visualisation sobre des accélérations vécues sur un virage.
 * Transposition gaming (cockpit factuel).
 *
 * Trois barres horizontales (latéral, freinage, accélération) avec la
 * valeur numérique alignée à droite. Échelle commune (0 à 2.0 g par
 * défaut) pour comparer visuellement les 3 axes d'un coup d'œil.
 *
 * Code-couleur par DIMENSION, jamais de rouge de performance (rouge
 * réservé marque + bande coach + REC) : latéral = or, freinage = bleu,
 * accélération = vert. La valeur reprend la teinte de sa barre (identité
 * instrument), la comparaison reste en cream neutre.
 *
 * Doctrine : pas de gauge circulaire criarde façon cockpit F1. Juste
 * une lecture claire qui dit « voici ce que la voiture a vécu » sans juger.
 */

import { View, Text } from 'react-native';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, dataColors } = theme;
const LAT = palette.gold;
const BRAKE = dataColors.brake;
const ACCEL = dataColors.accel;

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
        color={LAT}
      />
      <Bar
        label="Freinage"
        value={brakingG}
        compareValue={compare?.brakingG ?? null}
        compareLabel={compare?.label}
        scaleMaxG={scaleMaxG}
        color={BRAKE}
      />
      <Bar
        label="Accélération"
        value={accelG}
        compareValue={compare?.accelG ?? null}
        compareLabel={compare?.label}
        scaleMaxG={scaleMaxG}
        color={ACCEL}
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
        style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}
      >
        <Text
          style={{ color: palette.creamSoft, fontFamily: fonts.body, fontSize: fontSize.small }}
        >
          {label}
        </Text>
        <Text style={{ color, fontFamily: fonts.mono, fontSize: fontSize.body }}>
          {value !== null ? `${value.toFixed(2)} g` : '—'}
        </Text>
      </View>

      {/* Rail */}
      <View
        style={{
          height: 8,
          backgroundColor: palette.edge,
          borderRadius: 4,
          overflow: 'hidden',
          flexDirection: 'row',
        }}
      >
        <View style={{ width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>

      {/* Barre comparée (session B) — cream neutre, sans verdict */}
      {comparePct !== null ? (
        <View style={{ marginTop: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text
              style={{
                color: palette.creamMute,
                fontFamily: fonts.mono,
                fontSize: fontSize.eyebrow,
              }}
            >
              {compareLabel ?? 'Comparée'}
            </Text>
            <Text
              style={{
                color: palette.creamMute,
                fontFamily: fonts.mono,
                fontSize: fontSize.eyebrow,
              }}
            >
              {compareValue !== null ? `${compareValue.toFixed(2)} g` : '—'}
            </Text>
          </View>
          <View
            style={{
              height: 4,
              backgroundColor: palette.edge,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${comparePct}%`,
                backgroundColor: palette.creamMute,
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
