import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { firebaseAuth } from '../firebase';
import { LOGIN_ACTIVITY_DATES_KEY, LOGIN_STREAK_CHANGED_EVENT } from '../utils/learnStreak';
import { dispatchLoginStreakSynced, syncLoginStreakOnAuth } from '../utils/loginStreakFirestore';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => firebaseAuth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const configurePersistence = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await setPersistence(firebaseAuth, indexedDBLocalPersistence);
          return;
        } catch {
          // Fall through to browserLocalPersistence fallback.
        }
      }
      try {
        await setPersistence(firebaseAuth, browserLocalPersistence);
      } catch {
        // Keep Firebase default persistence when explicit setup is blocked.
      }
    };

    // Web only: consume redirect result when popup was blocked (native uses plugin + credential)
    if (!Capacitor.isNativePlatform()) {
      getRedirectResult(firebaseAuth).catch(() => {
        // Ignore: user may have landed here without a redirect
      });
    }
    void configurePersistence();

    const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
      if (!isMounted) return;
      // Defer state update to next tick so Redirect runs without causing "Maximum update depth" with IonReactRouter
      queueMicrotask(() => {
        if (!isMounted) return;
        setUser(u);
        setLoading(false);
        if (u) {
          void (async () => {
            try {
              const r = await syncLoginStreakOnAuth(u.uid);
              try {
                localStorage.setItem(LOGIN_ACTIVITY_DATES_KEY, JSON.stringify(r.loginActivityDates));
              } catch {
                /* ignore */
              }
              dispatchLoginStreakSynced({
                streakCount: r.streakCount,
                shouldShowCelebration: r.shouldShowCelebration,
              });
              window.dispatchEvent(new Event(LOGIN_STREAK_CHANGED_EVENT));
            } catch (e) {
              console.error('Login streak sync failed:', e);
            }
          })();
        }
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
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
