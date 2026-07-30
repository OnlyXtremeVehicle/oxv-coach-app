/**
 * ReportLink — signaler un contenu d'utilisateur. Kit V2, DA Instrument.
 *
 * Porté depuis `src/components/ReportButton.tsx` (kit V1) au lot J5, sur
 * décision fondateur du 29/07/2026.
 *
 * ---
 *
 * POURQUOI CE PORTAGE N'ÉTAIT PAS FACULTATIF
 *
 * Le signalement n'existait que dans trois écrans de `app/(app)`, tous classés
 * « meurt ». Or `app/(app2)` **affiche du contenu écrit par des utilisateurs** —
 * les témoignages coach rendus en citations dans la fiche
 * (`club/coaching.tsx`), les offres partenaires (`club/partenaires.tsx`) — et
 * en collecte de nouveaux. Supprimer l'arbre V1 aurait retiré le signalement
 * d'une application qui continue de publier de l'UGC.
 *
 * ---
 *
 * UNE MODALE, PAS UNE `Sheet`
 *
 * La `Sheet` du kit V2 se dessine en `absoluteFill` DANS l'arbre de vues
 * courant. Or ce lien vit à l'intérieur d'une feuille (la fiche coach) : une
 * `Sheet` imbriquée s'afficherait à l'intérieur de sa parente, bornée par elle.
 * Une `Modal` React Native passe au-dessus de tout, ce qu'un signalement doit
 * faire.
 *
 * ---
 *
 * CE QUE LA BASE VÉRIFIE, ET QUE CE COMPOSANT NE VÉRIFIE PAS
 *
 * Le trigger `moderation_validate_target` exige que la cible existe :
 * `coach_review` → une ligne de `coach_testimonials`, `partner_offer` → une
 * ligne de `partner_offers`. Les identifiants passés ici doivent donc être
 * ceux de ces tables, pas ceux d'une vue intermédiaire. La RLS impose de son
 * côté `reporter_id = auth.uid()` et `status = nouveau`.
 *
 * Le signaleur reste confidentiel. Aucun contenu n'est masqué localement : la
 * décision appartient à la modération, pas au signaleur — et surtout pas à
 * l'appareil de celui qui signale.
 */

import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  type ModerationReason,
  type ModerationTargetType,
  reasonLabel,
  reportContent,
} from '@/services/moderationService';

import { Button } from './Button';
import { Field } from './Field';
import { PressScale } from './motion';
import { SectionHeader } from './SectionHeader';
import { colors, radius, space, type as typo } from './tokens';

const MOTIFS: ModerationReason[] = [
  'contenu_illicite',
  'spam',
  'usurpation',
  'inapproprie',
  'autre',
];

export interface ReportLinkProps {
  targetType: ModerationTargetType;
  targetId: string;
  /**
   * Nom du contenu visé, pour le lecteur d'écran. « Signaler » répété sur dix
   * citations ne dit pas laquelle.
   */
  accessibilityLabel?: string;
}

export function ReportLink({ targetType, targetId, accessibilityLabel }: ReportLinkProps) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<ModerationReason | null>(null);
  const [precision, setPrecision] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recu, setRecu] = useState(false);

  function reinitialiser() {
    setMotif(null);
    setPrecision('');
    setErreur(null);
    setRecu(false);
  }

  async function envoyer() {
    if (motif === null || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const res = await reportContent({
      targetType,
      targetId,
      reason: motif,
      details: precision.trim() ? precision.trim() : undefined,
    });
    setEnvoi(false);
    if (res.ok) setRecu(true);
    else setErreur(res.error ?? "Le signalement n'a pas pu être envoyé.");
  }

  return (
    <>
      <PressScale
        onPress={() => {
          reinitialiser();
          setOuvert(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Signaler ce contenu'}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.declencheur}>Signaler</Text>
      </PressScale>

      <Modal
        visible={ouvert}
        transparent
        animationType="fade"
        onRequestClose={() => setOuvert(false)}
      >
        <View style={styles.fond}>
          <View style={styles.panneau}>
            {recu ? (
              <>
                <SectionHeader eyebrow="SIGNALEMENT" title="Bien reçu." />
                <Text style={styles.corps}>
                  Ce contenu sera examiné. Votre signalement reste confidentiel — l&apos;auteur
                  n&apos;apprendra pas qui l&apos;a émis.
                </Text>
                <View style={styles.action}>
                  <Button label="Fermer" onPress={() => setOuvert(false)} />
                </View>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <SectionHeader eyebrow="SIGNALEMENT" title="Signaler ce contenu" />
                <Text style={styles.corps}>
                  Dites ce qui pose problème. Un signalement ne masque rien immédiatement : il ouvre
                  un examen.
                </Text>

                <SectionHeader eyebrow="MOTIF" />
                <View style={styles.motifs}>
                  {MOTIFS.map((m) => (
                    <PressScale
                      key={m}
                      onPress={() => setMotif(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: motif === m }}
                      accessibilityLabel={reasonLabel(m)}
                    >
                      <View style={[styles.motif, motif === m ? styles.motifActif : null]}>
                        <Text style={styles.motifTexte}>{reasonLabel(m)}</Text>
                      </View>
                    </PressScale>
                  ))}
                </View>

                {motif === 'autre' ? (
                  <Field
                    label="Précisez"
                    value={precision}
                    onChangeText={setPrecision}
                    multiline
                    maxLength={500}
                    showCounter
                    helper="En quelques mots, ce qui pose problème."
                  />
                ) : null}

                {erreur !== null ? <Text style={styles.erreur}>{erreur}</Text> : null}

                <View style={styles.action}>
                  <Button
                    label="Envoyer le signalement"
                    onPress={() => void envoyer()}
                    disabled={motif === null}
                    loading={envoi}
                  />
                  <Button label="Annuler" variant="ghost" onPress={() => setOuvert(false)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * Discret par construction : le signalement est une issue, pas une invitation.
   * Souligné plutôt que coloré — l'accent est réservé au geste qui engage, et
   * signaler n'est pas ce que l'écran propose de faire.
   */
  declencheur: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.dim,
    textDecorationLine: 'underline',
    paddingVertical: space.xs,
  },
  fond: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  panneau: {
    maxHeight: '82%',
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: space.xl,
  },
  corps: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  motifs: { gap: space.xs, marginTop: space.sm, marginBottom: space.md },
  motif: {
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    // 44 pt : la ligne EST la cible tactile, sans hitSlop qui déborderait sur
    // sa voisine — cinq motifs empilés se toucheraient.
    minHeight: 44,
    justifyContent: 'center',
  },
  motifActif: {
    backgroundColor: colors.bg.card2,
    borderColor: colors.border.strong,
  },
  motifTexte: { fontFamily: typo.body, fontSize: 14, color: colors.text.hi },
  erreur: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.accent,
    marginBottom: space.sm,
  },
  action: { gap: space.sm, marginTop: space.md },
});
