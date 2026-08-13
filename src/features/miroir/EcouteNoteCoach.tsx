/**
 * Le pilote écoute la voix de son coach.
 *
 * ===========================================================================
 * POURQUOI CE COMPOSANT EXISTE
 * ===========================================================================
 *
 * `coach_annotations.audio_url` existe depuis le lot PR-59, le bucket privé
 * `coach-audio` et ses quatre policies depuis le 18/06. Rien, nulle part, ne
 * LISAIT ce fichier : le seul appelant de `getAnnotationAudioUrl` était… aucun.
 *
 * C'est le motif dominant de ce dépôt — la garde posée, non armée. Le coach
 * pouvait enregistrer sa voix ; personne ne pouvait l'entendre.
 *
 * ===========================================================================
 * CE QUE LA POLICY EXIGE, ET QUI N'EST PAS DE L'AFFICHAGE
 * ===========================================================================
 *
 * `coach_audio_select` n'autorise le pilote que si :
 *
 *     a.pilot_id = auth.uid() AND a.visibility = 'shared' AND a.deleted_at IS NULL
 *
 * Le partage n'est donc pas un réglage de présentation : c'est la condition
 * d'accès au FICHIER. Une note gardée en brouillon par le coach ne rendra pas
 * d'URL signée, et c'est le comportement voulu — on ne fait pas écouter au
 * pilote un mémo que le coach n'a pas décidé de lui donner.
 *
 * ===========================================================================
 * L'URL EST RÉSOLUE À L'OUVERTURE, PAS À LA PRESSION
 * ===========================================================================
 *
 * Le bucket est privé : il faut une URL signée (1 h). La résoudre au moment du
 * clic ferait attendre le pilote après son geste, avec un bouton qui ne répond
 * pas. On la résout donc au montage — et seulement si une note vocale existe,
 * donc jamais pour les bilans sans voix.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { getAnnotationAudioUrl } from '@/services/coachAudioService';
import { colors, radius, space, typo } from '@/ui/v2';

import { vueLecture } from './ecouteNoteLogic';

export interface EcouteNoteCoachProps {
  /** Chemin de l'objet (= id de l'annotation). Le composant ne rend rien sans lui. */
  audioPath: string;
}

export function EcouteNoteCoach({ audioPath }: EcouteNoteCoachProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let annule = false;
    setUrl(null);
    setEchec(false);
    getAnnotationAudioUrl(audioPath)
      .then((signee) => {
        if (annule) return;
        if (signee) setUrl(signee);
        else setEchec(true);
      })
      .catch(() => {
        if (!annule) setEchec(true);
      });
    return () => {
      annule = true;
    };
  }, [audioPath]);

  // `useAudioPlayer` recrée son lecteur quand la source change (elle est la clé
  // de l'objet partagé) : passer `null` puis l'URL est le chemin prévu par la
  // bibliothèque, pas un contournement.
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const vue = vueLecture({
    isLoaded: status.isLoaded,
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
  });

  /**
   * L'échec est DIT.
   *
   * Le bilan sait qu'une note vocale existe — `audio_url` est renseignée. Se
   * taire ici laisserait le pilote ignorer que son coach lui a parlé. On ne
   * fabrique pas de lecteur pour autant : on nomme ce qui manque.
   */
  if (echec) {
    return <Text style={s.indispo}>Note vocale momentanément indisponible.</Text>;
  }

  async function onPress() {
    if (!url) return;
    if (status.playing) {
      player.pause();
      return;
    }
    // Rembobiner AVANT de rejouer : arrivé au bout, `play()` seul ne repartirait
    // pas du début.
    if (vue.termine) await player.seekTo(0);
    player.play();
  }

  return (
    <View style={s.bloc}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${vue.libelle} la note vocale de votre coach`}
        accessibilityState={{ disabled: !url, busy: !status.isLoaded && !!url }}
        disabled={!url}
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [s.bouton, pressed && { opacity: 0.85 }]}
      >
        {/* Glyphe simple : triangle au repos, deux barres en lecture. Dessiné en
            vues plutôt qu'en icône — deux formes ne valent pas une dépendance. */}
        {status.playing ? (
          <View style={s.pause}>
            <View style={s.barre} />
            <View style={s.barre} />
          </View>
        ) : (
          <View style={s.triangle} />
        )}
      </Pressable>

      <View style={s.droite}>
        <Text style={s.libelle}>{vue.libelle.toUpperCase()}</Text>
        {/* Ni barre ni chrono tant que la durée n'est pas connue — cf.
            `ecouteNoteLogic`, l'absence ne vaut pas zéro. */}
        {vue.progression !== null ? (
          <View style={s.piste}>
            <View style={[s.avancee, { flex: vue.progression }]} />
            <View style={{ flex: 1 - vue.progression }} />
          </View>
        ) : null}
        {vue.chrono ? <Text style={s.chrono}>{vue.chrono}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bloc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
  },
  /**
   * Le bouton reste SOBRE. La bande du bilan porte déjà l'accent rouge de la
   * voix du coach ; un second rouge ici en ferait deux dans la même zone, ce que
   * le canon couleur interdit.
   */
  bouton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.text.hi,
    backgroundColor: 'transparent',
  },
  pause: { flexDirection: 'row', gap: 3 },
  barre: { width: 3, height: 13, backgroundColor: colors.text.hi, borderRadius: 1 },
  droite: { flex: 1, gap: 4 },
  libelle: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.text.low,
  },
  piste: {
    flexDirection: 'row',
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.border.card,
    overflow: 'hidden',
  },
  avancee: { backgroundColor: colors.text.mid },
  chrono: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.low,
    fontVariant: ['tabular-nums'],
  },
  indispo: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.low,
    marginTop: space.sm,
  },
});
