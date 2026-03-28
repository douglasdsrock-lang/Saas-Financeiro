'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { handleSupabaseError } from '@/lib/utils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  console.log('AuthProvider: Rendering...', { loading, pathname });

  useEffect(() => {
    let mounted = true;
    console.log('AuthProvider: Initializing session check...');

    const getSession = async () => {
      const timeout = setTimeout(() => {
        if (mounted) {
          console.warn('AuthProvider: Supabase getSession timed out after 3s');
          setLoading(false);
        }
      }, 3000);

      try {
        if (!supabase) {
          console.error('AuthProvider: Supabase client is not initialized');
          if (mounted) setLoading(false);
          return;
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('AuthProvider: getSession error:', error);
          throw error;
        }
        console.log('AuthProvider: Session retrieved:', session ? 'User logged in' : 'No session');
        if (mounted) setUser(session?.user ?? null);
      } catch (error: any) {
        console.error('AuthProvider: Error in getSession:', error);
        // handleSupabaseError(error, 'Erro ao verificar sessão.');
      } finally {
        console.log('AuthProvider: Finalizing initialization');
        clearTimeout(timeout);
        if (mounted) setLoading(false);
      }
    };

    getSession();

    // Fail-safe: force loading to false after 5 seconds
    const failSafeTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('AuthProvider: Fail-safe timeout triggered');
        setLoading(false);
      }
    }, 5000);

    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthProvider: Auth state changed:', event, session ? 'User logged in' : 'No session');
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      console.log('AuthProvider: Unmounting, unsubscribing...');
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
