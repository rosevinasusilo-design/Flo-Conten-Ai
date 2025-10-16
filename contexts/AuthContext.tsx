import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

// Kunci untuk menyimpan ID sesi di local storage
const SESSION_ID_STORAGE_KEY = 'active_session_id';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  verifySession: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async (isForced: boolean = false) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const localSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);

    if (currentUser && localSessionId && !isForced) {
        await supabase
            .from('profiles')
            .update({ active_session_id: null })
            .eq('id', currentUser.id)
            .eq('active_session_id', localSessionId);
    }

    await supabase.auth.signOut();
    // State akan dibersihkan oleh listener onAuthStateChange
  }, []);

  const verifySession = useCallback(async () => {
    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const localSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);

        if (currentUser && localSessionId) {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('active_session_id')
                .eq('id', currentUser.id);
            
            if (error) {
                throw error;
            }
            
            const profile = profiles?.[0];

            if (profile && profile.active_session_id !== localSessionId) {
                await logout(true);
            }
        } else if (currentUser && !localSessionId) {
            await logout(true);
        }
    } catch (err: any) {
        const errorMessage = (err && typeof err.message === 'string') ? err.message : 'An unknown error occurred during session verification.';
        console.error("Error verifying remote session:", errorMessage);
        await logout(true);
    }
  }, [logout]);


  // Efek ini HANYA berjalan sekali saat aplikasi pertama kali dimuat
  useEffect(() => {
    const checkInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (initialSession) {
          const currentUser = initialSession.user;
          const localSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);

          if (!localSessionId) {
            await logout(true);
            return;
          }

          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('is_active, active_session_id')
            .eq('id', currentUser.id);

          const profile = profiles?.[0] || null;

          if (error || !profile?.is_active || profile.active_session_id !== localSessionId) {
            await logout(true);
          } else {
            setSession(initialSession);
            setUser(currentUser);
          }
        }
      } catch (err: any) {
        const errorMessage = (err && typeof err.message === 'string') ? err.message : 'An unknown error occurred during initial session check.';
        console.error("Error during initial session check:", errorMessage);
        await logout(true);
      } finally {
        setLoading(false);
      }
    };

    checkInitialSession();
  }, [logout]); // Bergantung pada logout, yang di-memoize

  // Efek ini menangani event yang terjadi SETELAH pemuatan awal
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          localStorage.removeItem(SESSION_ID_STORAGE_KEY);
        } else if (event === 'TOKEN_REFRESHED') {
          // A token refresh event was received. This means the user is still active.
          // We update the session in our state, then run our custom verification logic.
          // If verification fails, it will trigger a logout, and the SIGNED_OUT event handler will clear the state.
          if (session) {
            setSession(session);
            setUser(session.user);
            await verifySession();
          }
        }
        // Event SIGNED_IN sengaja diabaikan di sini karena ditangani secara manual oleh fungsi login
      }
    );

    return () => subscription.unsubscribe();
  }, [verifySession]);


  const login = async (email: string, pass: string) => {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: pass,
    });
    if (signInError) throw new Error(signInError.message);
    if (!signInData.user || !signInData.session) throw new Error("Gagal mendapatkan data pengguna setelah login.");

    const { user: loggedInUser, session: newSession } = signInData;

    try {
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', loggedInUser.id);

        if (profileError) throw new Error("Tidak dapat memverifikasi profil Anda: " + profileError.message);
        
        const profile = profiles?.[0] || null;

        if (!profile) throw new Error("Profil pengguna tidak dapat ditemukan. Silakan hubungi administrator.");
        if (!profile.is_active) throw new Error("Akun Anda belum diaktifkan oleh administrator.");

        const sessionId = crypto.randomUUID();
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ active_session_id: sessionId })
          .eq('id', loggedInUser.id);
        
        if (updateError) throw new Error("Gagal memulai sesi aman: " + updateError.message);
        
        localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);

        // Atur state secara manual untuk menghindari race condition dengan listener
        setSession(newSession);
        setUser(loggedInUser);

    } catch (error: any) {
        await supabase.auth.signOut(); // Pastikan logout jika ada langkah yang gagal
        
        // Ensure we always throw a proper Error object so the UI can handle it.
        if (error instanceof Error) {
            throw error;
        }
        // Handle Supabase error objects or other plain objects that have a message property.
        if (error && typeof error.message === 'string') {
            throw new Error(error.message);
        }
        // Fallback for unknown/unstructured errors.
        throw new Error('An unexpected error occurred during the login process.');
    }
  };

  const register = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
        email: email,
        password: pass,
    });
    if (error) throw new Error(error.message);
  };

  const value = {
    user,
    session,
    login,
    register,
    logout,
    verifySession,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};