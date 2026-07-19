/**
 * useSignature — données de l'écran SIGNATURE (lot V2-L1, écran 3/3).
 *
 * Services EXISTANTS uniquement (règle du lot — aucun service créé) :
 *   - fenêtre « 30 jours » : fetchAllSessions (sessionsService) borné à la
 *     fenêtre + getQdiForSession (qdiService, QDI persisté) + medianBranches
 *     (qdiLogic) — médiane par branche des QDI de la fenêtre, self-only ;
 *   - Empreinte : listMonthlyQdi (qdiService, médianes mensuelles — le
 *     service filtre par algo_version : un mois sans QDI valide n'existe pas) ;
 *   - gate physiologique BIO-4 : isFlagEnabled('biometry') puis
 *     loadBiometryConsents puis comptage getSessionBiometry — FAIL-CLOSED,
 *     chaîne coupée au premier refus (drapeau OFF → aucune autre requête,
 *     zéro teasing).
 *
 * Honnêteté des données (règle fondateur) :
 *   - seuls les QDI persistés à l'algo COURANT comptent (les 1.0.x sont
 *     documentés invalides dans qdiLogic — axes G inversés) ;
 *   - si aucune séance de la fenêtre n'a de QDI valide, UN SEUL recalcul
 *     paresseux est tenté sur la plus récente (même patron que l'écran
 *     signature v1) — jamais un recalcul en rafale de toute la fenêtre ;
 *   - fenêtre sans branche mesurée → baseline null (l'écran bascule sur le
 *     mois le plus récent de l'Empreinte, jamais un radar « vide mesuré ») ;
 *   - ERREUR ≠ VIDE (correctif V2-L1) : les deux sources de contenu sont lues
 *     en mode STRICT (elles rejettent sur erreur DB au lieu d'avaler en
 *     []/null). Le statut d'écran est arbitré par signatureStatusFromSources
 *     (logique pure testée) : sans aucun contenu ET avec au moins un échec →
 *     'error' + retry — jamais l'état vide « après votre premier roulage
 *     analysé » fabriqué sur une panne réseau.
 */

import { useCallback, useEffect, useState } from 'react';

import { medianBranches, QDI_ALGO_VERSION } from '@/services/qdiLogic';
import type { QdiBranches } from '@/services/qdiLogic';
import {
  getOrComputeQdiForSession,
  getQdiForSession,
  listMonthlyQdi,
  type MonthlyQdi,
  type QdiRecord,
} from '@/services/qdiService';
import { fetchAllSessions } from '@/services/sessionsService';
import { loadBiometryConsents } from '@/services/consentService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { getSessionBiometry } from '@/services/v2/biometryService';
import { useAuthStore } from '@/store/useAuthStore';

import {
  measuredAxesCount,
  PHYSIO_MIN_SESSIONS,
  physioSectionVisible,
  SIGNATURE_WINDOW_DAYS,
  signatureStatusFromSources,
} from './signatureLogic';

/** Plafond de séances lues pour la fenêtre 30 jours (borne réseau). */
const BASELINE_MAX_SESSIONS = 12;
/** Mois demandés à listMonthlyQdi pour la bande Empreinte. */
const EMPREINTE_MONTHS = 6;
/** Séances récentes inspectées pour compter celles avec données biométriques. */
const PHYSIO_SESSION_SCAN = 10;

export interface SignatureBaseline {
  branches: QdiBranches;
  /** Nombre de séances de la fenêtre dont le QDI a nourri la médiane. */
  sessions: number;
}

export type SignatureStatus = 'loading' | 'error' | 'ready';

export interface SignatureState {
  status: SignatureStatus;
  /** Médiane 30 jours, null si la fenêtre n'a rien de mesuré. */
  baseline: SignatureBaseline | null;
  /** Mois de l'Empreinte (ordre croissant, le dernier = le plus récent). */
  monthly: MonthlyQdi[];
  /** Section physiologique BIO-4 — fail-closed, OFF tant que le drapeau l'est. */
  physioVisible: boolean;
  reload: () => void;
}

async function loadBaseline(userId: string): Promise<SignatureBaseline | null> {
  const fromDate = new Date(Date.now() - SIGNATURE_WINDOW_DAYS * 86_400_000).toISOString();
  const sessions = await fetchAllSessions(userId, {
    fromDate,
    limit: BASELINE_MAX_SESSIONS,
    strict: true,
  });
  if (sessions.length === 0) return null;

  const fetched = await Promise.all(sessions.map((s) => getQdiForSession(s.id).catch(() => null)));
  const valid = fetched.filter(
    (r): r is QdiRecord => r !== null && r.algoVersion === QDI_ALGO_VERSION
  );

  if (valid.length === 0) {
    // Un seul recalcul paresseux, sur la séance la plus récente de la fenêtre
    // (fetchAllSessions trie started_at desc) — jamais toute la fenêtre.
    const fresh = await getOrComputeQdiForSession(sessions[0].id).catch(() => null);
    if (fresh && fresh.algoVersion === QDI_ALGO_VERSION) valid.push(fresh);
  }
  if (valid.length === 0) return null;

  const branches = medianBranches(valid);
  if (measuredAxesCount(branches) === 0) return null;
  return { branches, sessions: valid.length };
}

async function loadPhysioVisible(userId: string): Promise<boolean> {
  // FAIL-CLOSED : chaque étage coupe la chaîne — drapeau OFF (état actuel en
  // prod) → on s'arrête ici, aucune lecture consentement ni biométrie.
  const flagEnabled = await isFlagEnabled('biometry');
  if (!flagEnabled) return false;

  const consents = await loadBiometryConsents(userId);
  if (!consents.capture) return false;

  // Compte borné, séquentiel, sortie anticipée dès le seuil atteint — pas de
  // rafale réseau pour une section d'appoint.
  const sessions = await fetchAllSessions(userId, { limit: PHYSIO_SESSION_SCAN });
  let sessionsWithData = 0;
  for (const s of sessions) {
    if (sessionsWithData >= PHYSIO_MIN_SESSIONS) break;
    try {
      const rows = await getSessionBiometry(s.id);
      if (rows.length > 0) sessionsWithData += 1;
    } catch {
      // Séance illisible → ne compte pas (fail-closed).
    }
  }
  return physioSectionVisible({ flagEnabled, captureConsent: consents.capture, sessionsWithData });
}

export function useSignature(): SignatureState {
  const profile = useAuthStore((s) => s.profile);
  const [status, setStatus] = useState<SignatureStatus>('loading');
  const [baseline, setBaseline] = useState<SignatureBaseline | null>(null);
  const [monthly, setMonthly] = useState<MonthlyQdi[]>([]);
  const [physioVisible, setPhysioVisible] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile) {
      // Session en cours d'expiration : le layout redirige — état vide stable.
      setStatus('ready');
      setBaseline(null);
      setMonthly([]);
      setPhysioVisible(false);
      return;
    }
    let cancelled = false;
    setStatus('loading');

    (async () => {
      const [b, m, p] = await Promise.allSettled([
        loadBaseline(profile.id),
        // strict : rejette sur erreur DB (au lieu d'un [] indiscernable du
        // vide) — condition d'atteignabilité de l'état 'error' ci-dessous.
        listMonthlyQdi(profile.id, EMPREINTE_MONTHS, { strict: true }),
        loadPhysioVisible(profile.id),
      ]);
      if (cancelled) return;
      const baselineValue = b.status === 'fulfilled' ? b.value : null;
      const monthlyValue = m.status === 'fulfilled' ? m.value : [];
      // Arbitrage ERREUR ≠ VIDE (signatureLogic, testé) : une source avec du
      // contenu suffit à un écran honnête ; sans aucun contenu et avec au
      // moins un échec, l'état vide serait une affirmation fabriquée → error.
      const resolved = signatureStatusFromSources({
        baselineFailed: b.status === 'rejected',
        hasBaseline: baselineValue !== null,
        monthlyFailed: m.status === 'rejected',
        hasMonthly: monthlyValue.length > 0,
      });
      if (resolved === 'error') {
        setStatus('error');
        return;
      }
      setBaseline(baselineValue);
      setMonthly(monthlyValue);
      setPhysioVisible(p.status === 'fulfilled' ? p.value : false);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { status, baseline, monthly, physioVisible, reload };
}
