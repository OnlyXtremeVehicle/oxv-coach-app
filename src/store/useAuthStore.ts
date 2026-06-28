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

export type UserRole = 'pilot' | 'admin' | 'coach' | 'partner';

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
  status: 'idle',
  error: null,
};

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, first_name, last_name, pilot_level, is_admin, role, profile_completed_at, pact_accepted_at, pact_version, coach_pact_accepted_at, coach_pact_version, cgu_accepted_at, privacy_accepted_at'
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[OXV] Échec chargement profil :', error.message);
    return null;
  }
  if (!data) return null;
  // Fallback de sécurité : si role est absent, on assume pilot.
  return { ...(data as UserProfile), role: (data as { role?: UserRole }).role ?? 'pilot' };
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', error: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const session = data.session;
      if (!session) {
        set({ ...initialState, status: 'unauthenticated' });
      } else {
        const profile = await fetchProfile(session.user.id);
        set({
          session,
          user: session.user,
          profile,
          status: 'authenticated',
          error: null,
        });
      }
      supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!nextSession) {
          set({ ...initialState, status: 'unauthenticated' });
          return;
        }
        const profile = await fetchProfile(nextSession.user.id);
        set({
          session: nextSession,
          user: nextSession.user,
          profile,
          status: 'authenticated',
          error: null,
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      set({ status: 'error', error: message });
    }
  },

  signIn: async (email, password) => {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ status: 'unauthenticated', error: translateAuthError(error.message) });
      return;
    }
    const profile = await fetchProfile(data.user.id);
    set({
      session: data.session,
      user: data.user,
      profile,
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
    const profile = await fetchProfile(user.id);
    set({ profile });
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
