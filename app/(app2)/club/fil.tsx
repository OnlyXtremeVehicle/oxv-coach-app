/**
 * LE FIL DE L'ÉCURIE — parler, et organiser une sortie sans quitter la page.
 *
 * ===========================================================================
 * POURQUOI TOUT SE PASSE ICI
 * ===========================================================================
 *
 * Arbitrage du fondateur, 27/08/2026 : « tout doit se faire automatiquement
 * par des interactions dans le tchat de l'écurie ».
 *
 * Le capitaine annonce COMBIEN ILS SONT. C'est tout ce qu'on lui demande. La
 * base calcule la formule — insertion en dessous de dix-sept, privatisation
 * au-delà — et l'annonce se pose d'elle-même dans le fil, par un déclencheur.
 * Personne ne relaie l'information à la main.
 *
 * ===========================================================================
 * DEUX NATURES DE MESSAGE, ET ELLES NE SE RESSEMBLENT PAS
 * ===========================================================================
 *
 * Une parole de membre s'affiche comme une parole. Un message SYSTÈME est un
 * fait posé par le dispositif, et il porte une marque visuelle distincte : les
 * confondre laisserait croire qu'un pilote a annoncé ce que la règle a calculé.
 *
 * La base garantit qu'un membre ne peut pas en fabriquer un — un message
 * système n'a jamais d'auteur, et la politique d'insertion le refuse. L'écran
 * n'a donc aucune vérification à refaire, et ne peut pas se tromper en
 * l'oubliant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { memberDisplayName } from '@/features/club/clubHubLogic';
import { estCapitaine } from '@/features/club/ecurieLogic';
import {
  type MessageFil,
  SEUIL_PRIVATISATION,
  annonceFormule,
  bandeauDemande,
  formuleDepuisEffectif,
  grouperParJour,
  peutDeposer,
  verifierDates,
} from '@/features/club/filEcurieLogic';
import { useEcurie } from '@/features/club/useEcurie';
import {
  MESSAGES_PAR_PAGE,
  type ReservationEcurie,
  deposerReservationEcurie,
  envoyerMessage,
  listerMessagesFil,
  reservationEnCours,
} from '@/services/ecurieFilService';
import { fontSize } from '@/theme/v2';
import { colors, radius, space, StateView, tabBarSpace, typo } from '@/ui/v2';

export default function FilEcurieScreen() {
  const insets = useSafeAreaInsets();
  // `rechargerEcurie` est celui du hook. L'écran d'erreur DOIT l'appeler :
  // le `recharger` local sort immédiatement quand `crewId` est nul, ce qui
  // est précisément le cas quand le hook a échoué — le bouton « Réessayer »
  // était donc inerte, et le pilote pouvait appuyer indéfiniment.
  const {
    ecurie,
    userId,
    loading: chargeEcurie,
    erreur,
    recharger: rechargerEcurie,
  } = useEcurie();

  const [messages, setMessages] = useState<MessageFil[]>([]);
  const [tronque, setTronque] = useState(false);
  const [demande, setDemande] = useState<ReservationEcurie | null>(null);
  const [chargeFil, setChargeFil] = useState(true);
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // Le formulaire de sortie, replié tant qu'on ne l'ouvre pas.
  const [organiser, setOrganiser] = useState(false);
  const [effectifTexte, setEffectifTexte] = useState('');
  const [dates, setDates] = useState<string[]>(['', '', '']);
  const [depot, setDepot] = useState(false);

  const crewId = ecurie?.crewId ?? null;
  const capitaine = estCapitaine(ecurie?.membres ?? [], userId);

  const recharger = useCallback(async () => {
    if (!crewId) {
      setChargeFil(false);
      return;
    }
    setChargeFil(true);
    const [fil, encours] = await Promise.all([
      listerMessagesFil(crewId),
      reservationEnCours(crewId),
    ]);
    setMessages(fil.messages);
    setTronque(fil.tronque);
    setDemande(encours);
    setChargeFil(false);
  }, [crewId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  // L'instant de référence est figé au chargement : un `new Date()` évalué à
  // chaque rendu ferait basculer « Aujourd'hui » en « Hier » pendant la lecture.
  const [maintenant, setMaintenant] = useState(() => new Date());
  const journees = useMemo(() => grouperParJour(messages, maintenant), [messages, maintenant]);

  const effectif = Number.parseInt(effectifTexte, 10);
  const formule = formuleDepuisEffectif(effectif);
  const annonce = annonceFormule(effectif);
  const verdictDates =
    formule === 'privatisation'
      ? verifierDates(dates, new Date().toISOString().slice(0, 10))
      : { valides: true, motif: null, message: null };

  const prenoms = useMemo(() => {
    const m = new Map<string, string>();
    for (const membre of ecurie?.membres ?? []) m.set(membre.userId, memberDisplayName(membre));
    return m;
  }, [ecurie?.membres]);

  async function parler() {
    if (!crewId || !userId) return;
    const texte = saisie.trim();
    if (texte.length === 0) return;
    setEnvoi(true);
    try {
      const ok = await envoyerMessage(crewId, userId, texte);
      if (ok) {
        setSaisie('');
        setMaintenant(new Date());
        await recharger();
      } else {
        Toast.show({ type: 'error', text1: 'Message non transmis' });
      }
    } finally {
      setEnvoi(false);
    }
  }

  async function deposer() {
    if (!Number.isFinite(effectif) || effectif < 1) return;
    if (formule === 'privatisation' && !verdictDates.valides) return;
    setDepot(true);
    try {
      const r = await deposerReservationEcurie(
        effectif,
        null,
        null,
        formule === 'privatisation' ? dates : null,
      );
      if ('motif' in r) {
        // Le motif vient de la base, rédigé pour être lu par un capitaine.
        // Le remplacer par « erreur » perdrait la seule information utile.
        Toast.show({ type: 'error', text1: 'Demande non déposée', text2: r.motif });
        return;
      }
      setOrganiser(false);
      setEffectifTexte('');
      setDates(['', '', '']);
      setMaintenant(new Date());
      await recharger();
    } finally {
      setDepot(false);
    }
  }

  if (chargeEcurie) return <StateView state="loading" />;
  if (erreur) {
    return (
      <StateView
        state="error"
        errorMessage="Le fil de votre écurie n’a pas pu être chargé."
        onRetry={rechargerEcurie}
      />
    );
  }
  if (!ecurie) {
    return (
      <StateView
        state="empty"
        emptyMessage="Vous n’appartenez à aucune écurie. Rejoignez-en une par l’invitation d’un pilote."
      />
    );
  }

  const bandeau = bandeauDemande(demande?.statut ?? null, demande?.formule ?? null);
  const ouvertAuDepot = peutDeposer(capitaine, demande?.statut ?? null);

  return (
    <View style={[s.page, { paddingTop: insets.top + space.md }]}>
      <View style={s.entete}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revenir à l’écurie"
          hitSlop={12}
          onPress={() => router.back()}
        >
          <Text style={s.retour}>←</Text>
        </Pressable>
        <Text style={s.titre} numberOfLines={1}>
          {ecurie.titre}
        </Text>
      </View>

      {bandeau ? (
        <View style={s.bandeau}>
          <Text style={s.bandeauTexte}>{bandeau}</Text>
        </View>
      ) : null}

      <ScrollView
        style={s.fil}
        contentContainerStyle={{ paddingBottom: space.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {chargeFil && messages.length === 0 ? (
          <StateView state="loading" shape="list" />
        ) : journees.length === 0 ? (
          <Text style={s.vide}>
            Rien n’a encore été dit ici. Le fil porte vos échanges et les réponses d’OXV.
          </Text>
        ) : (
          <>
            {tronque ? (
              <Text style={s.vide}>
                Seuls les {MESSAGES_PAR_PAGE} derniers messages sont affichés.
              </Text>
            ) : null}
            {journees.map((j) => (
            <View key={j.jour}>
              <Text style={s.jour}>{j.libelle}</Text>
              {j.messages.map((m) => {
                const systeme = m.nature === 'systeme';
                return (
                  <View key={m.id} style={[s.bulle, systeme ? s.bulleSysteme : null]}>
                    <Text style={[s.auteur, systeme ? s.auteurSysteme : null]}>
                      {systeme ? 'OXV' : (prenoms.get(m.auteurId ?? '') ?? 'Un pilote')}
                    </Text>
                    <Text style={s.texte}>{m.texte}</Text>
                  </View>
                );
              })}
            </View>
            ))}
          </>
        )}
      </ScrollView>

      {ouvertAuDepot ? (
        <View style={s.organiser}>
          {!organiser ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Organiser une sortie d’écurie"
              onPress={() => setOrganiser(true)}
              style={({ pressed }) => [s.actionSecondaire, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={s.actionSecondaireT}>Organiser une sortie</Text>
            </Pressable>
          ) : (
            <View style={s.formulaire}>
              <Text style={s.question}>Combien serez-vous ?</Text>
              <TextInput
                accessibilityLabel="Nombre de pilotes"
                keyboardType="number-pad"
                value={effectifTexte}
                onChangeText={setEffectifTexte}
                placeholder="12"
                placeholderTextColor={colors.text.dim}
                style={s.champ}
              />

              {/* L'annonce dit ce qui VA se passer. Elle ne prescrit rien : le
                  capitaine décide de son effectif, pas de la formule. */}
              {annonce ? <Text style={s.annonce}>{annonce}</Text> : null}

              {formule === 'privatisation' ? (
                <>
                  <Text style={s.question}>Trois dates, OXV en retient une.</Text>
                  {dates.map((d, i) => (
                    <TextInput
                      key={i}
                      accessibilityLabel={`Date souhaitée ${i + 1}`}
                      value={d}
                      onChangeText={(v) =>
                        setDates((prec) => prec.map((x, j) => (j === i ? v : x)))
                      }
                      placeholder="AAAA-MM-JJ"
                      placeholderTextColor={colors.text.dim}
                      style={s.champ}
                    />
                  ))}
                  {verdictDates.message ? (
                    <Text style={s.avertissement}>{verdictDates.message}</Text>
                  ) : null}
                </>
              ) : null}

              <View style={s.boutons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Déposer la demande"
                  accessibilityState={{ disabled: depot, busy: depot }}
                  disabled={depot || formule === null || !verdictDates.valides}
                  onPress={deposer}
                  style={({ pressed }) => [
                    s.actionForte,
                    {
                      opacity:
                        pressed || depot || formule === null || !verdictDates.valides ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text style={s.actionForteT}>Déposer</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Renoncer"
                  onPress={() => setOrganiser(false)}
                  style={({ pressed }) => [s.actionSecondaire, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={s.actionSecondaireT}>Renoncer</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : capitaine && demande ? null : null}

      <View style={[s.composeur, { paddingBottom: insets.bottom + tabBarSpace(insets.bottom) }]}>
        <TextInput
          accessibilityLabel="Écrire dans le fil"
          value={saisie}
          onChangeText={setSaisie}
          placeholder="Écrire à votre écurie"
          placeholderTextColor={colors.text.dim}
          multiline
          maxLength={2000}
          style={s.champCompose}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          accessibilityState={{ disabled: envoi, busy: envoi }}
          disabled={envoi || saisie.trim().length === 0}
          onPress={parler}
          style={({ pressed }) => [
            s.envoyer,
            { opacity: pressed || envoi || saisie.trim().length === 0 ? 0.5 : 1 },
          ]}
        >
          <Text style={s.envoyerT}>Envoyer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg.base },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  retour: { fontFamily: typo.body, fontSize: fontSize.h2, color: colors.text.hi },
  titre: { fontFamily: typo.display, fontSize: fontSize.h2, color: colors.text.hi, flex: 1 },

  // Le bandeau porte un état de demande, jamais une alerte : il informe.
  bandeau: {
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card,
  },
  bandeauTexte: { fontFamily: typo.body, fontSize: fontSize.body, color: colors.text.mid },

  fil: { flex: 1, paddingHorizontal: space.lg },
  vide: {
    fontFamily: typo.body,
    fontSize: fontSize.body,
    color: colors.text.dim,
    marginTop: space.lg,
    lineHeight: fontSize.body * 1.5,
  },
  jour: {
    fontFamily: typo.mono,
    fontSize: fontSize.eyebrow,
    color: colors.text.dim,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  bulle: {
    padding: space.md,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card,
    marginBottom: space.sm,
  },
  /**
   * Un fait posé par le dispositif ne ressemble pas à une parole de pilote.
   * L'or Heritage marque l'appartenance et l'institution — c'est son emploi
   * ailleurs dans l'écurie (l'insigne), et il se tient ici pour la même raison.
   * Aucune couleur de donnée n'entre dans un fil de discussion.
   */
  bulleSysteme: {
    borderLeftWidth: 2,
    borderLeftColor: colors.heritage.gold,
  },
  auteur: {
    fontFamily: typo.mono,
    fontSize: fontSize.micro,
    color: colors.text.dim,
    marginBottom: space.xs,
  },
  auteurSysteme: { color: colors.heritage.gold },
  texte: {
    fontFamily: typo.body,
    fontSize: fontSize.body,
    color: colors.text.hi,
    lineHeight: fontSize.body * 1.5,
  },

  organiser: { paddingHorizontal: space.lg, paddingBottom: space.md },
  formulaire: {
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    gap: space.sm,
  },
  question: { fontFamily: typo.bodyMedium, fontSize: fontSize.body, color: colors.text.mid },
  annonce: {
    fontFamily: typo.body,
    fontSize: fontSize.body,
    color: colors.heritage.gold,
    lineHeight: fontSize.body * 1.5,
  },
  avertissement: { fontFamily: typo.body, fontSize: fontSize.small, color: colors.text.dim },
  champ: {
    fontFamily: typo.body,
    fontSize: fontSize.body,
    color: colors.text.hi,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    minHeight: 46,
  },
  boutons: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },

  composeur: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.card,
  },
  champCompose: {
    fontFamily: typo.body,
    fontSize: fontSize.body,
    flex: 1,
    color: colors.text.hi,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    maxHeight: 120,
    minHeight: 46,
  },
  actionForte: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.heritage.gold,
  },
  actionForteT: { fontFamily: typo.bodySemi, fontSize: fontSize.body, color: colors.heritage.gold },
  actionSecondaire: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.border.card,
  },
  actionSecondaireT: { fontFamily: typo.body, fontSize: fontSize.body, color: colors.text.mid },
  envoyer: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  envoyerT: { fontFamily: typo.bodySemi, fontSize: fontSize.body, color: colors.text.hi },
});

/** Le seuil est rappelé ici pour la garde de test : il vit en base. */
export const SEUIL_AFFICHE = SEUIL_PRIVATISATION;
