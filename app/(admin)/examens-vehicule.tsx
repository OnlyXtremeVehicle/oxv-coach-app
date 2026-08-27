/**
 * Vue Admin — demandes d'examen individuel de véhicule (CGV art. 5.3).
 *
 * La voie de recours ouverte par le lot 11 : un véhicule absent du référentiel
 * publié n'est pas hors du périmètre, il est simplement inconnu — le membre
 * peut demander un examen, et le Club répond sous soixante-douze heures
 * ouvrées. Le site dépose les demandes ; cet écran est l'endroit où elles
 * s'instruisent. Sans lui, l'engagement de CGV n'avait aucune surface.
 *
 * ===========================================================================
 * TROIS ISSUES, AUCUN REFUS
 * ===========================================================================
 *
 * « Référencer », « Instruite », « Hors du périmètre ». Jamais « Rejeter » —
 * l'écran voisin de certification des belles routes emploie ce verbe, et il a
 * raison de le faire : une route n'est pas un consommateur. Ici, l'article
 * L121-11 s'applique, et le vocabulaire est verrouillé par un test.
 *
 * ===========================================================================
 * L'ORDRE EST CELUI DE L'ENGAGEMENT, PAS CELUI DE L'ARRIVÉE
 * ===========================================================================
 *
 * Les échéances dépassées passent devant, puis les échéances proches. À état
 * égal, la plus ancienne d'abord. Une file triée par date seule laisserait une
 * demande déposée un vendredi soir se périmer derrière des demandes plus
 * récentes mais moins urgentes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  LIBELLE_ETAT_DELAI,
  etatDelai,
  formaterPlaque,
  rangUrgence,
} from '@/features/vehicules/examenSuiviLogic';
import {
  type DemandeExamen,
  ISSUES_EXAMEN,
  type InscriptionAExaminer,
  LIBELLE_STATUT,
  type StatutExamen,
  compterInscriptionsParPlaque,
  instruireDemande,
  listerDemandesExamen,
  listerInscriptionsAExaminer,
  poserStatutInscription,
} from '@/services/examenVehiculeService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06).
const ADMIN = '#22D3EE';

/** Espace fine insécable — séparateur de milliers, typographie française. */
const NBSP = ' ';

function entierFr(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function dateFr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ExamensVehiculeScreen() {
  const [demandes, setDemandes] = useState<DemandeExamen[]>([]);
  const [aExaminer, setAExaminer] = useState<InscriptionAExaminer[]>([]);
  const [inscriptions, setInscriptions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  // L'instant de référence est FIGÉ au chargement : un `new Date()` évalué à
  // chaque rendu ferait basculer une pastille d'état pendant que l'œil la lit.
  const [maintenant, setMaintenant] = useState(() => new Date());

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [liste, modifiees] = await Promise.all([
        listerDemandesExamen(),
        listerInscriptionsAExaminer(),
      ]);
      setDemandes(liste);
      setAExaminer(modifiees);
      setMaintenant(new Date());
      const plaques = liste.map((d) => d.immatriculation).filter((p): p is string => !!p);
      setInscriptions(await compterInscriptionsParPlaque(plaques));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const triees = useMemo(() => {
    return [...demandes].sort((a, b) => {
      const ra = rangUrgence(etatDelai(a.statut, new Date(a.creeLe), maintenant));
      const rb = rangUrgence(etatDelai(b.statut, new Date(b.creeLe), maintenant));
      return ra !== rb ? ra - rb : a.creeLe.localeCompare(b.creeLe);
    });
  }, [demandes, maintenant]);

  const enAttente = triees.filter((d) => d.statut === 'en_attente').length;

  async function poser(d: DemandeExamen, statut: StatutExamen) {
    setBusyId(d.id);
    try {
      const ok = await instruireDemande(d.id, statut, reponses[d.id] ?? null);
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok ? `Demande ${LIBELLE_STATUT[statut].toLowerCase()}` : 'Action impossible',
      });
      if (ok) await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function basculerInscription(i: InscriptionAExaminer) {
    const cible = i.statut === 'en_examen' ? 'pending' : 'en_examen';
    setBusyId(i.id);
    try {
      const ok = await poserStatutInscription(i.id, cible);
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok
          ? cible === 'en_examen'
            ? 'Inscription prise en examen'
            : 'Inscription rendue au cours normal'
          : 'Action impossible',
      });
      if (ok) await reload();
    } finally {
      setBusyId(null);
    }
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : triees.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="EXAMENS VÉHICULE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow} accessibilityRole="header">
          {enAttente > 0 ? `${enAttente} EN ATTENTE` : 'DEMANDES D’EXAMEN'}
        </Text>
        <Text style={s.rappel}>
          Le Club répond sous soixante-douze heures ouvrées. L’examen porte sur le véhicule,
          jamais sur le pilote.
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Examens"
          emptyMessage="Aucune demande d’examen déposée."
          emptySource="demandes_examen_vehicule"
          errorCause="La liste des demandes n’a pas pu être chargée."
          onRetry={reload}
        >
          <View style={{ gap: theme.spacing.md }}>
            {triees.map((d) => {
              const etat = etatDelai(d.statut, new Date(d.creeLe), maintenant);
              const presse = etat === 'depassee' || etat === 'echeance_proche';
              const busy = busyId === d.id;
              const plaque = formaterPlaque(d.immatriculation);
              const dejaVenu = d.immatriculation ? (inscriptions[d.immatriculation] ?? 0) : 0;
              const vehicule =
                `${d.marque} ${d.modele}`.trim() + (d.annee ? ` (${d.annee})` : '');
              const fiche = [
                d.puissanceCh != null ? `${entierFr(d.puissanceCh)} ch` : 'puissance non déclarée',
                d.masseKg != null ? `${entierFr(d.masseKg)} kg` : 'masse non déclarée',
              ].join(' · ');

              return (
                <Card key={d.id} style={{ borderColor: ADMIN }}>
                  <Text style={s.vehicule}>{vehicule}</Text>

                  <Text style={[s.etat, presse ? s.etatPresse : null]}>
                    {LIBELLE_ETAT_DELAI[etat]}
                    {d.statut !== 'en_attente' ? ` · ${LIBELLE_STATUT[d.statut]}` : ''}
                    {` · déposée le ${dateFr(d.creeLe)}`}
                  </Text>

                  {/* La plaque est la TRACE : figée sur l'inscription, elle relie
                      cette demande aux journées déjà roulées par ce véhicule. */}
                  <Text style={s.meta}>
                    {plaque ? `Plaque ${plaque}` : 'Plaque non déclarée'}
                    {plaque && dejaVenu > 0
                      ? ` · ${dejaVenu} inscription${dejaVenu > 1 ? 's' : ''} à cette plaque`
                      : plaque
                        ? ' · aucune inscription à cette plaque'
                        : ''}
                  </Text>

                  <Text style={s.meta}>{fiche}</Text>
                  <Text style={s.meta}>{d.email}</Text>

                  {d.statut === 'en_attente' ? (
                    <>
                      <Field
                        label="Réponse au demandeur"
                        optional
                        helper="Ce texte reste dans le dossier. Il décrit le véhicule, jamais le pilote."
                        multiline
                        value={reponses[d.id] ?? ''}
                        onChangeText={(t) => setReponses((r) => ({ ...r, [d.id]: t }))}
                        containerStyle={{ marginTop: theme.spacing.md }}
                      />
                      <View style={s.actions}>
                        {ISSUES_EXAMEN.map((issue) => (
                          <Pressable
                            key={issue}
                            accessibilityRole="button"
                            accessibilityLabel={`${LIBELLE_STATUT[issue]} — ${vehicule}`}
                            accessibilityState={{ disabled: busy, busy }}
                            disabled={busy}
                            hitSlop={theme.hitSlop}
                            onPress={() => poser(d, issue)}
                            style={({ pressed }) => [
                              s.action,
                              issue === 'referencee' ? s.actionForte : null,
                              { opacity: pressed || busy ? 0.6 : 1 },
                            ]}
                          >
                            <Text
                              style={[
                                s.actionT,
                                issue === 'referencee' ? s.actionTForte : null,
                              ]}
                            >
                              {LIBELLE_STATUT[issue]}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      {d.reponse ? <Text style={s.reponse}>{d.reponse}</Text> : null}
                      {d.instruiteLe ? (
                        <Text style={s.meta}>{`Instruite le ${dateFr(d.instruiteLe)}`}</Text>
                      ) : null}
                      {/* Rouvrir efface la date d'instruction (déclencheur en
                          base) : une demande rouverte redevient une demande en
                          attente, sans passé d'instruction fictif. */}
                      <View style={s.actions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Rouvrir la demande — ${vehicule}`}
                          accessibilityState={{ disabled: busy, busy }}
                          disabled={busy}
                          hitSlop={theme.hitSlop}
                          onPress={() => poser(d, 'en_attente')}
                          style={({ pressed }) => [s.action, { opacity: pressed || busy ? 0.6 : 1 }]}
                        >
                          <Text style={s.actionT}>Rouvrir</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </Card>
              );
            })}
          </View>
        </StateWrapper>

        {/* L'autre visage du même sujet : ces véhicules-là SONT au référentiel,
            mais ils ont été modifiés. Même geste attendu — regarder le
            véhicule — donc même surface. Deux écrans séparés feraient qu'on en
            surveillerait un et pas l'autre. */}
        {aExaminer.length > 0 ? (
          <View style={{ marginTop: theme.spacing.xxl }}>
            <Text style={s.eyebrow} accessibilityRole="header">
              MODIFICATIONS DÉCLARÉES
            </Text>
            <Text style={s.rappel}>
              Ces inscriptions portent un véhicule modifié. Le pilote conserve son droit
              d’annulation pendant l’examen.
            </Text>
            <View style={{ gap: theme.spacing.md }}>
              {aExaminer.map((i) => {
                const busy = busyId === i.id;
                const enExamen = i.statut === 'en_examen';
                const plaque = formaterPlaque(i.immatriculation);
                return (
                  <Card key={i.id} style={{ borderColor: enExamen ? ADMIN : theme.palette.line }}>
                    <Text style={s.vehicule}>{i.pilote}</Text>
                    <Text style={[s.etat, enExamen ? s.etatPresse : null]}>
                      {enExamen ? 'En examen' : 'Pas encore prise en main'}
                      {i.dateSession ? ` · journée du ${dateFr(i.dateSession)}` : ''}
                      {` · ${i.offre}`}
                    </Text>
                    <Text style={s.meta}>
                      {plaque ? `Plaque ${plaque}` : 'Plaque non figée sur l’inscription'}
                    </Text>
                    {i.modificationsDetail ? (
                      <Text style={s.reponse}>{i.modificationsDetail}</Text>
                    ) : (
                      <Text style={s.meta}>Aucun détail de modification renseigné.</Text>
                    )}
                    <View style={s.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          enExamen
                            ? `Rendre au cours normal — ${i.pilote}`
                            : `Prendre en examen — ${i.pilote}`
                        }
                        accessibilityState={{ disabled: busy, busy }}
                        disabled={busy}
                        hitSlop={theme.hitSlop}
                        onPress={() => basculerInscription(i)}
                        style={({ pressed }) => [
                          s.action,
                          enExamen ? null : s.actionForte,
                          { opacity: pressed || busy ? 0.6 : 1 },
                        ]}
                      >
                        <Text style={[s.actionT, enExamen ? null : s.actionTForte]}>
                          {enExamen ? 'Rendre au cours normal' : 'Prendre en examen'}
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}
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
  vehicule: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  // L'état de délai n'emprunte AUCUNE couleur de donnée (or = chrono, vert =
  // accélération, rouge = marque). Ce qui presse prend la couleur du rôle
  // admin — la seule qui signifie « ceci attend une main ».
  etat: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  etatPresse: {
    color: ADMIN,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  reponse: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  actions: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
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
    paddingVertical: theme.spacing.sm,
  },
  actionForte: {
    borderColor: ADMIN,
  },
  actionT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  actionTForte: {
    color: ADMIN,
  },
};
