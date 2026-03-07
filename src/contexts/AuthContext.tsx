import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { firebaseAuth } from '../firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Consume redirect result from Google sign-in (when popup was blocked)
    getRedirectResult(firebaseAuth).catch(() => {
      // Ignore: user may have landed here without a redirect
    });

    const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
      // Defer state update to next tick so Redirect runs without causing "Maximum update depth" with IonReactRouter
      queueMicrotask(() => {
        setUser(u);
        setLoading(false);
      });
    });
    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
