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
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { INTENTION_MAX } from '@/services/intentionLogic';
import {
  getPendingIntention,
  savePendingIntention,
  type SessionIntention,
} from '@/services/intentionsService';
import { Button, ConsentRow, Field, SectionHeader, colors, space, typo } from '@/ui/v2';

type Etat = 'repos' | 'envoi' | 'gardee';

export interface CarteProchaineFoisProps {
  /** Circuit de la séance qui vient de finir — contexte de stockage. */
  circuitId: string | null;
}

export function CarteProchaineFois({ circuitId }: CarteProchaineFoisProps) {
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
    } else {
      setEtat('repos');
      setErreur(res.error ?? "Votre intention n'a pas pu être gardée.");
    }
  }

  return (
    <View style={styles.carte}>
      <SectionHeader eyebrow="LA PROCHAINE FOIS" />
      <Text style={styles.question}>Que voulez-vous garder en tête ?</Text>
      <Text style={styles.aide}>
        Vos mots, pas ceux de l&apos;application. Vous les retrouverez au départ de votre prochaine
        séance.
      </Text>

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
