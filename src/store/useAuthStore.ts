/**
 * Store d'authentification — Zustand.
 *
 * Source de vérité pour la session Supabase, persistée via expo-secure-store
 * (cf. src/lib/supabase.ts). Sait initialiser, signer, déconnecter,
 * et garder en cache le profil `users` lié à la session.
 */

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setAnalyticsConsent } from '@/services/analyticsService';

export type UserRole = 'pilot' | 'admin' | 'coach' | 'partner' | 'pro_pilot';

type UserProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  pilot_level: string | null;
  is_admin: boolean;
  role: UserRole;
  profile_completed_at: string | null;
  pact_accepted_at: string | null;
  pact_version: string | null;
  coach_pact_accepted_at: string | null;
  coach_pact_version: string | null;
  cgu_accepted_at: string | null;
  privacy_accepted_at: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  /**
   * LA LECTURE DU PROFIL A-T-ELLE ÉCHOUÉ ?
   *
   * `profile === null` avait DEUX sens confondus : « ce compte n'a pas encore
   * de fiche » et « je n'ai pas pu lire sa fiche ». Tout le reste de
   * l'application lisait le second comme le premier :
   *
   *   • `app/index.tsx` envoyait l'administrateur vers l'onboarding pilote ;
   *   • le seuil `app/(admin)/_layout.tsx` le refoulait vers l'espace pilote —
   *     en pleine surveillance du jour J, au rafraîchissement du jeton, sur la
   *     4G du circuit ;
   *   • le `SpaceSwitcher`, sa seule porte de retour, disparaissait avec.
   *
   * Il ne restait qu'à tuer l'application. L'absence de donnée était lue comme
   * une absence de droit. Relevé par la cartographie de l'espace admin du
   * 02/08/2026.
   */
  profilIndisponible: boolean;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  error: string | null;
};

type AuthActions = {
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const initialState: AuthState = {
  session: null,
  user: null,
  profile: null,
  profilIndisponible: false,
  status: 'idle',
  error: null,
};

/**
 * Le profil, et la raison de son absence.
 *
 * `echec` distingue une lecture IMPOSSIBLE (réseau, RLS, jeton) d'une fiche
 * réellement absente. Les deux rendent `profil: null` — seul l'appelant peut
 * décider quoi en faire, et il ne le peut qu'en le sachant.
 */
async function fetchProfile(
  userId: string
): Promise<{ profil: UserProfile | null; echec: boolean }> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, first_name, last_name, pilot_level, is_admin, role, profile_completed_at, pact_accepted_at, pact_version, coach_pact_accepted_at, coach_pact_version, cgu_accepted_at, privacy_accepted_at'
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[OXV] Échec chargement profil :', error.message);
    return { profil: null, echec: true };
  }
  // Pas d'erreur et pas de ligne : la fiche n'existe pas. C'est un FAIT, pas
  // une panne — l'onboarding a précisément pour objet de la créer.
  if (!data) return { profil: null, echec: false };

  // MIROIR LOCAL DU CONSENTEMENT À LA MESURE D'AUDIENCE.
  //
  // `trackEvent` est synchrone et ne peut pas interroger la base ; il lit un
  // miroir en stockage local, fermé par défaut. Sans cette recopie, un pilote
  // ayant accepté sur une version précédente resterait muet pour toujours — et
  // la garde, en s'appliquant à des gens qui avaient déjà consenti, ne
  // protégerait plus personne.
  //
  // La base fait foi dans les deux sens : elle rouvre, et elle referme.
  const accepte = (data as { privacy_accepted_at?: string | null }).privacy_accepted_at;
  setAnalyticsConsent(typeof accepte === 'string' && accepte.length > 0);

  // Fallback de sécurité : si role est absent, on assume pilot.
  return {
    profil: { ...(data as UserProfile), role: (data as { role?: UserRole }).role ?? 'pilot' },
    echec: false,
  };
}

/**
 * Délai au-delà duquel on cesse d'attendre le réseau au démarrage.
 *
 * Généreux à dessein : une connexion de paddock est lente, pas forcément
 * morte, et rendre la main trop tôt ferait clignoter un écran d'erreur devant
 * un pilote dont la session allait aboutir. Vingt secondes tiennent les deux
 * bouts — on laisse sa chance au réseau, sans jamais bloquer indéfiniment.
 */
const DELAI_INIT_MS = 20_000;

/** Incrémenté à chaque `initialize()` : sert à ignorer les retours périmés. */
let generationInit = 0;

/** L'abonnement aux changements d'authentification n'est posé qu'une fois. */
let ecouteurAuthPose = false;

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  initialize: async () => {
    if (get().status === 'loading') return;

    // MONTRE DE GARDE — sans elle, l'application peut rester sur le splash
    // indéfiniment. Constaté le 03/08/2026 : `getSession()` déclenche un
    // rafraîchissement réseau dès que le jeton approche de l'expiration (marge
    // de 90 s, donc à presque chaque démarrage à froid). Le `fetch` de React
    // Native n'a AUCUN délai par défaut : derrière un portail captif — le Wi-Fi
    // d'un paddock, exactement notre terrain — la requête ne répond ni ne
    // tombe. La promesse ne se résout jamais, `status` reste 'loading', et
    // `app/_layout.tsx` ne cache jamais le splash. Le try/catch ne sert à rien :
    // il n'y a pas d'erreur, il y a une attente.
    //
    // La montre transforme cette attente en `status: 'error'`, ce qui affiche
    // l'écran honnête de `app/index.tsx` — « Connexion impossible. Vérifiez
    // votre réseau, puis réessayez. » — dont le bouton rappelle initialize().
    //
    // Le compteur de génération protège du retour tardif : si la requête
    // aboutit après la montre, ou si le pilote a déjà réessayé, l'écriture
    // périmée est ignorée plutôt que d'écraser un état plus récent.
    const generation = ++generationInit;
    const aJour = () => generation === generationInit;

    set({ status: 'loading', error: null });

    const montre = setTimeout(() => {
      if (!aJour() || get().status !== 'loading') return;
      set({
        status: 'error',
        error: `Le réseau n'a pas répondu en ${Math.round(DELAI_INIT_MS / 1000)} s.`,
      });
    }, DELAI_INIT_MS);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!aJour()) return;
      const session = data.session;
      if (!session) {
        set({ ...initialState, status: 'unauthenticated' });
      } else {
        const lu = await fetchProfile(session.user.id);
        if (!aJour()) return;
        set({
          session,
          user: session.user,
          profile: lu.profil,
          profilIndisponible: lu.echec,
          status: 'authenticated',
          error: null,
        });
      }
      // Un seul abonnement pour toute la vie du processus. `initialize()` peut
      // être rappelée — c'est ce que fait « Réessayer » — et sans ce garde-fou
      // chaque tentative empilerait un écouteur de plus, donc une lecture de
      // profil de plus à chaque rafraîchissement de jeton.
      if (!ecouteurAuthPose) {
        ecouteurAuthPose = true;
        supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          if (!nextSession) {
            set({ ...initialState, status: 'unauthenticated' });
            return;
          }
          // LE RAFRAÎCHISSEMENT DE JETON PASSE ICI, toutes les heures. Une lecture
          // ratée y écrasait un profil valide par `null` : c'est le chemin exact
          // par lequel l'administrateur se faisait expulser en pleine séance.
          const lu = await fetchProfile(nextSession.user.id);
          set({
            session: nextSession,
            user: nextSession.user,
            // On CONSERVE le profil déjà connu plutôt que de l'effacer : un jeton
            // rafraîchi ne change pas qui est la personne.
            profile: lu.echec ? get().profile : lu.profil,
            profilIndisponible: lu.echec,
            status: 'authenticated',
            error: null,
          });
        });
      }
    } catch (err) {
      if (!aJour()) return;
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      set({ status: 'error', error: message });
    } finally {
      clearTimeout(montre);
    }
  },

  signIn: async (email, password) => {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ status: 'unauthenticated', error: translateAuthError(error.message) });
      return;
    }
    const lu = await fetchProfile(data.user.id);
    set({
      session: data.session,
      user: data.user,
      profile: lu.profil,
      profilIndisponible: lu.echec,
      status: 'authenticated',
      error: null,
    });
  },

  signOut: async () => {
    set({ status: 'loading', error: null });
    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ status: 'authenticated', error: error.message });
      return;
    }
    set({ ...initialState, status: 'unauthenticated' });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;
    const lu = await fetchProfile(user.id);
    // Même règle qu'au rafraîchissement de jeton : un échec ne détruit pas ce
    // qu'on savait déjà. Il le SIGNALE, et l'écran propose de réessayer.
    set({ profile: lu.echec ? get().profile : lu.profil, profilIndisponible: lu.echec });
  },
}));

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Identifiants incorrects.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Adresse non confirmée. Vérifiez votre boîte de réception.';
  }
  if (lower.includes('network')) {
    return 'Connexion impossible. Vérifiez votre réseau.';
  }
  return message;
}
