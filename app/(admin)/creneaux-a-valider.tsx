/**
 * Admin — la file des créneaux proposés par les coachs. Jalon 6, préalable.
 *
 * ---
 *
 * POURQUOI CET ÉCRAN EXISTE
 *
 * Depuis le 29/07, un créneau proposé par un coach entre en
 * `pending_validation` : il attend, au lieu d'être rabattu sur `closed`.
 *
 * L'état n'avait **aucune sortie applicative**. Personne ne pouvait valider un
 * créneau depuis l'application ; seule la console Supabase le permettait. Un
 * état sans sortie est pire qu'un mensonge franc — il donne l'apparence d'un
 * processus qui n'existe pas.
 *
 * ---
 *
 * UNE SEULE MARQUE, SUR LE PLUS ANCIEN
 *
 * *« Liseré rouge sur une seule séance, la plus ancienne en attente : une file
 * où tout est urgent n'est plus une file. »* — plan de montage, jalon 6.
 *
 * La décision est prise par `construitFile`, pure et testée. L'écran ne fait
 * que la peindre.
 *
 * ---
 *
 * DEUX GESTES, ET CE QU'ILS SIGNIFIENT
 *
 *   OUVRIR  — le créneau devient visible sur la fiche publique du coach.
 *   REFUSER — il repasse en `closed`. **Rien n'est supprimé** : le coach garde
 *             la trace de ce qu'il a proposé, OXV celle de ce qu'il a refusé.
 *
 * `closed` et non `cancelled` : l'annulation appartient au coach qui renonce,
 * le refus à OXV qui n'ouvre pas. Les confondre effacerait qui a décidé.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  construitFile,
  libelleAttente,
  libelleCoach,
  type CreneauEnAttente,
  type LigneFile,
} from '@/features/admin/creneauxValidationLogic';
import {
  listeCreneauxEnAttente,
  refuserCreneau,
  validerCreneau,
} from '@/services/creneauxValidationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

/** « lun. 3 août, 09:00 ». Jamais de date fabriquée : illisible → « — ». */
function quand(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CreneauxAValiderScreen() {
  const [creneaux, setCreneaux] = useState<CreneauEnAttente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messagePied, setMessagePied] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listeCreneauxEnAttente()
      .then(({ creneaux: rows, erreur }) => {
        if (cancelled) return;
        setCreneaux(rows);
        setError(erreur);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  async function agir(ligne: LigneFile, ouvrir: boolean) {
    setBusyId(ligne.creneau.id);
    setMessagePied(null);
    const res = ouvrir
      ? await validerCreneau(ligne.creneau.id)
      : await refuserCreneau(ligne.creneau.id);
    setBusyId(null);

    if (!res.ok) {
      setMessagePied(res.erreur);
      return;
    }
    // On annonce ce que la BASE a retenu, jamais ce qu'on a demandé.
    if (ouvrir && res.statutRetenu !== 'open') {
      setMessagePied(
        'La base n’a pas retenu l’ouverture. Le créneau reste en attente — vérifiez vos droits.'
      );
    }
    reload();
  }

  // La règle d'ordre et de marque vit dans un module pur et testé.
  const file = construitFile(creneaux, Date.now());

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : file.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="CRÉNEAUX À VALIDER" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>PROPOSÉS PAR LES COACHS</Text>
        <Text style={s.title} accessibilityRole="header">
          Créneaux à valider.
        </Text>
        <Text style={s.lede}>
          Un créneau ouvert par un coach attend ici avant d’apparaître sur sa fiche. Le plus
          anciennement proposé porte la marque.
        </Text>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <StateWrapper
            state={state}
            skeletonLines={4}
            emptyLabel="Aucun créneau en attente"
            emptyMessage="Aucun coach n’a de créneau en attente de validation."
            errorCause="La file des créneaux n'a pas pu être chargée."
            onRetry={reload}
          >
            {file.map((l) => (
              <Card
                key={l.creneau.id}
                style={l.marquee ? s.marquee : undefined}
                accessibilityLabel={`${libelleCoach(l.creneau)}, ${l.creneau.circuitName}, ${quand(
                  l.creneau.startsAt
                )}. ${libelleAttente(l.joursDAttente)}.${
                  l.marquee ? ' Le plus anciennement proposé.' : ''
                }`}
              >
                <View style={s.head}>
                  <Text style={s.coach}>{libelleCoach(l.creneau)}</Text>
                  <Text style={s.attente}>{libelleAttente(l.joursDAttente)}</Text>
                </View>

                <Text style={s.circuit}>{l.creneau.circuitName}</Text>
                <Text style={s.meta}>
                  {quand(l.creneau.startsAt)}
                  {l.creneau.endsAt ? ` → ${quand(l.creneau.endsAt)}` : ''} ·{' '}
                  {l.creneau.capacity === 1 ? '1 place' : `${l.creneau.capacity} places`}
                </Text>
                {l.creneau.notes ? <Text style={s.notes}>{l.creneau.notes}</Text> : null}

                {/*
                  Les libellés restent courts ; le contexte — quel coach, quel
                  circuit — est porté par l'étiquette de la carte, qu'un lecteur
                  d'écran annonce avant d'atteindre les boutons.
                */}
                <View style={s.actions}>
                  <Button
                    label="Ouvrir le créneau"
                    onPress={() => void agir(l, true)}
                    disabled={busyId !== null && busyId !== l.creneau.id}
                    loading={busyId === l.creneau.id}
                  />
                  <Button
                    label="Refuser"
                    variant="ghost"
                    onPress={() => void agir(l, false)}
                    disabled={busyId !== null}
                  />
                </View>
              </Card>
            ))}
          </StateWrapper>

          {messagePied ? <Text style={s.erreurPied}>{messagePied}</Text> : null}

          <Text style={s.note}>
            Refuser referme le créneau sans l’effacer. Le coach garde la trace de sa proposition.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    color: theme.palette.eyebrow,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    color: theme.palette.cream,
    marginTop: theme.spacing.xs,
  },
  lede: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  /**
   * La marque : un liseré à gauche, sur une seule carte. Pas un fond, pas un
   * badge — une marque de bord se voit sans occuper la lecture.
   */
  marquee: {
    borderLeftWidth: 2,
    borderLeftColor: theme.palette.red,
  },
  head: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  coach: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flexShrink: 1,
  },
  attente: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 0.8,
    color: theme.palette.eyebrow,
  },
  circuit: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xs,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  notes: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  erreurPied: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.5,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
};
