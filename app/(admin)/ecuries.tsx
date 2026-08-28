/**
 * Vue Admin — répondre aux sorties d'écurie.
 *
 * Le fil de l'écurie déposait, et personne ne répondait : les droits existaient,
 * l'écran manquait. C'est le pendant du fil, et le dernier maillon de la chaîne.
 *
 * ===========================================================================
 * CONFIRMER, C'EST ARRÊTER UNE JOURNÉE
 * ===========================================================================
 *
 * La base refuse une confirmation sans journée, et elle a raison : le fil
 * annonce automatiquement « votre réservation est confirmée » à toute l'écurie.
 * Une annonce sans journée serait vraie et ne servirait à rien — personne ne
 * pourrait s'inscrire.
 *
 * L'écran choisit donc la journée AVANT de confirmer, et le bouton reste éteint
 * tant qu'aucune n'est retenue. Proposer un geste qui échouera est le défaut que
 * ce dépôt corrige partout ailleurs.
 *
 * ===========================================================================
 * CE QUE LA CONFIRMATION DÉCLENCHE, ET QU'ON NE VOIT PAS D'ICI
 * ===========================================================================
 *
 * Elle ouvre la remise de 10 % à chaque pilote de l'écurie, sur cette journée
 * et sur elle seule. Le déclencheur `registrations_remise_justifiee` l'exige :
 * sans demande confirmée, aucune remise ne passe. Confirmer n'est donc pas un
 * accusé de réception — c'est un engagement tarifaire, et l'écran le dit.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { REMISE_ECURIE_PCT, SEUIL_PRIVATISATION } from '@/features/club/filEcurieLogic';
import {
  type DemandeEcurie,
  type JourneeChoisissable,
  clore,
  confirmerDemandeEcurie,
  creerJourneePourEcurie,
  listerDemandesEcurie,
  listerJourneesAVenir,
} from '@/services/ecurieAdminService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const ADMIN = '#22D3EE';

/**
 * Une journée où cette écurie peut s'insérer.
 *
 * Le déclencheur `reservations_ecurie_journee_ouverte` refuse une insertion sur
 * une journée qui n'admet pas les trois classes — « une écurie s'y insérerait
 * amputée ». Proposer ces journées reviendrait à offrir un geste qui échoue :
 * le défaut que ce dépôt corrige partout ailleurs, et qu'il ne faut pas
 * réintroduire ici.
 *
 * Une journée privée ne se propose pas non plus : elle appartient déjà à
 * quelqu'un.
 */
function accueilleUneInsertion(j: JourneeChoisissable): boolean {
  if (j.privee) return false;
  return ['I', 'II', 'III'].every((c) => j.classesAdmises.includes(c));
}

function dateFr(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function EcuriesAdminScreen() {
  const [demandes, setDemandes] = useState<DemandeEcurie[]>([]);
  const [journees, setJournees] = useState<JourneeChoisissable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [reponses, setReponses] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [d, j] = await Promise.all([listerDemandesEcurie(), listerJourneesAVenir()]);
      setDemandes(d);
      setJournees(j);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function confirmer(d: DemandeEcurie) {
    const sessionId = choix[d.id] ?? d.sessionId;
    if (!sessionId) return;
    setBusyId(d.id);
    try {
      const r = await confirmerDemandeEcurie(d.id, sessionId, reponses[d.id] ?? null);
      if (r !== true) {
        // Le motif vient de la base : il dit ce qui manque, mieux qu'un « erreur ».
        Toast.show({ type: 'error', text1: 'Confirmation impossible', text2: r.motif });
        return;
      }
      Toast.show({ type: 'success', text1: 'Sortie confirmée' });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Crée la journée à l'une des dates proposées, puis la retient d'office.
   *
   * Créer sans retenir obligerait à chercher la journée qu'on vient de créer
   * dans une liste de soixante — un geste en deux temps dont le second se
   * perd. La création EST le choix.
   */
  async function creerEtRetenir(d: DemandeEcurie, date: string) {
    setBusyId(d.id);
    try {
      const r = await creerJourneePourEcurie(date);
      if ('motif' in r) {
        Toast.show({ type: 'error', text1: 'Journée non créée', text2: r.motif });
        return;
      }
      setChoix((c) => ({ ...c, [d.id]: r.id }));
      Toast.show({ type: 'success', text1: 'Journée créée et retenue' });
      const j = await listerJourneesAVenir();
      setJournees(j);
    } finally {
      setBusyId(null);
    }
  }

  async function fermer(d: DemandeEcurie) {
    setBusyId(d.id);
    try {
      const r = await clore(d.id, reponses[d.id] ?? null);
      if (r !== true) {
        Toast.show({ type: 'error', text1: 'Clôture impossible', text2: r.motif });
        return;
      }
      Toast.show({ type: 'success', text1: 'Demande close' });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : demandes.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="SORTIES D’ÉCURIE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow} accessibilityRole="header">
          DEMANDES À INSTRUIRE
        </Text>
        <Text style={s.rappel}>
          À partir de {SEUIL_PRIVATISATION} pilotes, le circuit est privatisé sur l’une des trois
          dates proposées. Confirmer ouvre la remise de {REMISE_ECURIE_PCT} % à chaque pilote de
          l’écurie, sur cette journée et sur elle seule.
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={4}
          emptyLabel="Écuries"
          emptyMessage="Aucune sortie d’écurie à instruire."
          emptySource="reservations_ecurie"
          errorCause="Les demandes n’ont pas pu être chargées."
          onRetry={reload}
        >
          <View style={{ gap: theme.spacing.md }}>
            {demandes.map((d) => {
              const busy = busyId === d.id;
              const confirmee = d.statut === 'confirmee';
              const retenue = choix[d.id] ?? d.sessionId ?? '';

              return (
                <Card key={d.id} style={{ borderColor: confirmee ? theme.palette.line : ADMIN }}>
                  <Text style={s.nom}>{d.nomEcurie}</Text>
                  <Text style={s.meta}>
                    {d.effectif} pilotes ·{' '}
                    {d.formule === 'privatisation' ? 'privatisation' : 'insertion'}
                    {` · déposée le ${dateFr(d.creeLe)}`}
                  </Text>

                  {/* Les trois dates souhaitées, actionnables. Celle qui existe
                      déjà se retient ; celle qui n'existe pas se crée. Le
                      capitaine propose des dates libres — il n'y a le plus
                      souvent aucune journée à ces dates-là. */}
                  {d.dates.length > 0 ? (
                    <>
                      <Text style={s.question}>Les trois dates souhaitées</Text>
                      <View style={s.journees}>
                        {d.dates.map((jour) => {
                          const existante = journees.find((j) => j.date === jour);
                          const actif = existante ? retenue === existante.id : false;
                          return (
                            <Pressable
                              key={jour}
                              accessibilityRole="button"
                              accessibilityLabel={
                                existante
                                  ? `Retenir la journée du ${dateFr(jour)}`
                                  : `Créer la journée du ${dateFr(jour)}`
                              }
                              accessibilityState={{ selected: actif, disabled: busy, busy }}
                              disabled={busy || confirmee}
                              hitSlop={theme.hitSlop}
                              onPress={() =>
                                existante
                                  ? setChoix((c) => ({
                                      ...c,
                                      [d.id]: actif ? '' : existante.id,
                                    }))
                                  : creerEtRetenir(d, jour)
                              }
                              style={({ pressed }) => [
                                s.journee,
                                actif ? s.journeeActive : null,
                                { opacity: pressed || busy ? 0.6 : 1 },
                              ]}
                            >
                              <Text style={[s.journeeT, actif ? s.journeeTActive : null]}>
                                {dateFr(jour)}
                                {existante ? '' : ' · à créer'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}

                  {d.message ? <Text style={s.message}>{d.message}</Text> : null}

                  {confirmee ? (
                    <Text style={s.confirme}>
                      {`Confirmée sur la journée du ${dateFr(journees.find((j) => j.id === d.sessionId)?.date ?? '')}.`}
                    </Text>
                  ) : (
                    <>
                      <Text style={s.question}>La journée retenue</Text>
                      <View style={s.journees}>
                        {(() => {
                          /* Une privatisation ne se pose que sur l'une des trois
                             dates souhaitées — le capitaine les a choisies, et le
                             dépôt a créé celles qui manquaient. Une insertion se
                             pose sur une journée qui accueille tout le monde. */
                          const candidates =
                            d.formule === 'privatisation'
                              ? journees.filter((j) => d.dates.includes(j.date))
                              : journees.filter(accueilleUneInsertion);
                          return candidates.length === 0 ? (
                            <Text style={s.meta}>
                              {d.formule === 'privatisation'
                                ? 'Aucune journée aux dates souhaitées. Créez-en une ci-dessus.'
                                : 'Aucune journée ouverte aux trois classes. Une écurie s’y insérerait amputée.'}
                            </Text>
                          ) : (
                            candidates.map((j) => {
                            const actif = retenue === j.id;
                            return (
                              <Pressable
                                key={j.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Retenir la journée du ${dateFr(j.date)}`}
                                accessibilityState={{ selected: actif }}
                                hitSlop={theme.hitSlop}
                                onPress={() =>
                                  setChoix((c) => ({ ...c, [d.id]: actif ? '' : j.id }))
                                }
                                style={({ pressed }) => [
                                  s.journee,
                                  actif ? s.journeeActive : null,
                                  { opacity: pressed ? 0.6 : 1 },
                                ]}
                              >
                                <Text style={[s.journeeT, actif ? s.journeeTActive : null]}>
                                  {dateFr(j.date)}
                                  {/* Une journée proposée n'est pas encore au
                                      catalogue : la retenir la validera. */}
                                  {j.statut === 'proposee' ? ' · à valider' : ''}
                                </Text>
                              </Pressable>
                            );
                            })
                          );
                        })()}
                      </View>

                      <TextInput
                        accessibilityLabel="Mot à l’écurie"
                        placeholder="Un mot à l’écurie (facultatif)"
                        placeholderTextColor={theme.palette.creamMute}
                        multiline
                        value={reponses[d.id] ?? ''}
                        onChangeText={(t) => setReponses((r) => ({ ...r, [d.id]: t }))}
                        style={s.champ}
                      />

                      <View style={s.actions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Confirmer la sortie de ${d.nomEcurie}`}
                          accessibilityState={{ disabled: busy || !retenue, busy }}
                          disabled={busy || !retenue}
                          hitSlop={theme.hitSlop}
                          onPress={() => confirmer(d)}
                          style={({ pressed }) => [
                            s.action,
                            s.actionForte,
                            { opacity: pressed || busy || !retenue ? 0.5 : 1 },
                          ]}
                        >
                          <Text style={[s.actionT, s.actionTForte]}>Confirmer</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Clore la demande de ${d.nomEcurie}`}
                          accessibilityState={{ disabled: busy, busy }}
                          disabled={busy}
                          hitSlop={theme.hitSlop}
                          onPress={() => fermer(d)}
                          style={({ pressed }) => [s.action, { opacity: pressed || busy ? 0.5 : 1 }]}
                        >
                          <Text style={s.actionT}>Clore</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </Card>
              );
            })}
          </View>
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: ADMIN,
    marginBottom: theme.spacing.sm,
  },
  rappel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginBottom: theme.spacing.lg,
  },
  nom: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  message: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  confirme: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: ADMIN,
    marginTop: theme.spacing.sm,
  },
  question: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  journees: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  journee: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
  },
  journeeActive: { borderColor: ADMIN, borderWidth: 2 },
  journeeT: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  journeeTActive: { color: ADMIN },
  champ: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
    minHeight: 60,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
  },
  actionForte: { borderColor: ADMIN },
  actionT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  actionTForte: { color: ADMIN },
};
