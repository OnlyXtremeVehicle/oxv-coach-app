/**
 * useDocuments — chargement de l'écran Licence & documents (V2-L4, VOUS 6/8).
 *
 * Services / sources EXISTANTS :
 *   - lecture DIRECTE des colonnes licence de `users` (ffsa_license, kyc_status,
 *     kyc_validated_at) — même patron que app/(app)/carte-licence.tsx v1, ZÉRO
 *     schéma, ZÉRO champ inventé ;
 *   - featureFlagsService (isFlagEnabled 'pilot_waivers') : garde de la Décharge.
 *
 * Fail-closed : le drapeau `pilot_waivers` par défaut OFF → la ligne Décharge est
 * « disponible prochainement » (waiverRowState). Le module légal (Pacte/CGU/
 * Confidentialité) est bundlé (LEGAL_DOCUMENTS) — rien à charger.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { isFlagEnabled } from '@/services/featureFlagsService';

import { licenceIdentityFromRow, type LicenceIdentity } from './documentsLogic';

export interface DocumentsState {
  status: 'loading' | 'ready' | 'error';
  identity: LicenceIdentity;
  /** Drapeau `pilot_waivers` (fail-closed : défaut false). */
  waiverFlagOn: boolean;
}

export interface Documents extends DocumentsState {
  reload: () => void;
}

const EMPTY_IDENTITY: LicenceIdentity = {
  ffsaLicense: null,
  kycStatus: null,
  kycValidatedAt: null,
};

const INITIAL: DocumentsState = {
  status: 'loading',
  identity: EMPTY_IDENTITY,
  waiverFlagOn: false,
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

async function fetchLicenceRow(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('users')
    .select('ffsa_license, kyc_status, kyc_validated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`fetchLicenceRow : ${error.message}`);
  return (data as Record<string, unknown> | null) ?? null;
}

export function useDocuments(userId: string | null): Documents {
  const [state, setState] = useState<DocumentsState>(INITIAL);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (userId === null) {
      if (alive.current) setState({ ...INITIAL, status: 'ready' });
      return;
    }
    const [rowR, flagR] = await Promise.allSettled([
      fetchLicenceRow(userId),
      isFlagEnabled('pilot_waivers'),
    ]);

    // La licence est la source PRIMAIRE de l'écran : son échec est une vraie
    // erreur (jamais une identité vide fabriquée). Le drapeau, lui, est fail-closed.
    if (rowR.status === 'rejected') {
      if (alive.current) setState({ ...INITIAL, status: 'error' });
      return;
    }

    if (!alive.current) return;
    setState({
      status: 'ready',
      identity: licenceIdentityFromRow(settled(rowR, null)),
      waiverFlagOn: settled(flagR, false),
    });
  }, [userId]);

  useEffect(() => {
    alive.current = true;
    setState((s) => ({ ...s, status: 'loading' }));
    load().catch(() => {
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
    return () => {
      alive.current = false;
    };
  }, [load]);

  const reload = useCallback(() => {
    load().catch(() => {
      if (alive.current) setState((s) => ({ ...s, status: 'error' }));
    });
  }, [load]);

  return { ...state, reload };
}
