/**
 * Écran #27 — App update. Transposition gaming.
 *
 * Modal de MAJ disponible : 3 cartes de nouveautés, 2 boutons (Mettre à
 * jour primaire en OR / Plus tard ghost). Eyebrows de catégorie en or.
 * Pilotée par `useUIStore.updateModalVisible`. Migration legacy→v2.
 */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useUIStore } from '@/store/useUIStore';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

export interface UpdateRelease {
  version: string;
  highlights: { eyebrow: string; title: string; body: string }[];
}

const DEFAULT_RELEASE: UpdateRelease = {
  version: '1.1.0',
  highlights: [
    {
      eyebrow: 'CARTE',
      title: 'Trajectoire réelle',
      body: 'Votre tracé apparaît maintenant superposé au tour optimal.',
    },
    {
      eyebrow: 'AMÉLIORATION',
      title: 'Marge par virage affinée',
      body: 'Le découpage virage par virage est plus précis sur les enchaînements rapides.',
    },
    {
      eyebrow: 'CORRECTION',
      title: 'Synchronisation Bluetooth',
      body: 'Reconnexion plus fluide après une coupure temporaire.',
    },
  ],
};

interface UpdateModalProps {
  release?: UpdateRelease;
}

export function UpdateModal({ release = DEFAULT_RELEASE }: UpdateModalProps) {
  const visible = useUIStore((s) => s.updateModalVisible);
  const setVisible = useUIStore((s) => s.setUpdateModalVisible);

  const onLater = () => setVisible(false);
  const onUpdate = () => {
    // V1.1 : déclencher Expo Updates ici via Updates.reloadAsync().
    setVisible(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onLater}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: palette.card2,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: spacing.xl,
            paddingBottom: 40,
          }}
        >
          <Text style={[s.eyebrow, { marginBottom: spacing.md }]}>MISE À JOUR DISPONIBLE</Text>
          <Text style={[s.title, { marginBottom: spacing.xxl }]}>Version {release.version}</Text>

          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.md }}>
            {release.highlights.map((h, i) => (
              <View
                key={i}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 0.5,
                  borderColor: palette.line,
                  backgroundColor: palette.night,
                }}
              >
                <Text style={[s.cardEyebrow, { marginBottom: spacing.xs }]}>{h.eyebrow}</Text>
                <Text style={s.cardTitle}>{h.title}</Text>
                <Text style={s.cardBody}>{h.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
            <Pressable
              accessibilityRole="button"
              onPress={onUpdate}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radius.lg,
                backgroundColor: palette.gold,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={s.ctaPrimary}>Mettre à jour</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: palette.edge,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={s.ctaGhost}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  title: { color: palette.cream, fontFamily: fonts.display, fontSize: fontSize.h2 },
  cardEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.gold,
  },
  cardTitle: {
    color: palette.cream,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    marginBottom: spacing.xs,
  },
  cardBody: { color: palette.creamSoft, fontFamily: fonts.body, fontSize: fontSize.small },
  ctaPrimary: { color: palette.night, fontFamily: fonts.bodyMedium, fontSize: fontSize.body },
  ctaGhost: { color: palette.cream, fontFamily: fonts.body, fontSize: fontSize.body },
};
