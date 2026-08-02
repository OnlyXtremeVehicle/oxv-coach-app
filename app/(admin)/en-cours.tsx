/**
 * Admin — En piste.
 *
 * Qui roule en ce moment, lu à l'ouverture de l'écran. **Rien ne se met à jour
 * tout seul** : aucun canal Supabase Realtime n'existe dans `app/(admin)/` —
 * vérifié le 02/08/2026, zéro `.channel(` sur les 31 fichiers. L'en-tête
 * annonçait « Suivi temps réel de la session » et « état BLE des équipements » :
 * les deux étaient faux, et l'écran ne lit aucune donnée Bluetooth.
 *
 * ---
 *
 * DES NUMÉROS, PAS DES NOMS — ET AUCUN CLASSEMENT
 *
 * *« Les numéros en piste sont des numéros, pas des noms. Aucun chrono, aucun
 * ordre de performance : BOARD_MODE = 'A'. »* — Plan de montage, Jalon 7.
 *
 * L'écran affichait l'état civil des pilotes et les triait par heure de départ
 * décroissante — le dernier parti en tête, donc un ordre de passage, donc une
 * hiérarchie. Il ordonne maintenant par NUMÉRO DE VOITURE croissant, via
 * `compareCarNo` : la règle unique du dépôt, déjà écrite et verrouillée par
 * test, qui n'était branchée que sur le roster du coach.
 *
 * L'administrateur surveille la piste. Il n'identifie personne depuis ici, et
 * il ne classe personne.
 *
 * Garde : `src/services/__tests__/tableauDePisteAdmin.guard.test.ts`.
 */

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { compareCarNo } from '@/services/boardLogic';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

/**
 * Ce que l'administrateur voit passer depuis son poste.
 *
 * UN NUMÉRO, PAS UN NOM. « Les numéros en piste sont des numéros, pas des
 * noms » — Plan de montage, Jalon 7 Phase 6. L'écran lisait
 * `users(first_name, last_name)` et affichait l'état civil : c'est ce que
 * l'administrateur a sous les yeux au bord de la piste, et ce n'est pas ce
 * qu'il y voit passer. Relevé par la cartographie du 02/08/2026.
 */
interface LiveSession {
  id: string;
  userId: string;
  /** Numéro de voiture. `null` si le pilote n'en a pas déclaré. */
  carNo: number | null;
  startedAt: string;
  /** `null` = non mesuré. Jamais 0 : la colonne est nullable en base. */
  lapCount: number | null;
  status: string;
}

export default function EnCoursScreen() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      const { data, error } = await supabase
        .from('telemetry_sessions')
        .select('id, user_id, started_at, lap_count, status, users(car_number)')
        .eq('status', 'recording')
        // AUCUN ORDRE DE PERFORMANCE. Le tri était `started_at` décroissant —
        // le dernier parti en tête —, ce qui est un ordre de passage, donc une
        // hiérarchie. `BOARD_MODE = 'A'` l'interdit. L'ordre est posé plus bas
        // par `compareCarNo`, la règle unique du dépôt : par NUMÉRO croissant,
        // pour retrouver sa voiture d'un coup d'œil, et rien d'autre.
        .limit(20);
      if (cancelled) return;
      if (error) {
        setFailed(true);
        setLoading(false);
        return;
      }
      const lignes: LiveSession[] = (data ?? []).map((row) => {
        const u = row.users as { car_number: number | null } | null;
        const brut = u?.car_number;
        return {
          id: row.id,
          userId: row.user_id ?? '',
          carNo: typeof brut === 'number' && Number.isFinite(brut) ? brut : null,
          startedAt: row.started_at ?? '',
          // `?? 0` fabriquait « 0 tour » sur une colonne nullable : un pilote
          // qui vient de partir et un pilote dont on n'a rien mesuré
          // s'affichaient pareil.
          lapCount: typeof row.lap_count === 'number' ? row.lap_count : null,
          status: row.status ?? 'unknown',
        };
      });
      // La règle d'ordre du dépôt, déjà écrite et verrouillée par test — elle
      // n'était branchée que sur le roster coach.
      lignes.sort((a, b) =>
        compareCarNo(
          { carNo: a.carNo, tieBreak: a.startedAt },
          { carNo: b.carNo, tieBreak: b.startedAt }
        )
      );
      setSessions(lignes);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const state: ScreenState = loading
    ? 'loading'
    : failed
      ? 'error'
      : sessions.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="EN COURS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN · EN COURS</Text>
        <Text style={s.title} accessibilityRole="header">
          {sessions.length} session{sessions.length > 1 ? 's' : ''} active
          {sessions.length > 1 ? 's' : ''}
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="En piste"
          emptyMessage="Aucun pilote en roulage pour le moment."
          errorCause="La lecture des sessions n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <View style={{ gap: theme.spacing.sm }}>
            {sessions.map((session) => (
              <Card key={session.id} style={{ borderColor: ADMIN }}>
                {/* Le numéro, ou « — » s'il n'en a pas déclaré. Jamais un nom :
                    l'administrateur surveille la piste, il n'identifie pas des
                    personnes depuis cet écran. */}
                <Text style={s.pilotName}>
                  {session.carNo !== null ? `N° ${session.carNo}` : 'Numéro non déclaré'}
                </Text>
                <Text style={s.meta}>
                  Départ <Text style={s.metaNum}>{timeOnly(session.startedAt)}</Text> ·{' '}
                  <Text style={s.metaNum}>{session.lapCount ?? '—'}</Text> tour
                  {(session.lapCount ?? 0) > 1 ? 's' : ''}
                </Text>
              </Card>
            ))}
          </View>
        </StateWrapper>

        {/* Cette note dit VRAI — aucun canal temps réel n'existe dans l'espace
            admin. Ce sont le hub et le tour de contrôle qui annoncent à tort
            « État Bluetooth en temps réel » ; ils ont été corrigés, pas cette
            phrase-ci. */}
        <Text style={s.footnote}>
          Données lues à l&apos;ouverture de l&apos;écran, et à chaque « Réessayer ». Aucun
          rafraîchissement automatique.
        </Text>
      </View>
    </Screen>
  );
}

function timeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: ADMIN,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  pilotName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  // Chiffres de la méta (heure de départ, nombre de tours) — voix de l'instrument.
  metaNum: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamSoft,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
  },
};
