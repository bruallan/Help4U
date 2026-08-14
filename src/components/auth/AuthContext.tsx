import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  role: string | null;
  mainLocationId: number | null;
  loading: boolean;
  isAuthEnabled: boolean;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  role: 'Equipe interna', // Default mock bypass
  mainLocationId: null, 
  loading: true,
  isAuthEnabled: false
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mainLocationId, setMainLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthEnabled = !!supabase;

  useEffect(() => {
    if (!supabase) {
      // Bypass auth se as chaves não estiverem configuradas
      setRole('Equipe interna');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.email);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.email);
      } else {
        setRole(null);
        setMainLocationId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (email?: string) => {
    if (!email || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('authorized_emails')
        .select('role, main_location_id')
        .eq('contact_email', email)
        .single();
      
      if (!error && data) {
        setRole(data.role);
        setMainLocationId(data.main_location_id);
      } else if (error && error.code === 'PGRST116') {
         // Usuário não está na tabela de autorizados
         setRole(null);
         setMainLocationId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, mainLocationId, loading, isAuthEnabled }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
