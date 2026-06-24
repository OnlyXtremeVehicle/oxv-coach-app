/**
 * ErrorBoundary global — capture les crashs JS. Transposition gaming.
 *
 * Doctrine : message sobre, instructions claires (pas de jargon côté
 * pilote), bouton réessayer en OR. L'erreur réelle part à Sentry.
 * Monté au plus haut niveau dans `app/_layout.tsx`. Migration legacy→v2.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { captureException } from '@/lib/sentry';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  /** Message court pour affichage debug. Pas montré au pilote en prod. */
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Remontée Sentry (no-op en dev / Expo Go via le service)
    captureException(error, {
      componentStack: errorInfo.componentStack ?? undefined,
    });
    if (__DEV__) {
      console.error('[OXV][ErrorBoundary]', error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: palette.night,
          paddingHorizontal: spacing.xl,
          justifyContent: 'center',
        }}
      >
        <Text style={[s.eyebrow, { marginBottom: spacing.lg }]}>IMPRÉVU</Text>
        <Text style={[s.headline, { marginBottom: spacing.xl }]}>Une pause technique.</Text>
        <Text style={[s.manifest, { marginBottom: 40 }]}>
          L&apos;app a rencontré un imprévu. Vos données sont en sécurité.
        </Text>

        <Pressable
          onPress={this.handleRetry}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radius.lg,
            backgroundColor: palette.gold,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={s.ctaTxt}>Réessayer</Text>
        </Pressable>

        {__DEV__ && this.state.errorMessage ? (
          <Text style={[s.devMsg, { marginTop: 40 }]}>[DEV] {this.state.errorMessage}</Text>
        ) : null}
      </SafeAreaView>
    );
  }
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  headline: {
    color: palette.cream,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.display,
    lineHeight: fontSize.display * 1.2,
  },
  manifest: {
    color: palette.creamSoft,
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.bodyLg * 1.6,
  },
  ctaTxt: {
    color: palette.night,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
  },
  devMsg: { color: palette.creamMute, fontFamily: fonts.mono, fontSize: fontSize.small },
};
