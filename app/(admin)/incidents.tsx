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
 *
 * ===========================================================================
 * R3 — CET ÉCRAN PORTAIT LE KIT PILOTE. CORRIGÉ LE 05/09/2026.
 * ===========================================================================
 *
 * Il importait `colors, SectionHeader, space, StateView, typo` de `@/ui/v2` —
 * l'univers PILOTE — alors qu'il vit dans `(admin)`, la console. C'était l'un
 * des cinq franchissements mesurés le 03/09, et le seul qui demandait un
 * arbitrage : `StateView` (kit pilote) et `StateWrapper` (kit console) ne sont
 * pas le même composant.
 *
 * **Décision du fondateur : le swap.** `StateWrapper` est ce qu'emploient les
 * écrans voisins de la console, `(admin)/moderation.tsx` en tête — qui traite
 * la file des signalements de modération, donc le même geste, à côté.
 *
 * DEUX CHOSES QUE LE SWAP NE DONNE PAS, ET QU'IL FAUT DIRE :
 *
 * 1. **Il n'ajoute PAS d'état hors-ligne local**, contrairement à ce que
 *    j'avais avancé en posant la question. `StateWrapper` porte bien un état
 *    `offline`, mais son texte annonce « voici votre dernière lecture
 *    enregistrée » — or cet écran ne garde AUCUNE lecture en cache : il
 *    refait sa requête à chaque montage. Monter cet état ici promettrait une
 *    donnée qui n'existe pas. L'état hors-ligne reste porté par
 *    `OfflineBanner`, globalement, comme le mesure `cinqEtats.guard`.
 *
 * 2. **`SectionLabel` ne porte pas de compteur** là où `SectionHeader` en
 *    portait un. Il se pose à côté, exactement comme le fait déjà
 *    `app/(coach)/assistant.tsx` — la console avait déjà répondu à ce besoin.
 *
 * Le titre passe de 26 pt à `fontSize.h2`, l'échelle de la console : rejoindre
 * un univers, c'est en prendre les crans, pas y traîner ceux de l'autre.
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
import { theme } from '@/theme/v2';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing, radius, fonts, fontSize } = theme;

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

  /**
   * Les quatre états portés par l'écran. Le cinquième — hors-ligne — est
   * global : voir l'en-tête.
   */
  const etatEcran: ScreenState =
    etat === 'loading'
      ? 'loading'
      : etat === 'error'
        ? 'error'
        : incidents.length === 0
          ? 'empty'
          : 'nominal';

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={s.head}>
        <Text style={s.eyebrow}>ADMINISTRATION</Text>
        <Text style={s.titre} accessibilityRole="header">
          Signalements
        </Text>
      </View>

      {/* Le squelette reste en haut, la carte d'état vide ou d'erreur se
          centre : c'est le comportement d'avant, conservé tel quel. */}
      <View
        style={[
          s.corps,
          etatEcran === 'nominal' ? null : s.corpsPad,
          etatEcran === 'empty' || etatEcran === 'error' ? s.corpsCentre : null,
        ]}
      >
        <StateWrapper
          state={etatEcran}
          skeletonLines={4}
          emptyMessage="Aucun signalement à ce jour."
          errorCause="Les signalements n'ont pas pu se charger."
          onRetry={() => setCle((k) => k + 1)}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.xl,
              paddingBottom: insets.bottom + spacing.xxl,
            }}
          >
            <EnTeteSection label="À suivre" count={incidents.length} />
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
        </StateWrapper>
      </View>
    </View>
  );
}

/**
 * En-tête de section avec compteur réel.
 *
 * `SectionLabel` — l'idiome de la console, employé par une vingtaine d'écrans —
 * ne porte que le libellé. Le compteur se pose à côté, comme le fait déjà
 * `app/(coach)/assistant.tsx` : le besoin avait sa réponse dans cet univers-ci,
 * il n'y avait pas à emprunter celle de l'autre.
 */
function EnTeteSection({ label, count }: { label: string; count: number }) {
  return (
    <View style={s.section} accessibilityRole="header">
      <SectionLabel>{label}</SectionLabel>
      <View style={s.compteur}>
        <Text style={s.compteurTexte}>{count}</Text>
      </View>
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
  root: { flex: 1, backgroundColor: palette.night },
  head: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.6,
    color: palette.eyebrow,
  },
  titre: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.xs,
  },
  corps: { flex: 1 },
  corpsPad: { paddingHorizontal: spacing.xl },
  corpsCentre: { justifyContent: 'center' },

  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  compteur: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.cardBorderProminent,
    borderRadius: radius.pill,
    minWidth: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  compteurTexte: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    fontVariant: ['tabular-nums'],
  },

  carte: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  carteHaut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  carteQuand: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.2,
    color: palette.eyebrow,
  },
  carteEtat: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.4,
    color: palette.creamMute,
  },
  /** Un état que l'application ne sait pas nommer se dit sobrement, sans
      prétendre le comprendre. */
  carteEtatInconnu: { color: palette.faint },
  recit: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: 21,
    color: palette.cream,
    marginTop: spacing.md,
  },
  historique: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.separator,
    gap: 4,
  },
  acte: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: 18,
    color: palette.eyebrow,
  },
  actes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  acteBouton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    // 44 pt de plancher pour une cible gantée : l'administrateur porte des
    // gants au bord de la piste.
    minHeight: 44,
    justifyContent: 'center',
  },
  acteLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.cream,
  },
});
