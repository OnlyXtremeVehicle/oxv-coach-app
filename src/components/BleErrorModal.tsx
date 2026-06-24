/**
 * Modal BLE error (#25 du sitemap). Transposition gaming.
 *
 * S'affiche quand la connexion BLE est perdue > 30s et que les reconnect
 * auto ont échoué. Deux choix : Reconnecter / Continuer sans.
 * Doctrine : OR (pas rouge), texte rassurant, pas de panique.
 * Garde-fou de rendu : silence en piste (S6_roulage). Migration legacy→v2.
 */

import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { abandonReconnect, manualReconnect } from '@/ble/initBle';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useUIStore } from '@/store/useUIStore';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

export function BleErrorModal() {
  // Principe 3 « silence en piste » : pendant le roulage (S6_roulage),
  // aucun overlay, quelle que soit la cause. La reconnexion auto continue
  // en fond ; l'état se consulte au paddock, à l'arrêt.
  const driving = useAppStateStore((s) => s.state === 'S6_roulage');
  const visible = useUIStore((s) => s.bleErrorModalVisible) && !driving;
  const [reconnecting, setReconnecting] = useState(false);

  const onReconnect = async () => {
    if (reconnecting) return;
    setReconnecting(true);
    await manualReconnect();
    setReconnecting(false);
  };

  const onAbandon = () => {
    abandonReconnect();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAbandon}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <View
          style={{
            backgroundColor: palette.card2,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: palette.line,
            padding: spacing.xxl,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <Text style={[s.eyebrow, { marginBottom: spacing.md }]}>ÉQUIPEMENT</Text>
          <Text style={[s.title, { marginBottom: spacing.md }]}>
            Connexion à l&apos;équipement perdue.
          </Text>
          <Text style={[s.body, { marginBottom: spacing.xl }]}>
            Vos données déjà enregistrées sont sauvegardées. Vous pouvez tenter une reconnexion ou
            continuer sans télémétrie pour cette session.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onReconnect}
            disabled={reconnecting}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: palette.gold,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : reconnecting ? 0.6 : 1,
              marginBottom: spacing.md,
            })}
          >
            <Text style={s.ctaPrimary}>{reconnecting ? 'Reconnexion…' : 'Reconnecter'}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onAbandon}
            disabled={reconnecting}
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
            <Text style={s.ctaGhost}>Continuer sans</Text>
          </Pressable>
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
    color: palette.gold,
  },
  title: { color: palette.cream, fontFamily: fonts.display, fontSize: fontSize.h2 },
  body: {
    color: palette.creamSoft,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
  },
  ctaPrimary: { color: palette.night, fontFamily: fonts.bodyMedium, fontSize: fontSize.body },
  ctaGhost: { color: palette.cream, fontFamily: fonts.body, fontSize: fontSize.body },
};
