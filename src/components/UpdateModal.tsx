/**
 * Écran #27 — App update.
 *
 * Modal qui s'affiche à la première ouverture après détection d'une MAJ
 * disponible. 3 cards expliquent les nouveautés, 2 boutons : Mettre à
 * jour (primaire) ou Plus tard.
 *
 * Pilotée par `useUIStore.updateModalVisible`. Le check de version
 * (Expo Updates) sera câblé en sem 13 — pour V1, le modal n'apparaît
 * que si on l'active manuellement depuis le debug.
 */

import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useUIStore } from '@/store/useUIStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.background.elevated,
            borderTopLeftRadius: borderRadius.xxl,
            borderTopRightRadius: borderRadius.xxl,
            padding: spacing.xl,
            paddingBottom: spacing.huge,
          }}
        >
          <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>
            MISE À JOUR DISPONIBLE
          </Text>
          <Text style={[typography.screenTitle, { marginBottom: spacing.xxl }]}>
            Version {release.version}
          </Text>

          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: spacing.md }}>
            {release.highlights.map((h, i) => (
              <View
                key={i}
                style={{
                  padding: spacing.lg,
                  borderRadius: borderRadius.lg,
                  borderWidth: 0.5,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <Text
                  style={[
                    typography.eyebrow,
                    { color: colors.accent.red, marginBottom: spacing.xs },
                  ]}
                >
                  {h.eyebrow}
                </Text>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.bodyLarge,
                    fontWeight: fontWeight.light,
                    marginBottom: spacing.xs,
                  }}
                >
                  {h.title}
                </Text>
                <Text style={[typography.caption, { color: colors.text.secondary }]}>{h.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
            <Pressable
              accessibilityRole="button"
              onPress={onUpdate}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: borderRadius.lg,
                backgroundColor: colors.accent.red,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.medium,
                }}
              >
                Mettre à jour
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onLater}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.border.medium,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  fontWeight: fontWeight.regular,
                }}
              >
                Plus tard
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
