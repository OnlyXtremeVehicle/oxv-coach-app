/**
 * VOUS — Mes déclarations d'incident, et où elles en sont.
 *
 * ===========================================================================
 * L'ÉCRAN QUI MANQUAIT AU BOUT DU SEUL CHEMIN DE SÉCURITÉ DU PRODUIT
 * ===========================================================================
 *
 * Le plan demande, pour l'étape 8 du flux : *« incident à ÉTAT SUIVI »*.
 *
 * Jusqu'au 05/08/2026, un pilote déclarait un incident, lisait « votre
 * déclaration est enregistrée », et n'en entendait plus jamais parler. La table
 * `incident_followups` existait en production depuis le 02/08, avec une
 * politique de lecture ouverte au pilote déclarant. **Rien ne l'écrivait, rien
 * ne la lisait.** Et `incidentService.listMine()` n'avait aucun appelant.
 *
 * Sur le chemin qui sert à signaler ce qui s'est mal passé en piste, le silence
 * est le pire des retours : il apprend au pilote que déclarer ne sert à rien.
 *
 * ===========================================================================
 * CE QUE CET ÉCRAN NE FAIT PAS, ET POURQUOI
 * ===========================================================================
 *
 * Il ne permet PAS de modifier une déclaration. La ligne est immuable une fois
 * créée — c'est une décision de la base, pas une omission d'interface, et elle
 * est juste : un incident déclaré puis réécrit ne vaudrait rien.
 *
 * Il n'affiche AUCUN état inventé. `incident_followups.state` n'a aucune
 * contrainte en base : n'importe quelle chaîne peut y entrer. Un état que
 * l'application ne connaît pas s'affiche tel quel, marqué comme non reconnu,
 * plutôt que d'être traduit au jugé ou masqué. Voir `incidentSuiviLogic`.
 *
 * Et une déclaration sans suivi n'est pas un blanc : elle est « reçue, pas
 * encore examinée ». Laisser un vide ferait lire un oubli là où il y a une
 * ligne enregistrée.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dateCourte,
  etatCourant,
  suivisAffichables,
  type SuiviAffichable,
  type SuiviBrut,
} from '@/features/rec/incidentSuiviLogic';
import { listFollowups, listMine, type IncidentRow } from '@/services/v2/incidentService';
import { BackChevron, chromeStyles } from '@/ui/v2/EcranChrome';
import { PressScale } from '@/ui/v2/motion/PressScale';
import { StateView } from '@/ui/v2';
import { colors, radius, space, typo } from '@/ui/v2';

interface Declaration {
  incident: IncidentRow;
  suivis: SuiviAffichable[];
}

export default function DeclarationsScreen() {
  const insets = useSafeAreaInsets();
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [declarations, setDeclarations] = useState<Declaration[]>([]);

  const charger = useCallback(async () => {
    setEtat('chargement');
    try {
      const incidents = await listMine();
      // Une seule requête pour tous les suivis : autant d'appels que de
      // déclarations rendrait l'écran lent dès la troisième.
      const parIncident: Record<string, SuiviBrut[]> = await listFollowups(
        incidents.map((i) => i.id)
      );
      setDeclarations(
        incidents.map((incident) => ({
          incident,
          suivis: suivisAffichables(parIncident[incident.id] ?? []),
        }))
      );
      setEtat('pret');
    } catch {
      setEtat('erreur');
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <View style={chromeStyles.root}>
      <View style={[chromeStyles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale onPress={() => router.back()} accessibilityLabel="Retour">
          <BackChevron />
        </PressScale>
        <Text style={chromeStyles.title}>DÉCLARATIONS</Text>
        <View style={chromeStyles.headerSpacer} />
      </View>

      {etat === 'chargement' ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.text.mid} />
        </View>
      ) : etat === 'erreur' ? (
        <StateView
          state="error"
          errorMessage="Vos déclarations n’ont pas pu être relues."
          onRetry={() => void charger()}
          style={styles.marge}
        />
      ) : declarations.length === 0 ? (
        <StateView
          state="empty"
          emptyMessage="Aucune déclaration. C’est une bonne nouvelle."
          style={styles.marge}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + space.xl }]}
        >
          {declarations.map(({ incident, suivis }) => {
            const courant = etatCourant(suivis);
            const survenue = dateCourte(incident.occurredAt);
            return (
              <View key={incident.id} style={styles.carte}>
                <View style={styles.tete}>
                  <Text
                    style={[styles.etat, courant.inconnu && styles.etatInconnu]}
                    accessibilityLabel={`État : ${courant.texte}`}
                  >
                    {courant.texte}
                  </Text>
                  {/* Une date illisible ne s'affiche pas — jamais « Invalid Date ». */}
                  {survenue ? <Text style={styles.quand}>{survenue}</Text> : null}
                </View>

                <Text style={styles.description}>{incident.description}</Text>

                {suivis.length > 0 ? (
                  <View style={styles.suivis}>
                    {suivis.map((s) => {
                      const le = dateCourte(s.le);
                      return (
                        <View key={s.id} style={styles.suivi}>
                          <Text style={styles.suiviEtat}>
                            {s.etat.texte}
                            {le ? ` · ${le}` : ''}
                          </Text>
                          {s.note ? <Text style={styles.suiviNote}>{s.note}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}

          <Text style={styles.pied}>
            Une déclaration ne peut pas être modifiée une fois envoyée.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marge: {
    marginHorizontal: space.lg,
    marginTop: space.lg,
  },
  liste: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  carte: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    padding: space.lg,
    gap: space.sm,
  },
  tete: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
  },
  etat: {
    fontFamily: typo.bodySemi,
    fontSize: 14,
    color: colors.text.hi,
  },
  /** Un état non reconnu se voit, sans être maquillé en état connu. */
  etatInconnu: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.mid,
  },
  quand: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.mid,
  },
  description: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
  },
  suivis: {
    borderTopWidth: 1,
    borderTopColor: colors.border.hairline,
    paddingTop: space.sm,
    gap: space.sm,
  },
  suivi: {
    gap: 2,
  },
  suiviEtat: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.mid,
  },
  suiviNote: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.hi,
  },
  pied: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.mid,
    marginTop: space.md,
    textAlign: 'center',
  },
});
