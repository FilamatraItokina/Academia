import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { auth, googleAuthProvider } from '../../lib/firebase.ts';
import { apiFetch, ApiClientError } from '../services/apiClient.ts';
import type { UserProfile } from '../types/api.ts';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadBackendProfile = useCallback(async () => {
    try {
      setAuthError(null);
      const data = await apiFetch<{ user: UserProfile }>('/auth/me');
      setProfile(data.user);
    } catch (err) {
      setProfile(null);
      if (err instanceof ApiClientError) {
        setAuthError(err.message);
      } else {
        setAuthError('Impossible de vérifier votre profil scolaire.');
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadBackendProfile();
      } else {
        setProfile(null);
        setAuthError(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [loadBackendProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      await loadBackendProfile();
      await apiFetch('/auth/session-audit', {
        method: 'POST',
        body: JSON.stringify({ event: 'AUTH_LOGIN' }),
      }).catch(() => undefined);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAuthError(err.message);
      } else if (err instanceof Error && err.message.includes('popup-closed-by-user')) {
        setAuthError('La fenêtre de connexion a été fermée avant la validation.');
      } else {
        setAuthError('Échec de l’authentification Google. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  }, [loadBackendProfile]);

  const signOut = useCallback(async () => {
    if (profile) {
      await apiFetch('/auth/session-audit', {
        method: 'POST',
        body: JSON.stringify({ event: 'AUTH_LOGOUT' }),
      }).catch(() => undefined);
    }
    await firebaseSignOut(auth);
    setProfile(null);
    setAuthError(null);
  }, [profile]);

  const hasPermission = useCallback(
    (code: string) => {
      return Boolean(profile?.permissions.includes(code));
    },
    [profile]
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        refreshProfile: loadBackendProfile,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
