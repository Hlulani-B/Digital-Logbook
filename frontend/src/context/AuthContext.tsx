import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

// Dev mode bypass - creates mock user for local testing
const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS === "true";
const DEV_USER: User = {
  id: "dev-test-user-id",
  email: "dev@test.com",
  user_metadata: { full_name: "Dev User", name: "Dev User" },
  app_metadata: { provider: "dev" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  restoreAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Dev mode bypass - skip Supabase auth
    if (DEV_MODE) {
      console.log("[DEV MODE] Using mock user - auth bypassed");
      setState({
        user: DEV_USER,
        session: null,
        loading: false,
      });
      return;
    }

    // Get initial session
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (DEV_MODE) { console.log("[DEV MODE] signInWithGoogle skipped"); return; }
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
    if (DEV_MODE) { console.log("[DEV MODE] signInWithGitHub skipped"); return; }
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (DEV_MODE) { console.log("[DEV MODE] signInWithEmail skipped"); return; }
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (DEV_MODE) { console.log("[DEV MODE] signUpWithEmail skipped"); return; }
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (DEV_MODE) { console.log("[DEV MODE] signOut skipped"); return; }
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    if (DEV_MODE) { console.log("[DEV MODE] resetPassword skipped"); return; }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    if (DEV_MODE) { console.log("[DEV MODE] updatePassword skipped"); return; }
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const deleteAccount = async () => {
    if (DEV_MODE) { console.log("[DEV MODE] deleteAccount skipped"); return; }

    // Schedule the account for deletion (30-day grace period)
    const { error } = await getSupabase().rpc("delete_user");
    if (error) {
      throw new Error(error.message || "Could not schedule account deletion");
    }

    // Sign the user out; they can still sign back in during the grace period to restore
    await getSupabase().auth.signOut();
  };

  const restoreAccount = async () => {
    if (DEV_MODE) { console.log("[DEV MODE] restoreAccount skipped"); return; }

    // Cancel the scheduled deletion
    const { error } = await getSupabase().rpc("restore_user");
    if (error) {
      throw new Error(error.message || "Could not restore account");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signInWithGoogle,
        signInWithGitHub,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        resetPassword,
        updatePassword,
        deleteAccount,
        restoreAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
