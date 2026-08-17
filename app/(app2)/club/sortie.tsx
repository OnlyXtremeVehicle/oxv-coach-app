/**
 * LA SORTIE D'ÉCURIE — porte CLUB. Route `club/sortie?sessionId=…`.
 *
 * ===========================================================================
 * CE QUE CET ÉCRAN ARME
 * ===========================================================================
 *
 * `convoysService.inviter`, `.repondre` et `.utiliserSeanceHeritage` ont été
 * écrites sans appelant — le motif exact que ce dépôt se reproche depuis
 * `nameMyCrew`, `crews_public_rows`, `ramp.ts` et `ribbon.ts`. Cet écran est
 * leur premier appelant.
 *
 * ===========================================================================
 * LES QUATRE RÈGLES QUI TIENNENT CET ÉCRAN
 * ===========================================================================
 *
 * **On n'affiche pas un geste qui sera refusé.** Le bouton « organiser » n'existe
 * que pour le capitaine, les deux boutons de réponse que pour un pilote convié
 * qui n'a pas tranché. Trois politiques serveur décident réellement ; `sortieLogic`
 * les reproduit pour ne pas peindre un bouton mort, jamais pour protéger.
 *
 * **Aucun chrono, comme partout dans l'écurie.** Ni durée de route, ni distance,
 * ni « le plus rapide ». Le résumé sort de `resumeSortie`, et un test vérifie
 * qu'aucun chiffre de performance n'en sort.
 *
 * **L'absence se dit.** Pas de sortie n'est pas une panne : c'est l'état normal
 * avant que le capitaine ne s'y mette. On le formule.
 *
 * **Le pack Heritage se propose, il ne s'impose pas.** Le bouton n'apparaît qu'au
 * pilote convié qui a dit oui et porte une inscription. Le serveur revérifie
 * tout — invitation, validité du pack, crédit restant, double consommation.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { memberDisplayName } from '@/features/club/clubHubLogic';
import {
  aConvier,
  doitRepondre,
  membresAvecStatut,
  peutOrganiser,
  resumeSortie,
  type MembreInvitable,
} from '@/features/club/sortieLogic';
import { useEcurie } from '@/features/club/useEcurie';
import {
  messageRefus,
  planifierTrajet,
  resumeTrajet,
  type LieuSortie,
} from '@/features/club/sortieTrajetLogic';
import { chercherAdresse } from '@/services/routing/geocodeService';
import { validerRecherche, type AdresseTrouvee } from '@/services/routing/geocodeLogic';
import { fetchRestaurantsSortie, type RestaurantSortie } from '@/services/placesService';
import {
  circuitDeLaSession,
  create,
  getForSession,
  inviter,
  majSortie,
  repondre,
  type CircuitJournee,
  type Convoy,
} from '@/services/v2/convoysService';
import {
  colors,
  radius,
  SectionHeader,
  space,
  StateView,
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';

export default function SortieScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const { ecurie, userId, loading: chargeEcurie } = useEcurie();

  const [convoi, setConvoi] = useState<Convoy | null>(null);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [cle, setCle] = useState(0);

  // ── Le trajet : rendez-vous, étape restaurant, circuit ───────────────────
  const [circuit, setCircuit] = useState<CircuitJournee | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSortie[]>([]);
  const [rdvTexte, setRdvTexte] = useState('');
  const [rdvLieu, setRdvLieu] = useState<LieuSortie | null>(null);
  const [propositions, setPropositions] = useState<AdresseTrouvee[] | null>(null);
  const [chercheRdv, setChercheRdv] = useState(false);

  const recharger = useCallback(() => setCle((k) => k + 1), []);

  useEffect(() => {
    if (!sessionId) {
      setCharge(false);
      return;
    }
    let annule = false;
    setCharge(true);
    setErreur(false);
    getForSession(sessionId)
      .then((convois) => {
        if (annule) return;
        // La sortie de MON écurie, parmi les convois de la journée. Un convoi
        // libre (crew_id null) n'est pas une sortie d'écurie et ne s'affiche
        // pas ici — il a sa place ailleurs, pas dans la porte CLUB.
        setConvoi(convois.find((c) => c.crewId !== null && c.crewId === ecurie?.crewId) ?? null);
        setCharge(false);
      })
      .catch(() => {
        if (annule) return;
        setErreur(true);
        setCharge(false);
      });
    return () => {
      annule = true;
    };
  }, [sessionId, ecurie?.crewId, cle]);

  const membresBruts = (ecurie?.membres ?? []).map((m) => ({
    userId: m.userId,
    nom: memberDisplayName(m),
  }));
  const membres = membresAvecStatut(membresBruts, convoi);
  const capitaine = peutOrganiser(
    (ecurie?.membres ?? []).map((m) => ({ userId: m.userId, role: m.role })),
    userId
  );

  async function organiser() {
    if (!sessionId || !ecurie || occupe) return;
    setOccupe(true);
    const res = await create({ sessionId, crewId: ecurie.crewId });
    setOccupe(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'La sortie n’a pas pu être créée.' });
      return;
    }
    recharger();
  }

  async function convier() {
    if (!convoi || occupe) return;
    const cibles = aConvier(membres).map((m) => m.userId);
    if (cibles.length === 0) return;
    setOccupe(true);
    const res = await inviter(convoi.id, cibles);
    setOccupe(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Les invitations n’ont pas pu partir.' });
      return;
    }
    recharger();
  }

  async function repondreA(statut: 'present' | 'decline') {
    if (!convoi || occupe) return;
    setOccupe(true);
    const res = await repondre(convoi.id, statut);
    setOccupe(false);
    if (!res.ok) {
      Toast.show({ type: 'error', text1: res.error ?? 'Votre réponse n’a pas pu être envoyée.' });
      return;
    }
    recharger();
  }

  const restants = aConvier(membres).length;

  /**
   * Le circuit et les restaurants se chargent une fois la sortie connue.
   *
   * Ces deux lectures ne peuvent pas faire échouer l'écran : sans circuit, le
   * trajet DIT ce qui manque ; sans restaurant, la sortie se tient très bien.
   * Un `catch` qui remet une valeur neutre vaut mieux qu'une page en erreur
   * pour une commodité.
   */
  useEffect(() => {
    if (!sessionId) return;
    let annule = false;
    circuitDeLaSession(sessionId)
      .then((c) => {
        if (!annule) setCircuit(c);
      })
      .catch(() => {
        if (!annule) setCircuit(null);
      });
    return () => {
      annule = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!capitaine || convoi === null) return;
    let annule = false;
    fetchRestaurantsSortie(circuit?.id ?? null)
      .then((r) => {
        if (!annule) setRestaurants(r);
      })
      .catch(() => {
        if (!annule) setRestaurants([]);
      });
    return () => {
      annule = true;
    };
  }, [capitaine, convoi, circuit?.id]);

  /**
   * Le trajet se recompose à chaque changement — il n'est jamais stocké tel
   * quel. Le stocker obligerait à l'invalider quand le rendez-vous bouge, et
   * c'est exactement le genre d'oubli qui affiche un trajet périmé.
   */
  const restaurantChoisi = restaurants.find((r) => r.id === convoi?.restaurantId) ?? null;
  const plan = planifierTrajet({
    rendezVous: rdvLieu,
    restaurant: restaurantChoisi
      ? {
          nom: restaurantChoisi.name,
          point: { lat: restaurantChoisi.lat, lon: restaurantChoisi.lon },
        }
      : null,
    circuit: circuit ? { nom: circuit.nom, point: { lat: circuit.lat, lon: circuit.lon } } : null,
  });

  async function chercherRdv() {
    const refus = validerRecherche(rdvTexte);
    if (refus) {
      Toast.show({ type: 'error', text1: refus });
      return;
    }
    setChercheRdv(true);
    // Biaisé autour du circuit : un rendez-vous d'écurie est près de la piste.
    const r = await chercherAdresse(
      rdvTexte,
      circuit ? { lat: circuit.lat, lon: circuit.lon } : undefined
    );
    setChercheRdv(false);
    setPropositions(r);
  }

  async function poserRdv(a: AdresseTrouvee) {
    if (!convoi) return;
    setPropositions(null);
    setRdvTexte('');
    setRdvLieu({ nom: a.nom, point: a.point });
    // Le libellé COMPLET part en base, pas le nom seul : un invité doit pouvoir
    // retrouver le lieu sans connaître la région.
    const res = await majSortie(convoi.id, { meetingPoint: a.libelle });
    if (!res.ok)
      Toast.show({ type: 'error', text1: res.error ?? 'Le rendez-vous n’a pas été posé.' });
    else recharger();
  }

  async function choisirRestaurant(r: RestaurantSortie) {
    if (!convoi) return;
    setOccupe(true);
    // Retoucher le restaurant retenu le retire — même geste, deux sens.
    const suivant = convoi.restaurantId === r.id ? null : r.id;
    const res = await majSortie(convoi.id, { restaurantId: suivant });
    setOccupe(false);
    if (!res.ok)
      Toast.show({ type: 'error', text1: res.error ?? 'L’étape n’a pas été enregistrée.' });
    else recharger();
  }

  return (
    <Animated.View style={[s.root, door]}>
      <View style={[s.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.retour}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle} accessibilityRole="header">
          LA SORTIE
        </Text>
        <View style={s.headerSpacer} />
      </View>

      {chargeEcurie || charge ? (
        <View style={s.pad}>
          <StateView state="loading" shape="list" />
        </View>
      ) : erreur ? (
        <View style={s.pad}>
          <StateView
            state="error"
            errorMessage="La sortie n'a pas pu se charger."
            onRetry={recharger}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
          }}
        >
          {!sessionId ? (
            <View style={s.bloc}>
              <Text style={s.corps}>Choisissez d’abord une journée pour organiser une sortie.</Text>
            </View>
          ) : !ecurie ? (
            <View style={s.bloc}>
              <SectionHeader eyebrow="VOTRE APPARTENANCE" />
              <Text style={s.corps}>
                Une sortie se prépare en écurie. Vous n’appartenez à aucune pour l’instant.
              </Text>
            </View>
          ) : (
            <>
              <View style={s.bloc}>
                <Text style={s.titre}>{ecurie.titre}</Text>
                {/* Le résumé ne porte que des faits — aucun chiffre de performance. */}
                <Text style={s.sousTitre}>
                  {convoi === null
                    ? 'Aucune sortie n’est prévue pour cette journée.'
                    : resumeSortie(membres, convoi.restaurantId !== null)}
                </Text>
              </View>

              {/* Organiser — capitaine seul, comme la politique RESTRICTIVE l'impose. */}
              {convoi === null && capitaine ? (
                <Pressable
                  onPress={organiser}
                  disabled={occupe}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: occupe }}
                  accessibilityLabel="Organiser la sortie de votre écurie"
                  style={s.bouton}
                >
                  <Text style={s.boutonTexte}>
                    {occupe ? 'Un instant…' : 'Organiser la sortie'}
                  </Text>
                </Pressable>
              ) : null}

              {convoi !== null && capitaine && restants > 0 ? (
                <Pressable
                  onPress={convier}
                  disabled={occupe}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: occupe }}
                  accessibilityLabel={`Convier les ${restants} pilotes qui ne le sont pas encore`}
                  style={s.bouton}
                >
                  <Text style={s.boutonTexte}>
                    {occupe
                      ? 'Un instant…'
                      : `Convier ${restants} pilote${restants > 1 ? 's' : ''}`}
                  </Text>
                </Pressable>
              ) : null}

              {/* Répondre — seulement si convié et pas encore tranché. */}
              {doitRepondre(convoi, userId) ? (
                <View style={s.reponse}>
                  <Pressable
                    onPress={() => repondreA('present')}
                    disabled={occupe}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: occupe }}
                    accessibilityLabel="Je viens à cette sortie"
                    style={[s.bouton, s.boutonMoitie]}
                  >
                    <Text style={s.boutonTexte}>Je viens</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => repondreA('decline')}
                    disabled={occupe}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: occupe }}
                    accessibilityLabel="Je ne viens pas à cette sortie"
                    style={[s.bouton, s.boutonMoitie, s.boutonSobre]}
                  >
                    <Text style={s.boutonTexteSobre}>Je ne viens pas</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* ── LE TRAJET ────────────────────────────────────────────
                  Rendez-vous → étape à table → circuit. Aucune durée, aucune
                  distance : l'écurie lit un chemin, pas une performance. */}
              {convoi !== null ? (
                <View style={s.bloc}>
                  <SectionHeader eyebrow="LE TRAJET" />

                  {plan.ok ? (
                    <Text style={s.trajet}>{resumeTrajet(plan.etapes)}</Text>
                  ) : (
                    <Text style={s.corps}>{messageRefus(plan.refus)}</Text>
                  )}

                  {convoi.meetingPoint ? (
                    <Text style={s.sousTitre}>Rendez-vous : {convoi.meetingPoint}</Text>
                  ) : null}

                  {/* Le rendez-vous par ADRESSE — capitaine seul. `meeting_point`
                      était un texte libre ; il devient un lieu réel. */}
                  {capitaine ? (
                    <>
                      <TextInput
                        value={rdvTexte}
                        onChangeText={setRdvTexte}
                        onSubmitEditing={chercherRdv}
                        placeholder="Point de rendez-vous — une adresse, un lieu…"
                        placeholderTextColor={colors.text.dim}
                        returnKeyType="search"
                        accessibilityLabel="Chercher le point de rendez-vous de votre écurie"
                        style={s.champ}
                      />
                      {chercheRdv ? <Text style={s.note}>Recherche…</Text> : null}
                      {!chercheRdv && propositions !== null && propositions.length === 0 ? (
                        <Text style={s.note}>Aucun lieu ne correspond.</Text>
                      ) : null}
                      {(propositions ?? []).map((a) => (
                        <Pressable
                          key={`${a.point.lat},${a.point.lon}`}
                          onPress={() => poserRdv(a)}
                          accessibilityRole="button"
                          accessibilityLabel={`Poser le rendez-vous à ${a.libelle}`}
                          style={s.ligne}
                        >
                          <Text style={s.ligneNom}>{a.libelle}</Text>
                        </Pressable>
                      ))}
                    </>
                  ) : null}

                  {/* L'étape à table. Les restaurants sans coordonnées ne sont
                      pas proposés : ils ne changeraient rien au tracé. */}
                  {capitaine && restaurants.length > 0 ? (
                    <>
                      <Text style={s.note}>Une étape à table, en chemin</Text>
                      {restaurants.map((r) => (
                        <Pressable
                          key={r.id}
                          onPress={() => choisirRestaurant(r)}
                          disabled={occupe}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: convoi.restaurantId === r.id,
                            disabled: occupe,
                          }}
                          accessibilityLabel={
                            convoi.restaurantId === r.id
                              ? `${r.name} — étape retenue, appuyez pour la retirer`
                              : `${r.name}${r.city ? `, ${r.city}` : ''} — retenir comme étape`
                          }
                          style={s.ligne}
                        >
                          <Text style={s.ligneNom}>{r.name}</Text>
                          <Text style={s.ligneEtat}>
                            {convoi.restaurantId === r.id ? 'retenue' : (r.city ?? '')}
                          </Text>
                        </Pressable>
                      ))}
                    </>
                  ) : null}
                </View>
              ) : null}

              {convoi !== null ? (
                <View style={s.bloc}>
                  <SectionHeader eyebrow="LES PILOTES" />
                  {membres.map((m) => (
                    <LigneMembre key={m.userId} membre={m} moi={m.userId === userId} />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
}

/**
 * Une ligne de pilote. Le statut se dit en toutes lettres plutôt qu'en pastille
 * de couleur : « convié » et « décliné » ne se devinent pas à la teinte, et un
 * lecteur d'écran ne lit pas une couleur.
 */
function LigneMembre({ membre, moi }: { membre: MembreInvitable; moi: boolean }) {
  const etat =
    membre.statut === 'present'
      ? 'vient'
      : membre.statut === 'decline'
        ? 'ne vient pas'
        : membre.statut === 'invite'
          ? 'convié'
          : 'pas encore convié';
  return (
    <View style={s.ligne}>
      <Text style={s.ligneNom}>
        {membre.nom}
        {moi ? ' · vous' : ''}
      </Text>
      <Text style={s.ligneEtat}>{etat}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  retour: { color: colors.text.hi, fontSize: 28, lineHeight: 30 },
  headerTitle: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.mid,
  },
  headerSpacer: { width: 20 },
  pad: { paddingHorizontal: space.xl, paddingTop: space.xl },
  bloc: { marginTop: space.xl },
  titre: { fontFamily: typo.display, fontSize: 22, color: colors.text.hi },
  sousTitre: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  corps: { fontFamily: typo.body, fontSize: 14, color: colors.text.mid, lineHeight: 21 },
  bouton: {
    marginTop: space.lg,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.cell,
    backgroundColor: colors.accent,
  },
  boutonMoitie: { flex: 1 },
  /** Décliner ne se peint pas en rouge : ce n'est pas une faute, c'est une réponse. */
  boutonSobre: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  boutonTexte: { fontFamily: typo.bodySemi, fontSize: 14, color: colors.text.hi },
  boutonTexteSobre: { fontFamily: typo.bodySemi, fontSize: 14, color: colors.text.mid },
  reponse: { flexDirection: 'row', gap: space.sm },
  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.hairline,
  },
  ligneNom: { fontFamily: typo.body, fontSize: 14, color: colors.text.hi, flexShrink: 1 },
  /** Le trajet se lit d'un coup — c'est la phrase que le capitaine partage. */
  trajet: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
    lineHeight: 22,
    marginTop: space.sm,
  },
  champ: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.hi,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginTop: space.md,
  },
  note: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.dim,
    marginTop: space.md,
  },
  ligneEtat: { fontFamily: typo.mono, fontSize: 10, letterSpacing: 0.6, color: colors.text.dim },
});
