/**
 * ErrorBoundary global — capture les crashs JS pour ne pas montrer
 * un écran blanc au pilote.
 *
 * Doctrine : message sobre, instructions claires (pas de blabla
 * technique côté pilote), bouton pour réessayer. L'erreur réelle est
 * envoyée à Sentry et loguée en console pour le debug.
 *
 * Monté au plus haut niveau dans `app/_layout.tsx`.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { captureException } from '@/lib/sentry';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
          backgroundColor: colors.background.primary,
          paddingHorizontal: spacing.xl,
          justifyContent: 'center',
        }}
      >
        <Text
          style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.lg }]}
        >
          IMPRÉVU
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.headline,
            fontWeight: fontWeight.light,
            lineHeight: fontSize.headline * 1.2,
            marginBottom: spacing.xl,
          }}
        >
          Une pause technique.
        </Text>

        <Text
          style={[
            typography.manifest,
            { color: colors.text.secondary, marginBottom: spacing.xxxl },
          ]}
        >
          L'app a rencontré un imprévu. Vos données sont en sécurité.
        </Text>

        <Pressable
          onPress={this.handleRetry}
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
              letterSpacing: 0.5,
            }}
          >
            Réessayer
          </Text>
        </Pressable>

        {__DEV__ && this.state.errorMessage ? (
          <Text
            style={[
              typography.caption,
              {
                color: colors.text.tertiary,
                marginTop: spacing.xxxl,
                fontFamily: 'Menlo',
              },
            ]}
          >
            [DEV] {this.state.errorMessage}
          </Text>
        ) : null}
      </SafeAreaView>
    );
  }
}
