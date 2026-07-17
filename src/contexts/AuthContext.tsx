import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  SUPABASE_NOT_CONFIGURED_MESSAGE,
} from "@/lib/supabaseClient";
import {
  clearLocalScorelabData,
  hydrateStorageFromServer,
} from "@/lib/persistenceSync";

interface AuthResult {
  error: string | null;
}

interface SignUpResult extends AuthResult {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    displayName: string,
    email: string,
    password: string,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);

      if (nextSession?.user) {
        // Pull this account's data from Supabase (no-op if already hydrated).
        void hydrateStorageFromServer();
      }

      if (event === "SIGNED_OUT") {
        // Never leave one account's data cached for the next user of this browser.
        clearLocalScorelabData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: SUPABASE_NOT_CONFIGURED_MESSAGE };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signUp = async (
    displayName: string,
    email: string,
    password: string,
  ): Promise<SignUpResult> => {
    if (!supabase) {
      return { error: SUPABASE_NOT_CONFIGURED_MESSAGE, needsEmailConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    return { error: null, needsEmailConfirmation: !data.session };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: SUPABASE_NOT_CONFIGURED_MESSAGE };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? error.message : null };
  };

  const updatePassword = async (password: string): Promise<AuthResult> => {
    if (!supabase) return { error: SUPABASE_NOT_CONFIGURED_MESSAGE };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
