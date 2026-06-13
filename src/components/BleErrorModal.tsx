/**
 * Modal BLE error (#25 du sitemap).
 *
 * S'affiche quand la connexion BLE a été perdue plus de 30s et que les
 * reconnect auto ont échoué. Deux choix proposés au pilote :
 *   - Reconnecter : nouvelle tentative immédiate
 *   - Continuer sans : abandon, l'app passe en mode dégradé (pas de
 *     télémétrie, mais les données déjà reçues restent)
 *
 * Doctrine : orange (pas rouge), texte rassurant ("vos données déjà
 * enregistrées sont sauvegardées"), pas de panique.
 */

import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { abandonReconnect, manualReconnect } from '@/ble/initBle';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useUIStore } from '@/store/useUIStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export function BleErrorModal() {
  // Doctrine — Principe 3 « silence en piste » : pendant le roulage
  // (S6_roulage), aucun écran/overlay ne s'affiche, quelle que soit la
  // cause (perte BLE, timeout). Garde-fou de rendu = garantie dure,
  // indépendante de qui a mis `bleErrorModalVisible` à true. La
  // reconnexion automatique continue en fond ; l'état se consulte au
  // paddock, à l'arrêt.
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
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            padding: spacing.xxl,
            width: '100%',
            maxWidth: 420,
          }}
        >
          <Text
            style={[typography.eyebrow, { color: colors.system.warning, marginBottom: spacing.md }]}
          >
            ÉQUIPEMENT
          </Text>
          <Text style={[typography.screenTitle, { marginBottom: spacing.md }]}>
            Connexion à l'équipement perdue.
          </Text>
          <Text
            style={[typography.body, { color: colors.text.secondary, marginBottom: spacing.xl }]}
          >
            Vos données déjà enregistrées sont sauvegardées. Vous pouvez tenter une reconnexion ou
            continuer sans télémétrie pour cette session.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onReconnect}
            disabled={reconnecting}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: borderRadius.lg,
              backgroundColor: colors.accent.red,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : reconnecting ? 0.6 : 1,
              marginBottom: spacing.md,
            })}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.medium,
              }}
            >
              {reconnecting ? 'Reconnexion…' : 'Reconnecter'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onAbandon}
            disabled={reconnecting}
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
              Continuer sans
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
