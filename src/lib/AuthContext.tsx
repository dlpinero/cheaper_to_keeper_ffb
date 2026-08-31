import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabaseClient';
import type { Manager } from '../types/database';

interface AuthState {
  session: Session | null;
  manager: Manager | null;
  loading: boolean;
  refreshManager: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadManagerForSession(currentSession: Session | null) {
    if (!currentSession) {
      setManager(null);
      return;
    }
    const { data } = await supabase
      .from('managers')
      .select('*')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    if (data) {
      setManager(data);
      return;
    }

    // First login: try to claim the manager seat the commissioner pre-created
    // for this email address.
    const { data: claimed, error } = await supabase.rpc('claim_manager_seat');
    setManager(error ? null : (claimed ?? null));
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadManagerForSession(data.session).finally(() => setLoading(false));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      loadManagerForSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function refreshManager() {
    await loadManagerForSession(session);
  }

  return (
    <AuthContext.Provider value={{ session, manager, loading, refreshManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
