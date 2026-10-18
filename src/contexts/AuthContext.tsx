import type { User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  isFirebaseConfigured,
  observeAuthState,
} from '../services/firebase';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    return observeAuthState(
      (nextUser) => {
        setUser(nextUser);
        setIsLoading(false);
      },
      (error) => {
        console.error('[AuthContext] Falha ao observar a sessão Firebase:', error);
        setIsLoading(false);
      },
    );
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return context;
}
