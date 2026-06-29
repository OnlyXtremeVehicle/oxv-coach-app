/**
 * MaintenanceGate (PR-45/46) — garde plein écran.
 *
 * Lit `app_config` au démarrage. Si maintenance_mode est actif, ou si la version
 * native installée est inférieure à min_supported_version, affiche un voile
 * bloquant par-dessus toute l'app. Sinon, ne rend rien. Posé en overlay par le
 * layout racine. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

import { Logo } from '@/brand/Logo';
import { type AppConfig, loadAppConfig } from '@/services/appConfigService';
import { isVersionBelow } from '@/services/appConfigVersionLogic';
import { theme } from '@/theme/v2';

export function MaintenanceGate() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAppConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config) return null;

  const version = (Constants.expoConfig?.version ?? '0.0.0') as string;
  const needsUpdate = config.minSupportedVersion
    ? isVersionBelow(version, config.minSupportedVersion)
    : false;

  if (!config.maintenanceMode && !needsUpdate) return null;

  const title = config.maintenanceMode ? 'Une pause technique.' : 'Une mise à jour vous attend.';
  const body = config.maintenanceMode
    ? config.maintenanceMessage?.trim() ||
      'OXV revient très vite. Vos données sont en sécurité — il n’y a rien à faire de votre côté.'
    : 'Une nouvelle version est nécessaire pour continuer. Rendez-vous sur votre store pour mettre à jour l’application.';

  return (
    <View style={s.overlay} accessibilityViewIsModal accessibilityLabel={title}>
      <Logo size={34} />
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={s.body}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.palette.night,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    gap: theme.spacing.lg,
    zIndex: 9999,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    textAlign: 'center',
    lineHeight: theme.fontSize.body * 1.6,
  },
});
