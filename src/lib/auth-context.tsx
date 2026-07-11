'use client';

import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { firebaseAuth, googleProvider, isFirebaseConfigured } from './firebase';

interface AuthState {
  user: User | null;
  /** 초기 인증 상태 확인 중 여부. */
  loading: boolean;
  /** Firebase env 설정 여부 — false면 클라우드 기능 비활성. */
  enabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: false,
  enabled: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(firebaseAuth(), googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth());
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, enabled: isFirebaseConfigured, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
