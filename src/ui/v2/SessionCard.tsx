/**
 * SessionCard — carte de séance : mini Photo 56 px à gauche (blurhash,
 * fallback tuile OxvIcon `circuit` — jamais d'image stock), circuit +
 * date, chrono mono au millième à droite (`chronoMs` en MILLISECONDES,
 * conversion via msToLapLabel, testée).
 *
 * HeroMorph : la carte est une SOURCE (`useHeroMorphSource`). Passer un
 * `morphId` fige la géométrie au tap (capture() juste avant `onPress`) ;
 * l'écran Bilan la consomme avec `useHeroMorphTarget(morphId)`. Sans
 * `morphId`, aucune capture — la navigation retombe sur la porte.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { OxvIcon } from './icons';
import { Photo } from './media';
import { PressScale, useHeroMorphSource } from './motion';
import { colors, radius, space, type as typo } from './tokens';
import { msToLapLabel } from './uiLogic';

const THUMB_SIZE = 56;

export interface SessionCardProps {
  circuit: string;
  dateLabel: string;
  /** Chrono de référence en millisecondes. */
  chronoMs?: number;
  /** Média de la séance. Absent → tuile tracé (icône circuit). */
  photoUri?: string;
  /** Blurhash du média quand il est stocké en base. */
  photoBlurhash?: string;
  onPress?: () => void;
  /** Identifiant HeroMorph — géométrie capturée au tap si présent. */
  morphId?: string;
  style?: StyleProp<ViewStyle>;
}

export function SessionCard({
  circuit,
  dateLabel,
  chronoMs,
  photoUri,
  photoBlurhash,
  onPress,
  morphId,
  style,
}: SessionCardProps) {
  const { ref, capture } = useHeroMorphSource(morphId ?? 'session-card');
  const chronoLabel = chronoMs !== undefined ? msToLapLabel(chronoMs) : undefined;

  const content = (
    <View ref={ref} collapsable={false} style={[styles.card, style]}>
      {photoUri !== undefined ? (
        <Photo
          uri={photoUri}
          blurhash={photoBlurhash}
          style={styles.thumb}
          accessibilityLabel={circuit}
        />
      ) : (
        <View style={styles.thumbFallback}>
          <OxvIcon name="circuit" size={26} color={colors.text.low} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.circuit} numberOfLines={1}>
          {circuit}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {dateLabel}
        </Text>
      </View>
      {chronoLabel !== undefined ? (
        <Text style={styles.chrono} numberOfLines={1}>
          {chronoLabel}
        </Text>
      ) : null}
    </View>
  );

  if (onPress === undefined) return content;

  const handlePress = () => {
    // Fige la géométrie AVANT la navigation (contrat HeroMorph).
    if (morphId !== undefined) capture();
    onPress();
  };

  return (
    <PressScale
      onPress={handlePress}
      accessibilityLabel={
        chronoLabel !== undefined
          ? `${circuit}, ${dateLabel}, ${chronoLabel}`
          : `${circuit}, ${dateLabel}`
      }
    >
      {content}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.md,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.cell,
  },
  thumbFallback: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  circuit: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  date: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },
  chrono: {
    fontFamily: typo.monoSemi,
    fontSize: 16,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
});
