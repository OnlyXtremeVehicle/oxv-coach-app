/**
 * Vos belles routes — les itinéraires balade enregistrés par le pilote.
 * Arbre `app/(app2)`, kit V2. Porté depuis `app/(app)/mes-routes.tsx` au
 * lot 19, sur décision fondateur du 29/07/2026.
 *
 * ---
 *
 * CE QUE LE PORTAGE A CHANGÉ, ET CE QU'IL N'A PAS TOUCHÉ
 *
 * Le MOTEUR n'a pas bougé : `scenicRoutesService` reste la seule source, avec
 * ses `listMyRoutes` / `requestCertification` / `deleteRoute`. Seule la peau
 * change — kit V1 (`@/ui/*`, fond #0B0B0D) vers kit V2 (`@/ui/v2`, #14151A).
 *
 * Le portage a été rendu possible par l'arrivée d'un `Button` dans le kit V2 :
 * il n'en avait pas, et chaque écran composait le sien au `PressScale`.
 *
 * ---
 *
 * CADRE OXV : TOURISME, JAMAIS PERFORMANCE
 *
 * La « sinuosité » est une préférence de balade — une propriété de la ROUTE, pas
 * une mesure de conduite. Aucun classement, aucun chrono, aucune couleur de
 * donnée : hors piste, l'or et les teintes QDI n'ont rien à dire.
 *
 * La certification est demandée par le pilote et accordée par un administrateur.
 * L'application n'en décide jamais seule.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {
  deleteRoute,
  listMyRoutes,
  requestCertification,
  type SavedScenicRoute,
  type ScenicRouteStatus,
} from '@/services/routing/scenicRoutesService';
import {
  Button,
  PressScale,
  SectionHeader,
  StateView,
  colors,
  radius,
  space,
  tabBarSpace,
  typo,
} from '@/ui/v2';

/**
 * Les quatre états d'une route, en mots.
 *
 * Aucune couleur ne porte l'information seule : le libellé suffit à lire
 * l'état, et l'accent est réservé au geste qui engage.
 */
const ETATS: Record<ScenicRouteStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'En revue OXV',
  certified: 'Certifiée OXV',
  rejected: 'Non retenue',
};

export default function MesRoutesScreen() {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<SavedScenicRoute[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRoutes(await listMyRoutes());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function demanderCertification(id: string) {
    setBusyId(id);
    try {
      const ok = await requestCertification(id);
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok ? 'Demande envoyée' : 'Action impossible',
        text2: ok ? 'Un administrateur OXV examinera votre route.' : undefined,
      });
      if (ok) await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function supprimer(id: string) {
    setBusyId(id);
    try {
      const ok = await deleteRoute(id);
      if (ok) setRoutes((rs) => rs.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chevron}>‹</Text>
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          VOS BELLES ROUTES
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          eyebrow="ENREGISTRÉES"
          count={routes.length > 0 ? routes.length : undefined}
        />

        {status === 'loading' ? (
          <StateView state="loading" shape="list" />
        ) : status === 'error' ? (
          <StateView
            state="error"
            errorMessage="Vos routes n'ont pas pu être chargées."
            onRetry={() => void reload()}
          />
        ) : routes.length === 0 ? (
          <View style={styles.carte}>
            <Text style={styles.videTitre}>Aucune route enregistrée.</Text>
            <Text style={styles.videNote}>
              Depuis le planificateur, composez un itinéraire et enregistrez-le ici.
            </Text>
            <View style={styles.videAction}>
              <Button
                label="Composer une route"
                onPress={() => router.push('/(app)/creer-route' as never)}
              />
            </View>
          </View>
        ) : (
          <View style={styles.pile}>
            {routes.map((r) => {
              const modifiable = r.status === 'draft' || r.status === 'rejected';
              // Chaque valeur trace vers la réponse du moteur ; une valeur
              // absente ne s'affiche pas, elle n'est pas remplacée par zéro.
              const meta = [
                r.distanceKm ? `${Math.round(r.distanceKm)} km` : null,
                r.curviness,
                r.sinuosity ? `sinuosité ${r.sinuosity.toFixed(2)}` : null,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <View key={r.id} style={styles.carte}>
                  <View style={styles.ligne}>
                    <Text style={styles.nom}>{r.name}</Text>
                    <Text style={styles.etat}>{ETATS[r.status]}</Text>
                  </View>

                  {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                  {r.status === 'rejected' && r.reviewNotes ? (
                    <Text style={styles.notes}>{r.reviewNotes}</Text>
                  ) : null}

                  <View style={styles.actions}>
                    {modifiable ? (
                      <View style={styles.actionLarge}>
                        <Button
                          label="Demander la certification"
                          variant="ghost"
                          onPress={() => void demanderCertification(r.id)}
                          disabled={busyId !== null && busyId !== r.id}
                          loading={busyId === r.id}
                          accessibilityLabel={`Demander la certification de ${r.name}`}
                        />
                      </View>
                    ) : null}
                    <PressScale
                      onPress={() => void supprimer(r.id)}
                      accessibilityLabel={`Supprimer ${r.name}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busyId !== null }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.supprimer}>SUPPRIMER</Text>
                    </PressScale>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.pied}>
          La certification est accordée par un administrateur OXV. La sinuosité décrit la route,
          jamais votre conduite.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text.hi,
    width: 24,
  },
  headerTitle: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.mid,
  },
  headerSpacer: { width: 24 },
  pile: { gap: space.md, marginTop: space.md },
  carte: {
    backgroundColor: colors.bg.card,
    borderColor: colors.border.card,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  nom: {
    flex: 1,
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  etat: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text.dim,
  },
  meta: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  notes: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    marginTop: space.md,
  },
  actionLarge: { flex: 1 },
  supprimer: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text.dim,
  },
  videTitre: {
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
    textAlign: 'center',
  },
  videNote: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    textAlign: 'center',
    marginTop: space.sm,
  },
  videAction: { marginTop: space.lg, alignSelf: 'stretch' },
  pied: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.xl,
  },
});
