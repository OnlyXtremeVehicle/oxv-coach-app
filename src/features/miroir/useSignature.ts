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
 *   - LA FENÊTRE DE 30 JOURS EST TOMBÉE LE 12/08/2026. Pour un usage
 *     saisonnier — six journées de piste par an —, une fenêtre glissante d'un
 *     mois laisse le radar vide onze mois sur douze. Le plan V3 fixe d'ailleurs
 *     les effectifs attendus du sélecteur en séances d'historique
 *     (« Signature générale · 11 séances »), pas en séances du mois. Le radar
 *     lit donc l'historique borné, et la Saison reste l'objet du temps ;
 *   - LE FILTRE PAR PAIRE (V3) : les paires sont DÉRIVÉES des séances qui
 *     nourrissent réellement le radar — celles dont le QDI est valide à l'algo
 *     courant. Une paire proposée sans QDI serait sélectionnable et vide ;
 *   - ERREUR ≠ VIDE (correctif V2-L1) : les deux sources de contenu sont lues
 *     en mode STRICT (elles rejettent sur erreur DB au lieu d'avaler en
 *     []/null). Le statut d'écran est arbitré par signatureStatusFromSources
 *     (logique pure testée) : sans aucun contenu ET avec au moins un échec →
 *     'error' + retry — jamais l'état vide « après votre premier roulage
 *     analysé » fabriqué sur une panne réseau.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CLE_GENERALE,
  libelleSelection,
  pairesRoulees,
  seancesDeLaPaire,
  selecteurUtile,
  type Paire,
} from '@/features/data/pairesLogic';
import { vehicleName } from '@/features/vous/garageLogic';
import { listMyVehicles, type Vehicle } from '@/services/garageService';
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
  signatureStatusFromSources,
} from './signatureLogic';

/**
 * Plafond de séances lues pour le radar (borne réseau).
 *
 * Vingt-quatre : quatre saisons d'un pilote qui roule six journées par an. Le
 * coût est un appel QDI par séance — c'est la borne, et elle est écrite ici
 * plutôt que devinée à la lecture.
 */
const BASELINE_MAX_SESSIONS = 24;
/** Mois demandés à listMonthlyQdi pour la bande Empreinte. */
const EMPREINTE_MONTHS = 6;
/** Séances récentes inspectées pour compter celles avec données biométriques. */
const PHYSIO_SESSION_SCAN = 10;

export interface SignatureBaseline {
  branches: QdiBranches;
  /** Nombre de séances dont le QDI a nourri la médiane. */
  sessions: number;
}

/** Une séance retenue pour le radar : son QDI valide et sa paire. */
interface SeanceRetenue {
  circuitId: string | null;
  circuitName: string | null;
  vehicleId: string | null;
  qdi: QdiRecord;
}

export type SignatureStatus = 'loading' | 'error' | 'ready';

export interface SignatureState {
  status: SignatureStatus;
  /** Médiane de la sélection, null si elle n'a rien de mesuré. */
  baseline: SignatureBaseline | null;
  /** Mois de l'Empreinte (ordre croissant, le dernier = le plus récent). */
  monthly: MonthlyQdi[];
  /** Section physiologique BIO-4 — fail-closed, OFF tant que le drapeau l'est. */
  physioVisible: boolean;
  /** Paires réellement roulées, la plus fréquente d'abord. */
  paires: Paire[];
  /** Clé de la paire choisie, `CLE_GENERALE` par défaut. */
  selection: string;
  choisirPaire: (cle: string) => void;
  /** Le sélecteur mérite-t-il d'être affiché ? (faux sous deux paires) */
  selecteurVisible: boolean;
  /** Ligne sous le radar — ce qu'il montre. `null` = rien à annoncer. */
  legende: string | null;
  reload: () => void;
}

/**
 * Les séances qui nourrissent le radar, avec leur paire.
 *
 * Seules celles dont le QDI est VALIDE à l'algo courant sont retenues — les
 * 1.0.x sont documentés faux (axes G inversés) dans `qdiLogic`. C'est aussi ce
 * qui rend le sélecteur honnête : une paire dérivée d'une séance sans QDI
 * serait proposée puis vide.
 */
async function loadSeances(userId: string): Promise<SeanceRetenue[]> {
  const sessions = await fetchAllSessions(userId, {
    limit: BASELINE_MAX_SESSIONS,
    strict: true,
  });
  if (sessions.length === 0) return [];

  const fetched = await Promise.all(
    sessions.map((s) =>
      getQdiForSession(s.id)
        .then((qdi) => ({ s, qdi }))
        .catch(() => ({ s, qdi: null }))
    )
  );
  const retenues: SeanceRetenue[] = [];
  for (const { s, qdi } of fetched) {
    if (qdi === null || qdi.algoVersion !== QDI_ALGO_VERSION) continue;
    retenues.push({
      circuitId: s.circuit_id,
      circuitName: s.circuit_name,
      vehicleId: s.vehicle_id,
      qdi,
    });
  }

  if (retenues.length === 0) {
    // Un seul recalcul paresseux, sur la séance la plus récente
    // (fetchAllSessions trie started_at desc) — jamais tout l'historique.
    const premiere = sessions[0];
    const fresh = await getOrComputeQdiForSession(premiere.id).catch(() => null);
    if (fresh && fresh.algoVersion === QDI_ALGO_VERSION) {
      retenues.push({
        circuitId: premiere.circuit_id,
        circuitName: premiere.circuit_name,
        vehicleId: premiere.vehicle_id,
        qdi: fresh,
      });
    }
  }
  return retenues;
}

/** La médiane d'un jeu de séances, `null` si rien n'y est mesuré. */
function baselineDe(seances: readonly SeanceRetenue[]): SignatureBaseline | null {
  if (seances.length === 0) return null;
  const branches = medianBranches(seances.map((s) => s.qdi));
  if (measuredAxesCount(branches) === 0) return null;
  return { branches, sessions: seances.length };
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
  const [seances, setSeances] = useState<SeanceRetenue[]>([]);
  const [garage, setGarage] = useState<Vehicle[]>([]);
  const [monthly, setMonthly] = useState<MonthlyQdi[]>([]);
  const [physioVisible, setPhysioVisible] = useState(false);
  const [selection, setSelection] = useState<string>(CLE_GENERALE);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile) {
      // Session en cours d'expiration : le layout redirige — état vide stable.
      setStatus('ready');
      setSeances([]);
      setGarage([]);
      setMonthly([]);
      setPhysioVisible(false);
      return;
    }
    let cancelled = false;
    setStatus('loading');

    (async () => {
      const [b, m, p, g] = await Promise.allSettled([
        loadSeances(profile.id),
        // strict : rejette sur erreur DB (au lieu d'un [] indiscernable du
        // vide) — condition d'atteignabilité de l'état 'error' ci-dessous.
        listMonthlyQdi(profile.id, EMPREINTE_MONTHS, { strict: true }),
        loadPhysioVisible(profile.id),
        // Le garage ne sert QU'À NOMMER les véhicules du sélecteur : son
        // échec n'a pas à faire échouer le radar, `pairesRoulees` sait dire
        // un véhicule qu'elle ne peut pas nommer.
        listMyVehicles(),
      ]);
      if (cancelled) return;
      const seancesValue = b.status === 'fulfilled' ? b.value : [];
      const monthlyValue = m.status === 'fulfilled' ? m.value : [];
      // Arbitrage ERREUR ≠ VIDE (signatureLogic, testé) : une source avec du
      // contenu suffit à un écran honnête ; sans aucun contenu et avec au
      // moins un échec, l'état vide serait une affirmation fabriquée → error.
      const resolved = signatureStatusFromSources({
        baselineFailed: b.status === 'rejected',
        hasBaseline: seancesValue.length > 0,
        monthlyFailed: m.status === 'rejected',
        hasMonthly: monthlyValue.length > 0,
      });
      if (resolved === 'error') {
        setStatus('error');
        return;
      }
      setSeances(seancesValue);
      setGarage(g.status === 'fulfilled' ? g.value : []);
      setMonthly(monthlyValue);
      setPhysioVisible(p.status === 'fulfilled' ? p.value : false);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, reloadKey]);

  const paires = useMemo(() => {
    const nomDe = (id: string): string | null => {
      const v = garage.find((x) => x.id === id);
      return v ? vehicleName(v) : null;
    };
    return pairesRoulees(seances, nomDe);
  }, [seances, garage]);

  // La médiane suit la sélection. `seancesDeLaPaire` retombe sur la générale
  // pour une clé périmée — un véhicule supprimé entre deux chargements ne doit
  // pas vider le radar.
  const baseline = useMemo(
    () => baselineDe(seancesDeLaPaire(seances, selection)),
    [seances, selection]
  );

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const choisirPaire = useCallback((cle: string) => setSelection(cle), []);

  return {
    status,
    baseline,
    monthly,
    physioVisible,
    paires,
    selection,
    choisirPaire,
    selecteurVisible: selecteurUtile(paires),
    legende: libelleSelection(paires, selection),
    reload,
  };
}
