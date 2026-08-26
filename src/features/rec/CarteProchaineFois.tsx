/**
 * CarteProchaineFois — le troisième acte de la fin de séance. Kit V2.
 *
 * *« Poser la variable de la prochaine fois »* — Arbre pilote, `rec/fin`,
 * étape 8, acte 3.
 *
 * ---
 *
 * POURQUOI ELLE ARRIVE MAINTENANT
 *
 * Le classement J5 a trouvé que `savePendingIntention` n'avait que **deux
 * appelants**, tous deux dans l'arbre V1 — `prochaine-fois.tsx` et
 * `IntentionCard`, ce dernier monté par le seul écran de préparation. Aucun
 * écran d'`app/(app2)` n'écrivait d'intention.
 *
 * Le reste de la chaîne, lui, existait déjà en V2 : le carnet LIT les
 * intentions, et la capture les CONSOMME au démarrage de la séance suivante.
 * Le lecteur et le consommateur étaient en place, le producteur allait
 * disparaître avec l'arbre V1 — et l'étape 8 serait devenue une spécification
 * sans code.
 *
 * ---
 *
 * LA QUESTION EST CELLE DE L'APRÈS, PAS CELLE DE L'AVANT
 *
 * La carte V1 demandait « Qu'aimeriez-vous explorer aujourd'hui ? » : elle
 * vivait avant la séance. Ici on sort de piste, et la question porte sur la
 * fois suivante. Le service est le même — `savePendingIntention` n'écrit
 * qu'UNE intention en attente à la fois, et la met à jour plutôt que d'en
 * empiler une seconde.
 *
 * ---
 *
 * L'APPLICATION NE PROPOSE RIEN
 *
 * Ni gabarit, ni suggestion, ni pré-remplissage. Le champ est vide et le
 * placeholder n'oriente pas le contenu. Si une intention en attente existe
 * déjà, elle est rappelée telle que le pilote l'a écrite — pour la modifier,
 * jamais comme une proposition de l'app.
 *
 * L'acte est FACULTATIF : rien ne bloque la sortie de l'écran. Une variable
 * qu'on impose n'est plus la sienne.
 *
 * ---
 *
 * DEUX MOMENTS, UNE SEULE SURFACE D'ÉCRITURE (lot 7a, M01)
 *
 * La reconnaissance M01 a mesuré que l'écran de PRÉPARATION ne portait aucune
 * occurrence du mot « intention », alors que le hub PISTE annonce
 * « Conditions, check-list, intention ». Le pilote posait ce qu'il voulait
 * regarder en SORTANT de piste, et ne le revoyait qu'après avoir roulé.
 *
 * Plutôt que d'écrire une seconde carte de saisie — deux producteurs pour une
 * même ligne `session_intentions`, deux copies à faire dériver — cette carte
 * porte désormais son MOMENT. Le service, lui, ne change pas : il n'existe
 * qu'UNE intention en attente à la fois, mise à jour et jamais empilée. Poser
 * en préparation puis corriger en fin de séance touche la même ligne.
 *
 * Seule la formulation change, parce que la question n'est pas la même : avant
 * de rouler on regarde le jour qui vient, après on regarde la fois suivante.
 * Aucune des deux ne demande une action ni ne propose de contenu.
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { INTENTION_MAX, normalizeIntention } from '@/services/intentionLogic';
import {
  getPendingIntention,
  savePendingIntention,
  type SessionIntention,
} from '@/services/intentionsService';
import { Button, ConsentRow, Field, SectionHeader, colors, space, typo } from '@/ui/v2';

type Etat = 'repos' | 'envoi' | 'gardee';

/**
 * Où la carte est montée. `avant` : l'écran de préparation, la séance n'a pas
 * commencé. `apres` : la fin de séance, la question porte sur la fois suivante.
 */
export type MomentIntention = 'avant' | 'apres';

/** Les mots de chaque moment. Ni gabarit ni suggestion : seulement la question. */
const FORMULATIONS: Record<MomentIntention, { eyebrow: string; question: string; aide: string }> = {
  avant: {
    eyebrow: 'CE QUE VOUS VOULEZ REGARDER',
    question: 'Que voulez-vous regarder aujourd’hui ?',
    aide: 'Vos mots, pas ceux de l’application. Vous les retrouverez dans votre bilan, à côté de ce que la séance en dit.',
  },
  apres: {
    eyebrow: 'LA PROCHAINE FOIS',
    question: 'Que voulez-vous garder en tête ?',
    aide: 'Vos mots, pas ceux de l’application. Vous les retrouverez au départ de votre prochaine séance.',
  },
};

export interface CarteProchaineFoisProps {
  /** Circuit rattaché au moment de l'écriture — contexte de stockage. */
  circuitId: string | null;
  /** Avant de rouler, ou en sortie de séance. Décide de la formulation. */
  moment: MomentIntention;
  /**
   * Appelé avec le texte effectivement gardé, pour l'écran qui l'affiche
   * ailleurs (la carte du run, en préparation). `null` quand personne
   * n'écoute — c'est le cas en fin de séance, où rien d'autre ne le rend.
   * Explicitement `null` plutôt qu'omis : un appelant doit décider.
   */
  onGardee: ((texte: string) => void) | null;
}

export function CarteProchaineFois({ circuitId, moment, onGardee }: CarteProchaineFoisProps) {
  const [texte, setTexte] = useState('');
  const [partage, setPartage] = useState(false);
  const [existante, setExistante] = useState<SessionIntention | null>(null);
  const [etat, setEtat] = useState<Etat>('repos');
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    getPendingIntention()
      .then((it) => {
        if (annule || !it) return;
        setExistante(it);
        setTexte(it.body);
        setPartage(it.sharedWithCoach);
      })
      .catch(() => {
        // Une intention en attente illisible n'empêche pas d'en écrire une :
        // on ouvre sur un champ vide plutôt que de bloquer l'acte.
      });
    return () => {
      annule = true;
    };
  }, []);

  const prete = texte.trim().length > 0 && etat !== 'envoi';

  async function garder() {
    if (!prete) return;
    setEtat('envoi');
    setErreur(null);
    const res = await savePendingIntention({
      circuitId,
      body: texte,
      sharedWithCoach: partage,
    });
    if (res.ok) {
      if (res.id) setExistante((prev) => (prev ? { ...prev, id: res.id as string } : prev));
      setEtat('gardee');
      // On rend au parent le texte tel que le service l'a borné (mêmes trim et
      // même longueur maximale), pas la valeur brute du champ : ce qui
      // s'affiche ailleurs doit être ce qui est en base.
      const garde = normalizeIntention(texte);
      if (onGardee && garde) onGardee(garde);
    } else {
      setEtat('repos');
      setErreur(res.error ?? "Votre intention n'a pas pu être gardée.");
    }
  }

  const mots = FORMULATIONS[moment];

  return (
    <View style={styles.carte}>
      <SectionHeader eyebrow={mots.eyebrow} />
      <Text style={styles.question}>{mots.question}</Text>
      <Text style={styles.aide}>{mots.aide}</Text>

      <Field
        label="Votre intention"
        optional
        value={texte}
        onChangeText={(t) => {
          setTexte(t);
          // Une intention modifiée n'est plus celle qui a été gardée : le
          // bouton doit redevenir une action, pas un constat.
          if (etat === 'gardee') setEtat('repos');
        }}
        multiline
        maxLength={INTENTION_MAX}
        showCounter
        placeholder="Écrivez ici, si vous le souhaitez."
        error={erreur}
        containerStyle={styles.champ}
      />

      <ConsentRow
        label="Partager avec mon coach"
        hint="Lecture seule. Révocable à tout moment."
        value={partage}
        onValueChange={(v) => {
          setPartage(v);
          if (etat === 'gardee') setEtat('repos');
        }}
        accessibilityLabel="Partager cette intention avec mon coach"
      />

      <View style={styles.action}>
        <Button
          label={etat === 'gardee' ? 'Intention gardée' : existante ? 'Mettre à jour' : 'Garder'}
          variant="ghost"
          onPress={() => void garder()}
          disabled={!prete}
          loading={etat === 'envoi'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { marginTop: space.xl },
  question: {
    fontFamily: typo.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text.hi,
    marginTop: space.sm,
  },
  aide: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  champ: { marginBottom: space.md },
  action: { marginTop: space.md },
});
