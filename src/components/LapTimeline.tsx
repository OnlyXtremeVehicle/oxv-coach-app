/**
 * LapTimeline (V9 §17 Data) — frise de régularité, tour par tour.
 *
 * Chaque tour est une barre située par son écart au tour MÉDIAN (au-dessus =
 * plus long, au-dessous = plus court). La dispersion des barres se lit d'un coup
 * d'œil : c'est votre régularité. Présentation pure (modèle calculé ailleurs).
 *
 * Doctrine : un fait spatial, jamais un classement. Or = donnée (tour de
 * référence, simple repère) ; pas de rouge, pas de vert « bon/mauvais ». Marche
 * sans trames du boîtier (sort des durées de la table laps). Vouvoiement.
 */

import { Pressable, Text, View } from 'react-native';

import type { LapTimelineModel } from '@/services/lapTimelineLogic';
import { theme } from '@/theme/v2';

const BAND_H = 96;
const HALF = BAND_H / 2;
const BAR_MAX = HALF - 6;

function deltaLabel(deltaSeconds: number): string {
  if (Math.abs(deltaSeconds) < 0.05) return 'au tour médian';
  const sign = deltaSeconds > 0 ? '+' : '−';
  return `${sign}${Math.abs(deltaSeconds).toFixed(1).replace('.', ',')} s au médian`;
}

export function LapTimeline({
  model,
  selectedLapNumber,
  onSelect,
}: {
  model: LapTimelineModel;
  selectedLapNumber?: number | null;
  onSelect?: (lapNumber: number) => void;
}) {
  if (model.bars.length < 2) return null;

  const selected = model.bars.find((b) => b.lapNumber === selectedLapNumber) ?? null;

  return (
    <View>
      {/* Lecture : le tour sélectionné, sinon le fait de régularité (amplitude). */}
      <View style={s.readout}>
        {selected ? (
          <Text style={s.readoutText}>
            <Text style={s.readoutStrong}>Tour {selected.lapNumber}</Text>
            {selected.isReference
              ? ' · tour de référence'
              : ` · ${deltaLabel(selected.deltaToMedianSeconds)}`}
          </Text>
        ) : (
          <Text style={s.readoutText}>
            {model.spreadSeconds != null
              ? `Amplitude ${model.spreadSeconds.toFixed(1).replace('.', ',')} s sur ${model.bars.length} tours`
              : `${model.bars.length} tours`}
          </Text>
        )}
      </View>

      <View
        style={s.band}
        accessibilityRole="image"
        accessibilityLabel={`Écart au tour médian sur ${model.bars.length} tours. Amplitude ${
          model.spreadSeconds != null ? model.spreadSeconds.toFixed(1).replace('.', ',') : '0'
        } seconde.`}
      >
        {/* Ligne médiane (référence neutre). */}
        <View style={s.medianLine} />

        {model.bars.map((bar) => {
          const isSel = bar.lapNumber === selectedLapNumber;
          const height = Math.max(2, bar.magnitudePct * BAR_MAX);
          const color = bar.isReference
            ? theme.palette.gold
            : isSel
              ? theme.palette.creamSoft
              : theme.palette.creamMute;
          return (
            <Pressable
              key={bar.lapNumber}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={`Tour ${bar.lapNumber}, ${
                bar.isReference ? 'tour de référence' : deltaLabel(bar.deltaToMedianSeconds)
              }`}
              onPress={() => onSelect?.(bar.lapNumber)}
              style={s.col}
            >
              <View
                style={[
                  s.bar,
                  {
                    height,
                    backgroundColor: color,
                    [bar.below ? 'top' : 'bottom']: HALF,
                    opacity: selectedLapNumber == null || isSel || bar.isReference ? 1 : 0.55,
                  },
                ]}
              />
              {isSel ? <View style={[s.dot, { backgroundColor: color }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={s.caption}>
        Écart au tour médian. La dispersion des barres, c’est votre régularité.
      </Text>
    </View>
  );
}

const s = {
  readout: {
    minHeight: 22,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.sm,
  },
  readoutText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  readoutStrong: {
    fontFamily: theme.fonts.bodyMedium,
    color: theme.palette.cream,
  },
  band: {
    height: BAND_H,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    gap: 2,
  },
  medianLine: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: HALF,
    height: 1,
    backgroundColor: theme.palette.line,
  },
  col: {
    flex: 1,
    height: BAND_H,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bar: {
    // Centrage horizontal par insets (un absolu avec seulement width se cale à
    // gauche en RN) : 18% de marge de chaque côté = barre de 64% centrée.
    position: 'absolute' as const,
    left: '18%' as const,
    right: '18%' as const,
    borderRadius: 2,
  },
  dot: {
    position: 'absolute' as const,
    top: HALF - 3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
