/**
 * SIGNALEMENTS — l'administration suit ce que les pilotes déclarent.
 *
 * ===========================================================================
 * UNE DÉCLARATION ENTRAIT, ET N'EN SORTAIT JAMAIS
 * ===========================================================================
 *
 * `incident_reports` reçoit les signalements des pilotes. `incident_followups`
 * existe depuis le 02/08 pour porter les actes de l'organisation — reçu,
 * traité, clos — avec leur auteur et leur date. Le pilote LIT déjà ce suivi
 * dans son espace.
 *
 * Mesuré le 14/08 : **zéro occurrence du mot « incident » dans les 31 fichiers
 * de `app/(admin)/`.** Rien n'écrivait. Une déclaration entrait et n'en
 * ressortait jamais ; le pilote voyait donc, indéfiniment, un signalement sans
 * suite.
 *
 * ===========================================================================
 * ON AJOUTE UN ACTE, ON NE CORRIGE PAS UN ÉTAT
 * ===========================================================================
 *
 * Le signalement lui-même est en écriture unique : la migration BE-1 interdit
 * `UPDATE` et `DELETE` dessus, parce que **le récit d'un pilote ne se réécrit
 * pas**. Le suivi s'ajoute à côté, et chaque acte porte son auteur.
 *
 * L'écran suit cette forme : il ne propose jamais de « modifier » un état, il
 * propose d'en ajouter un. L'historique reste entier, y compris un retour en
 * arrière — c'est un fait de l'organisation, pas une erreur à effacer.
 *
 * ===========================================================================
 * CE QU'IL N'AFFICHE PAS
 * ===========================================================================
 *
 * Aucune photo. `photo_path` pointe dans `pilot-media`, un bucket privé du
 * pilote : l'ouvrir ici demanderait une URL signée et une décision sur qui
 * peut regarder la photo d'un incident. Ce n'est pas un oubli, c'est une
 * question qui n'a pas été tranchée.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dateCourte,
  etatCourant,
  suivisAffichables,
  type EtatSuivi,
  type SuiviBrut,
} from '@/features/rec/incidentSuiviLogic';
import {
  addFollowup,
  listAllIncidents,
  listFollowups,
  type IncidentRow,
} from '@/services/v2/incidentService';
import { colors, SectionHeader, space, StateView, typo } from '@/ui/v2';

type Etat = 'loading' | 'error' | 'ready';

/** Les trois actes, dans l'ordre où ils se posent. Vocabulaire du CHECK. */
const ACTES: readonly { cle: EtatSuivi; libelle: string }[] = [
  { cle: 'recu', libelle: 'Reçu' },
  { cle: 'traite', libelle: 'Traité' },
  { cle: 'clos', libelle: 'Clos' },
];

export default function AdminIncidentsScreen() {
  const insets = useSafeAreaInsets();
  const [etat, setEtat] = useState<Etat>('loading');
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [suivis, setSuivis] = useState<Record<string, SuiviBrut[]>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [cle, setCle] = useState(0);

  useEffect(() => {
    let annule = false;
    setEtat('loading');
    listAllIncidents()
      .then(async (rows) => {
        if (annule) return;
        setIncidents(rows);
        // Best-effort : sans suivi lisible, la liste reste utile — chaque
        // signalement affiche alors « état non communiqué », ce qui est vrai.
        const par = await listFollowups(rows.map((r) => r.id)).catch(() => ({}));
        if (annule) return;
        setSuivis(par);
        setEtat('ready');
      })
      .catch(() => {
        if (!annule) setEtat('error');
      });
    return () => {
      annule = true;
    };
  }, [cle]);

  const poser = useCallback(
    async (incidentId: string, state: EtatSuivi) => {
      if (enCours !== null) return;
      setEnCours(incidentId);
      const res = await addFollowup({ incidentId, state });
      setEnCours(null);
      if (res.ok) setCle((k) => k + 1);
      else Toast.show({ type: 'error', text1: 'Acte non enregistré.', text2: res.error });
    },
    [enCours]
  );

  return (
    <View style={[s.root, { paddingTop: insets.top + space.md }]}>
      <View style={s.head}>
        <Text style={s.eyebrow}>ADMINISTRATION</Text>
        <Text style={s.titre} accessibilityRole="header">
          Signalements
        </Text>
      </View>

      {etat === 'loading' ? (
        <View style={s.pad}>
          <StateView state="loading" shape="list" />
        </View>
      ) : etat === 'error' ? (
        <View style={s.centered}>
          <StateView
            state="error"
            errorMessage="Les signalements n'ont pas pu se charger."
            onRetry={() => setCle((k) => k + 1)}
          />
        </View>
      ) : incidents.length === 0 ? (
        <View style={s.centered}>
          <StateView state="empty" emptyMessage="Aucun signalement à ce jour." />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: insets.bottom + space.xxl,
          }}
        >
          <SectionHeader eyebrow="À SUIVRE" count={incidents.length} />
          {incidents.map((inc) => (
            <CarteIncident
              key={inc.id}
              incident={inc}
              suivis={suivis[inc.id] ?? []}
              occupee={enCours === inc.id}
              onPoser={(state) => poser(inc.id, state)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function CarteIncident({
  incident,
  suivis,
  occupee,
  onPoser,
}: {
  incident: IncidentRow;
  suivis: readonly SuiviBrut[];
  occupee: boolean;
  onPoser: (state: EtatSuivi) => void;
}) {
  const affichables = useMemo(() => suivisAffichables(suivis), [suivis]);
  const courant = etatCourant(affichables);
  const quand = dateCourte(incident.occurredAt);

  return (
    <View style={s.carte}>
      <View style={s.carteHaut}>
        <Text style={s.carteQuand}>{quand ?? 'Date non communiquée'}</Text>
        <Text style={[s.carteEtat, courant.inconnu && s.carteEtatInconnu]}>
          {courant.texte.toUpperCase()}
        </Text>
      </View>

      {/* Le récit du pilote, ENTIER. Le tronquer ferait juger un incident sur
          une phrase coupée — et la table ne permet pas de le relire ailleurs :
          elle est en écriture unique, c'est ici qu'il se lit. */}
      <Text style={s.recit}>{incident.description}</Text>

      {affichables.length > 0 ? (
        <View style={s.historique}>
          {affichables.map((a) => (
            <Text key={a.id} style={s.acte}>
              {a.etat.texte}
              {dateCourte(a.le) ? ` · ${dateCourte(a.le)}` : ''}
              {a.note ? ` — ${a.note}` : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {/* AJOUTER un acte, jamais « modifier » l'état : la table est faite pour
          empiler, et l'historique reste entier. */}
      <View style={s.actes}>
        {ACTES.map((a) => (
          <Pressable
            key={a.cle}
            onPress={() => onPoser(a.cle)}
            disabled={occupee}
            accessibilityRole="button"
            accessibilityState={{ disabled: occupee, busy: occupee }}
            accessibilityLabel={`Marquer ce signalement comme ${a.libelle.toLowerCase()}`}
            style={({ pressed }) => [s.acteBouton, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.acteLabel}>{a.libelle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  head: { paddingHorizontal: space.xl, paddingBottom: space.md },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.low,
  },
  titre: {
    fontFamily: typo.display,
    fontSize: 26,
    color: colors.text.hi,
    marginTop: space.xs,
  },
  pad: { flex: 1, paddingHorizontal: space.xl },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },

  carte: {
    marginTop: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: 12,
    backgroundColor: colors.bg.card,
  },
  carteHaut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  carteQuand: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text.low,
  },
  carteEtat: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.mid,
  },
  /** Un état que l'application ne sait pas nommer se dit sobrement, sans
      prétendre le comprendre. */
  carteEtatInconnu: { color: colors.text.dim },
  recit: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
    marginTop: space.md,
  },
  historique: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.hairline,
    gap: 4,
  },
  acte: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
  },
  actes: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.lg,
  },
  acteBouton: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border.strong,
    // 44 pt de plancher pour une cible gantée : l'administrateur porte des
    // gants au bord de la piste.
    minHeight: 44,
    justifyContent: 'center',
  },
  acteLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
});
