/**
 * StateWrapper — les 5 états obligatoires d'un écran data (SPEC_BUILD §5).
 *
 *   nominal    — la donnée réelle (children).
 *   loading    — squelette calme (jamais un spinner nu).
 *   empty      — EmptyState doux, jamais culpabilisant (réutilise le primitif).
 *   offline    — dernière lecture datée + reconnexion.
 *   error      — cause + action de reprise.
 *
 * Un seul point d'entrée pour ne plus réécrire ces états écran par écran, et
 * garantir un ton homogène (vouvoiement, factuel, aucune prescription). Ne
 * décide RIEN sur la donnée : l'écran passe l'état, le wrapper le rend.
 *
 * Code couleur : neutre partout. L'erreur n'emprunte PAS le rouge de marque —
 * une erreur technique n'est pas la marque (cf. token d'erreur déféré fondateur).
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/instruments/EmptyState';
import { theme } from '@/theme/v2';
import { Button } from '@/ui/Button';

const { palette, fonts, fontSize, spacing, radius } = theme;

export type ScreenState = 'nominal' | 'loading' | 'empty' | 'offline' | 'error';

export interface StateWrapperProps {
  state: ScreenState;
  /** Contenu nominal (données réelles). */
  children: ReactNode;

  // — loading —
  /** Squelette personnalisé ; sinon, lignes calmes par défaut. */
  skeleton?: ReactNode;
  /** Nombre de lignes du squelette par défaut. */
  skeletonLines?: number;

  // — empty —
  emptyMessage?: string;
  emptyLabel?: string;
  emptySource?: string | null;

  // — offline —
  /** Ex. « Dernière lecture il y a 2 h ». Daté, honnête. */
  lastReadLabel?: string | null;

  // — error —
  /** Cause lisible (ex. « Connexion au serveur interrompue »). */
  errorCause?: string;

  /** Reconnexion (offline) / reprise (error). Sans handler, pas de bouton. */
  onRetry?: () => void;
}

export function StateWrapper({
  state,
  children,
  skeleton,
  skeletonLines = 3,
  emptyMessage = 'Cette lecture apparaîtra après votre première séance.',
  emptyLabel,
  emptySource = null,
  lastReadLabel = null,
  errorCause = 'Lecture momentanément indisponible.',
  onRetry,
}: StateWrapperProps) {
  if (state === 'nominal') return <>{children}</>;

  if (state === 'loading') {
    return (
      <View accessibilityLabel="Chargement" style={s.skeletonWrap}>
        {skeleton ?? <CalmSkeleton lines={skeletonLines} />}
      </View>
    );
  }

  if (state === 'empty') {
    return <EmptyState message={emptyMessage} label={emptyLabel} source={emptySource} />;
  }

  if (state === 'offline') {
    return (
      <View style={s.block} accessibilityRole="summary">
        <Text style={s.blockLabel}>Hors ligne</Text>
        <Text style={s.blockMessage}>
          {lastReadLabel
            ? `Voici votre dernière lecture. ${lastReadLabel}.`
            : 'Voici votre dernière lecture enregistrée.'}
        </Text>
        {onRetry ? (
          <View style={s.action}>
            <Button label="Reconnecter" variant="ghost" onPress={onRetry} />
          </View>
        ) : null}
      </View>
    );
  }

  // error
  return (
    <View style={s.block} accessibilityRole="summary">
      <Text style={s.blockLabel}>Lecture interrompue</Text>
      <Text style={s.blockMessage}>{errorCause}</Text>
      {onRetry ? (
        <View style={s.action}>
          <Button label="Réessayer" variant="ghost" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/** Squelette calme : barres neutres, pas d'animation nerveuse. */
function CalmSkeleton({ lines }: { lines: number }) {
  return (
    <View>
      <View style={[s.skelLine, { width: '55%', height: 20 }]} />
      {Array.from({ length: Math.max(0, lines) }).map((_, i) => (
        <View key={i} style={[s.skelLine, { width: `${72 - i * 12}%` }]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  skeletonWrap: { gap: spacing.sm },
  skelLine: {
    height: 12,
    borderRadius: radius.hud,
    backgroundColor: palette.line,
    marginTop: spacing.sm,
  },
  block: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  blockLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  blockMessage: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: palette.creamMute,
    textAlign: 'center',
  },
  action: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
