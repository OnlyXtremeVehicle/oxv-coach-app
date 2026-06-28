/**
 * MediaGrid — grille de médias de session + visionneuse plein écran (PR-67).
 *
 * Extrait de l'écran session-media pour être réutilisé par la galerie pilote
 * (tous médias, toutes séances) ET l'écran par séance. Grille 2 colonnes, tap
 * pour zoomer une photo (Modal) ou ouvrir la vidéo dans le lecteur natif.
 * Doctrine : sobre, vouvoiement, pas d'emoji. Le rouge n'est utilisé que pour la
 * marque (bouton « Lire la vidéo »), jamais pour de la donnée.
 */

import { useState } from 'react';
import { Dimensions, Image, Linking, Modal, Pressable, Text, View } from 'react-native';

import type { SessionMediaItem } from '@/services/sessionMediaService';
import { theme } from '@/theme/v2';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GUTTER = 8;
const COLUMNS = 2;
const TILE_SIZE = (SCREEN_WIDTH - 2 * 16 - GRID_GUTTER) / COLUMNS;

export function MediaGrid({ items }: { items: SessionMediaItem[] }) {
  const [selected, setSelected] = useState<SessionMediaItem | null>(null);
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GUTTER }}>
        {items.map((item, index) => (
          <MediaTile key={item.id} item={item} index={index} onPress={() => setSelected(item)} />
        ))}
      </View>
      <MediaModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function MediaTile({
  item,
  index,
  onPress,
}: {
  item: SessionMediaItem;
  index: number;
  onPress: () => void;
}) {
  const kind = item.mediaType === 'video' ? 'Vidéo' : 'Photo';
  const label = item.caption ? `${kind} ${index + 1} : ${item.caption}` : `${kind} ${index + 1}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_SIZE,
        height: TILE_SIZE,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: theme.palette.card2,
        borderWidth: 1,
        borderColor: theme.palette.line,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {item.signedUrl ? (
        <Image
          source={{ uri: item.signedUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ color: theme.palette.creamMute, fontSize: theme.fontSize.small }}
          >
            —
          </Text>
        </View>
      )}
      {item.mediaType === 'video' ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: 'absolute',
            bottom: theme.spacing.xs,
            right: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 2,
            borderRadius: theme.radius.sm,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.bodyMedium,
              color: theme.palette.cream,
              fontSize: theme.fontSize.eyebrow,
              letterSpacing: 0.3,
            }}
          >
            Vidéo
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MediaModal({ item, onClose }: { item: SessionMediaItem | null; onClose: () => void }) {
  if (!item) return null;

  const handleVideoOpen = async () => {
    if (!item.signedUrl) return;
    await Linking.openURL(item.signedUrl).catch(() => undefined);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        {item.mediaType === 'video' ? (
          <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
            <Text style={{ color: theme.palette.cream, fontSize: theme.fontSize.body }}>
              {item.caption ?? 'Vidéo de session'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lire la vidéo"
              onPress={handleVideoOpen}
              style={({ pressed }) => ({
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.lg,
                borderRadius: theme.radius.md,
                backgroundColor: theme.palette.red,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: theme.fonts.bodyMedium,
                  color: theme.palette.cream,
                  fontSize: theme.fontSize.body,
                  letterSpacing: 0.3,
                }}
              >
                Lire la vidéo
              </Text>
            </Pressable>
          </View>
        ) : item.signedUrl ? (
          <Image
            source={{ uri: item.signedUrl }}
            accessibilityLabel={item.caption ?? 'Photo de session'}
            style={{
              width: SCREEN_WIDTH - 2 * theme.spacing.lg,
              height: SCREEN_WIDTH - 2 * theme.spacing.lg,
            }}
            resizeMode="contain"
          />
        ) : null}
        {item.caption ? (
          <Text
            style={{
              fontFamily: theme.fonts.body,
              marginTop: theme.spacing.lg,
              color: theme.palette.creamSoft,
              fontSize: theme.fontSize.small,
              textAlign: 'center',
              maxWidth: SCREEN_WIDTH - 2 * theme.spacing.xl,
            }}
          >
            {item.caption}
          </Text>
        ) : null}
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            fontFamily: theme.fonts.body,
            marginTop: theme.spacing.xxl,
            color: theme.palette.creamMute,
            fontSize: theme.fontSize.small,
          }}
        >
          Toucher pour fermer
        </Text>
      </Pressable>
    </Modal>
  );
}
