/**
 * Vue Admin — LA FILE. Tout ce qui attend une main, en une seule liste.
 *
 * ===========================================================================
 * L'ÉCRAN QU'ON OUVRE LE MATIN
 * ===========================================================================
 *
 * Le hub porte vingt-quatre entrées. Chacune est utile, aucune ne dit ce qui
 * PRESSE — il faut les ouvrir une par une pour le savoir. Ce qui se perd, en
 * administration, n'est jamais ce qu'on regarde : c'est ce qu'on oublie de
 * regarder.
 *
 * Cette file rassemble les quatre choses qui attendent — examens de véhicule,
 * sorties d'écurie, véhicules modifiés, pilotes écartés — et les trie par
 * urgence réelle. Un seul écran à ouvrir, et rien ne passe sous le radar.
 *
 * ===========================================================================
 * DEUX FAMILLES, ET ON NE LES MÉLANGE PAS
 * ===========================================================================
 *
 * Ce qui court sous les soixante-douze heures ouvrées des CGV porte son
 * échéance. Le reste — regarder un véhicule modifié, relancer des pilotes
 * écartés — est une diligence : utile, jamais due. Lui poser une échéance
 * ferait clignoter ce qui peut attendre lundi, et l'œil finirait par ne plus
 * distinguer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  GESTE_DOMAINE,
  LIBELLE_DOMAINE,
  type PosteClasse,
  classerFile,
  phraseResume,
  resumerFile,
} from '@/features/admin/fileAdminLogic';
import { LIBELLE_ETAT_DELAI } from '@/features/vehicules/examenSuiviLogic';
import { listerFileAdministration } from '@/services/fileAdministrationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06).
const ADMIN = '#22D3EE';

/** Où mène chaque poste. `null` = le poste s'explique seul, sans écran dédié. */
const DESTINATION: Readonly<Record<PosteClasse['domaine'], string | null>> = {
  examen_vehicule: '/(admin)/examens-vehicule',
  inscription_modifiee: '/(admin)/examens-vehicule',
  ecurie: '/(admin)/ecuries',
  intentions: null,
  // Publier une journée et activer un tarif se font sur le site : aucun écran
  // de l'application ne les porte. Un bouton qui n'irait nulle part se lirait
  // comme une panne — le détail du poste dit déjà quoi faire, et où.
  calendrier: null,
  tarif: null,
};

function dateFr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FileAdminScreen() {
  const [postes, setPostes] = useState<PosteClasse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // L'instant de référence est figé au chargement : un `new Date()` évalué à
  // chaque rendu ferait basculer une échéance pendant qu'on la lit.
  const [maintenant, setMaintenant] = useState(() => new Date());

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const bruts = await listerFileAdministration();
      const instant = new Date();
      setMaintenant(instant);
      setPostes(classerFile(bruts, instant));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resume = useMemo(() => resumerFile(postes), [postes]);
  const phrase = phraseResume(resume);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : postes.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="LA FILE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow} accessibilityRole="header">
          CE QUI ATTEND UNE MAIN
        </Text>
        {phrase ? <Text style={s.resume}>{phrase}</Text> : null}

        <StateWrapper
          state={state}
          skeletonLines={6}
          emptyLabel="La file"
          emptyMessage="Rien n’attend. Les demandes, les sorties d’écurie et les véhicules modifiés arrivent ici."
          emptySource="oxv_file_administration"
          errorCause="La file n’a pas pu être chargée."
          onRetry={reload}
        >
          <View style={{ gap: theme.spacing.md }}>
            {postes.map((p) => {
              const presse = p.etat === 'depassee' || p.etat === 'echeance_proche';
              const destination = DESTINATION[p.domaine];
              const etatTexte =
                p.etat === 'sans_engagement'
                  ? 'Sans échéance'
                  : LIBELLE_ETAT_DELAI[p.etat];

              const contenu = (
                <Card
                  key={p.refId}
                  style={{ borderColor: presse ? ADMIN : theme.palette.line }}
                >
                  <Text style={s.domaine}>{LIBELLE_DOMAINE[p.domaine]}</Text>
                  <Text style={s.titre}>{p.titre}</Text>
                  {p.detail ? <Text style={s.detail}>{p.detail}</Text> : null}
                  <Text style={[s.etat, presse ? s.etatPresse : null]}>
                    {etatTexte}
                    {` · depuis le ${dateFr(p.depuis)}`}
                    {destination ? ` · ${GESTE_DOMAINE[p.domaine]}` : ''}
                  </Text>
                </Card>
              );

              // Un poste sans destination ne se rend pas cliquable : un geste
              // qui ne mène nulle part se lit comme une panne.
              return destination === null ? (
                <View key={p.refId}>{contenu}</View>
              ) : (
                <Pressable
                  key={p.refId}
                  accessibilityRole="button"
                  accessibilityLabel={`${GESTE_DOMAINE[p.domaine]} — ${p.titre}`}
                  hitSlop={theme.hitSlop}
                  onPress={() => router.push(destination as never)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  {contenu}
                </Pressable>
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
  resume: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginBottom: theme.spacing.lg,
  },
  domaine: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  titre: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  detail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  // L'urgence n'emprunte aucune couleur de donnée (or = chrono, vert =
  // accélération). Ce qui presse prend la couleur du rôle admin — la seule qui
  // signifie « ceci attend une main ».
  etat: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.4,
  },
  etatPresse: { color: ADMIN },
};
