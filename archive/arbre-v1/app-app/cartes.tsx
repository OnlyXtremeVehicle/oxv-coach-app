// DIVERGENCE_SCHEMA: adaptations au repo réel (spec lot PROFIL_CARTES §3) —
//  - route `app/(app)/cartes.tsx` (espace pilote réel = groupe `(app)`, pas
//    `(pilote)/cartes/index.tsx`) ; appMap : zone 'miroir' (lecture de soi) ;
//  - point d'entrée réel : l'odomètre du profil (pressable) → /(app)/cartes ;
//  - statut sessions : write-path réel 'completed'/'aborted'/'recording' →
//    cartes et compteur filtrés sur status = 'completed' ;
//  - température piste absente du schéma (voir CarteSession) ;
//  - chrono : formatChronoCarte (m:ss.mmm, point — norme chronométrage),
//    distinct du formatLapTime historique (apostrophe, verrouillé, intouché).
/**
 * Panel de cartes — liste des sessions télémétrie du pilote, sélection pour
 * comparaison SELF vs SELF (référence panel-cartes.html, pixel par pixel).
 *
 * Espace PRIVÉ : les chronos sont autorisés ici. Aucune donnée d'un autre
 * pilote — toutes les requêtes filtrent user_id = auth.uid() (défense en
 * profondeur, la RLS fait le reste). Doctrine Miroir : données factuelles,
 * écarts NEUTRES (gris), aucun langage prescriptif, aucun classement.
 *
 * Logique testée (src/lib/queries/cartesLogic) : numérotation chronologique
 * ascendante (001 = la plus ancienne) indépendante de l'affichage descendant ;
 * référence personnelle = min non nul PAR CIRCUIT sur la liste FILTRÉE ;
 * sélection bornée à 2, bouton Comparer actif à exactement 2.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, Stagger } from '@/components/motion';
import { BarreComparaison } from '@/components/cartes/BarreComparaison';
import { CarteSession as CarteSessionCard } from '@/components/cartes/CarteSession';
import { FiltresCartes } from '@/components/cartes/FiltresCartes';
import {
  FILTRE_TOUTES,
  type CarteSession,
  type FiltreCartes as Filtre,
  appliquerFiltre,
  basculerSelection,
  circuitPrincipal,
  comparaisonPrete,
  construireFiltres,
  ecartReference,
  estReference,
  formatChronoCarte,
  formatDateCarte,
  formatEcartReference,
  formatNumeroCarte,
  getCartes,
  numeroterCartes,
  referenceParCircuit,
} from '@/lib/queries/cartes';
import { lotProfilTokens as t } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';

/** Hauteur nominale de la barre de comparaison (padding scroll, spec §6). */
const HAUTEUR_BARRE = 96;

type Etat =
  | { phase: 'chargement' }
  | { phase: 'erreur' }
  | { phase: 'pret'; cartes: CarteSession[] };

/** « Sec » — première lettre en capitale, valeur réelle inchangée sinon. */
function meteoCapitalisee(weather: string | null): string | null {
  const v = weather?.trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** Pied de carte : météo réelle + température d'AIR réelle, rien d'inventé. */
function ligneMeteo(carte: CarteSession): string | null {
  const parts: string[] = [];
  const meteo = meteoCapitalisee(carte.weather);
  if (meteo) parts.push(meteo);
  if (carte.airTempC !== null) parts.push(`Air ${Math.round(carte.airTempC)}°C`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function PanelCartesScreen() {
  const insets = useSafeAreaInsets();
  const [etat, setEtat] = useState<Etat>({ phase: 'chargement' });
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_TOUTES);
  const [selection, setSelection] = useState<string[]>([]);

  const charger = useCallback(() => {
    setEtat({ phase: 'chargement' });
    getCartes()
      .then((cartes) => setEtat({ phase: 'pret', cartes }))
      .catch(() => setEtat({ phase: 'erreur' }));
  }, []);

  // Chargement initial (une fois — le panel se recharge via « Réessayer »).
  useEffect(() => {
    charger();
  }, [charger]);

  const cartes = etat.phase === 'pret' ? etat.cartes : [];
  // Numérotation sur l'ENSEMBLE : stable quel que soit le filtre.
  const numeros = useMemo(() => numeroterCartes(cartes), [cartes]);
  const filtres = useMemo(() => construireFiltres(cartes), [cartes]);
  const visibles = useMemo(() => appliquerFiltre(cartes, filtre), [cartes, filtre]);
  // Référence personnelle PAR CIRCUIT, recalculée sur la liste FILTRÉE.
  const references = useMemo(() => referenceParCircuit(visibles), [visibles]);
  const circuitLabel = useMemo(() => circuitPrincipal(cartes), [cartes]);

  const numerosSelection = selection.map((id) => formatNumeroCarte(numeros[id] ?? 0));
  const prete = comparaisonPrete(selection);

  function comparer() {
    if (!prete) return;
    // La route de comparaison self vs self EXISTE : /(app)/comparateur
    // (2 séances du pilote). Elle ne lit pas encore de pré-sélection.
    // TODO_LOT_SUIVANT: pré-sélection des 2 cartes dans le comparateur
    router.push('/(app)/comparateur');
  }

  return (
    <View style={s.ecran}>
      <View style={{ paddingTop: insets.top }}>
        <AppBar onBack={() => router.back()} />
      </View>

      {etat.phase === 'chargement' ? (
        <View style={s.centre}>
          <ActivityIndicator color={t.gris} accessibilityLabel="Chargement des cartes" />
        </View>
      ) : etat.phase === 'erreur' ? (
        <View style={s.centre}>
          <View style={s.bandeauErreur}>
            <Text style={s.erreurTexte}>
              Vos cartes n&apos;ont pas pu être chargées. Vérifiez votre connexion.
            </Text>
            <PressableScale
              onPress={charger}
              accessibilityRole="button"
              accessibilityLabel="Réessayer le chargement"
              pressedOpacity={0.7}
              style={s.boutonReessayer}
            >
              <Text style={s.boutonReessayerTexte}>Réessayer</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: HAUTEUR_BARRE + insets.bottom + 24,
            }}
          >
            <View style={s.entete}>
              <Text style={s.eyebrow}>Espace Pilote · Privé</Text>
              <Text style={s.h1} accessibilityRole="header">
                Mes Cartes
              </Text>
              <Text style={s.total}>
                <Text style={s.totalFort}>{cartes.length}</Text>
                {cartes.length === 1 ? ' carte' : ' cartes'}
                {circuitLabel ? ` · ${circuitLabel}` : ''}
              </Text>
            </View>

            {cartes.length === 0 ? (
              <View style={s.vide}>
                <Text style={s.videTexte}>
                  Aucune carte pour le moment. Votre première session créera votre première carte.
                </Text>
              </View>
            ) : (
              <>
                <FiltresCartes filtres={filtres} actif={filtre} onChoisir={setFiltre} />

                <Text style={s.modeInfo}>Sélectionnez deux cartes pour les comparer</Text>

                <Stagger style={s.cartes}>
                  {visibles.map((carte) => {
                    const reference = estReference(carte, references);
                    const ecart = ecartReference(carte, references);
                    return (
                      <CarteSessionCard
                        key={carte.id}
                        numero={formatNumeroCarte(numeros[carte.id] ?? 0)}
                        date={formatDateCarte(carte.startedAt)}
                        estReference={reference}
                        chrono={formatChronoCarte(carte.bestLapSeconds)}
                        ecart={ecart !== null ? formatEcartReference(ecart) : null}
                        tours={carte.lapCount !== null ? String(Math.round(carte.lapCount)) : '—'}
                        voiture={carte.vehicleLabel}
                        meteo={ligneMeteo(carte)}
                        trackSvgPath={carte.trackSvgPath}
                        selectionnee={selection.includes(carte.id)}
                        onBasculerSelection={() =>
                          setSelection((actuelle) => basculerSelection(actuelle, carte.id))
                        }
                        onOuvrir={() =>
                          router.push({
                            pathname: '/(app)/bilan',
                            params: { sessionId: carte.id },
                          })
                        }
                      />
                    );
                  })}
                </Stagger>
              </>
            )}
          </ScrollView>

          <BarreComparaison
            visible={selection.length >= 1}
            numeros={numerosSelection}
            prete={prete}
            onComparer={comparer}
          />
        </>
      )}
    </View>
  );
}

const s = {
  ecran: {
    flex: 1,
    backgroundColor: t.noir,
  },
  centre: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 20,
  },
  entete: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  eyebrow: {
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: t.gris,
  },
  h1: {
    fontFamily: t.fonts.display,
    fontSize: 20,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: t.blanc,
    marginTop: 8,
  },
  total: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    color: t.gris,
    marginTop: 6,
    letterSpacing: 0.66,
  },
  totalFort: {
    fontFamily: t.fonts.monoBold,
    color: t.blanc,
  },
  modeInfo: {
    marginTop: 18,
    marginHorizontal: 20,
    fontFamily: t.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: t.grisSombre,
    textTransform: 'uppercase' as const,
  },
  cartes: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 12,
  },
  vide: {
    marginTop: 40,
    marginHorizontal: 20,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 5,
    padding: 20,
  },
  videTexte: {
    fontFamily: t.fonts.corps,
    fontSize: 13,
    lineHeight: 21,
    color: t.gris,
    textAlign: 'center' as const,
  },
  bandeauErreur: {
    alignSelf: 'stretch' as const,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.ligne,
    borderRadius: 5,
    padding: 20,
    alignItems: 'center' as const,
    gap: 14,
  },
  erreurTexte: {
    fontFamily: t.fonts.corps,
    fontSize: 13,
    lineHeight: 21,
    color: t.gris,
    textAlign: 'center' as const,
  },
  boutonReessayer: {
    borderWidth: 1,
    borderColor: t.rouge,
    borderRadius: 2,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  boutonReessayerTexte: {
    fontFamily: t.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: t.blanc,
  },
};
