/**
 * Le mémo vocal du coach — bouton micro, glyphe, durée réelle.
 *
 * ===========================================================================
 * POURQUOI IL SORT DE `annoter`
 * ===========================================================================
 *
 * Il y vivait comme composant privé (`VoiceMemo`). Le rapport de séance en a
 * besoin à son tour : le critère d'acceptation n° 3 du jalon 6 demande *« une
 * carte de séance reçue par un pilote, AVEC l'audio »*, et le bilan de séance
 * est justement l'endroit où la voix du coach a un sens — c'est le commentaire
 * de la séance entière, pas d'un virage.
 *
 * Deux écrans, un seul mémo. La copie aurait été le geste facile et le mauvais :
 * ce dépôt porte déjà assez de doublons qui divergent en silence — la formule de
 * constance a vécu en deux versions pendant des semaines, chacune persuadée
 * d'être la bonne.
 *
 * Le composant emporte ses propres styles. Extrait sans eux, il aurait dépendu
 * de la feuille de `annoter`, donc de la survie de cet écran — exactement le
 * défaut que la règle du 14/08 nomme : *« avant de supprimer un écran, chercher
 * ce qu'il monte en exclusivité. »*
 *
 * ===========================================================================
 * CE QU'IL N'EST PAS
 * ===========================================================================
 *
 * Il ne tient PAS l'enregistreur. `useAudioRecorder` est un hook, et depuis le
 * SDK 55 expo-audio n'expose aucune fabrique hors React : l'enregistreur doit
 * vivre dans l'écran, qui le passe au service. Ce composant est donc purement
 * présentationnel — il rend un état, il ne le produit pas.
 *
 * La conséquence est voulue : l'écran reste maître de ce qu'il fait du fichier
 * (l'attacher à une annotation de virage, ou à une note de séance), et ce
 * composant n'a rien à savoir de cette différence.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

/** `m:ss` à partir de millisecondes. Jamais de valeur négative affichée. */
export function fmtDuree(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export interface MemoVocalProps {
  /** Enregistrement en cours. */
  recording: boolean;
  /** Un fichier est prêt (enregistré, pas encore envoyé). */
  hasRecording: boolean;
  /** Chrono réel, mesuré par l'écran depuis l'horloge de démarrage. */
  elapsedMs: number;
  onToggle: () => void;
  /** Remplace l'intitulé de la carte. Le rapport dit « de quoi » il s'agit. */
  eyebrow?: string;
}

export function MemoVocal({
  recording,
  hasRecording,
  elapsedMs,
  onToggle,
  eyebrow = 'MÉMO VOCAL',
}: MemoVocalProps) {
  const active = recording || hasRecording;
  const label = recording
    ? 'Arrêter l’enregistrement'
    : hasRecording
      ? 'Mémo prêt · réenregistrer'
      : 'Appuyez pour enregistrer';
  return (
    <View style={s.voiceCard}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <View style={s.voiceRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            recording ? 'Arrêter l’enregistrement' : 'Enregistrer une note vocale'
          }
          onPress={onToggle}
          style={({ pressed }) => [s.micBtn, pressed && { opacity: 0.85 }]}
        >
          <View style={recording ? s.micStop : s.micDot} />
        </Pressable>
        <View style={s.voiceMid}>
          <Waveform active={active} />
          <Text style={s.voiceLabel}>{label}</Text>
        </View>
        {/* La durée n'apparaît QUE si elle a été mesurée. Un mémo déjà envoyé,
            relu depuis la base, n'a pas de chrono en mémoire : afficher « 0:00 »
            fabriquerait une donnée. L'absence se tait, elle ne vaut pas zéro. */}
        {active && elapsedMs > 0 ? (
          <Text style={s.voiceDuration}>{fmtDuree(elapsedMs)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Glyphe waveform décoratif, masqué de l'accessibilité.
 *
 * Motif FIXE, et il faut le dire : ce ne sont pas des amplitudes mesurées. Un
 * dessin qui aurait l'air d'un signal sans en être un mentirait sur ce que
 * l'application sait — la règle « toute valeur affichée trace vers une source
 * réelle » vaut aussi pour ce qui ressemble à une valeur.
 */
function Waveform({ active }: { active: boolean }) {
  const heights = [7, 14, 22, 12, 26, 9, 20, 16, 28, 11, 18, 24, 10, 15];
  const color = active ? palette.coachAccent : palette.cardBorderProminent;
  return (
    <View
      style={s.waveform}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {heights.map((h, i) => (
        <View key={i} style={[s.waveBar, { height: h, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  voiceCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.coachAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.cream,
  },
  micStop: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: palette.cream,
  },
  voiceMid: { flex: 1, gap: spacing.xs },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  voiceDuration: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    letterSpacing: 0.5,
  },
});
