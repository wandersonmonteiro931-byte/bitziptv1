import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "client";

export interface Profile {
  id: string;
  name: string;
  username: string;
  balance: number;
  total_earned: number;
  referral_code: string;
  referred_by: string | null;
  iptv_user: string;
  iptv_server: string;
  iptv_app: string;
  iptv_expiry: string | null;
  status: string;
  pix_key: string;
  created_at: string;
  balance_frozen: boolean;
  credits: number;
  credit_purchases_blocked: boolean;
  vip_badge: boolean;
  user_level: string;
  level_points: number;
  iptv_monthly_value: number;
  iptv_connections: number;
  iptv_tv_app: string;
  iptv_status: string;
  iptv_due_day: number;
  billing_due_date_id: string | null;
  billing_cycle_started_at: string | null;
  billing_first_cycle_paid: boolean;
  billing_proportional_enabled: boolean;
  billing_first_cycle_prorated_amount: number | null;
  billing_grace_days_override: number | null;
  iptv_client_code: string;
  iptv_password: string;
  admin_notes: string;
  admin_notes_urgent: boolean;
}

export interface LoginResult {
  error: string | null;
  profile: Profile | null;
  role: UserRole | null;
}

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

type FetchProfileResult = {
  profile: Profile | null;
  role: UserRole | null;
  error: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error: unknown, fallback = "Erro ao conectar. Tente novamente.") {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return String(error || fallback);
}

function isAbortLikeError(error: unknown) {
  const message = getErrorMessage(error, "");
  return /abort|aborted|signal|failed to fetch|network|load failed/i.test(message);
}

function friendlyAuthError(error: unknown) {
  const message = getErrorMessage(error);

  if (isAbortLikeError(message)) {
    return "Conexão interrompida. Toque em ACESSAR MINHA CONTA novamente.";
  }

  return message;
}

async function retryQuery<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isAbortLikeError(error) || attempt === 2) throw error;
      await sleep(450 + attempt * 350);
    }
  }

  throw lastError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<FetchProfileResult> => {
    try {
      let profileResponse: any = null;
      let roleResponse: any = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        profileResponse = await retryQuery(() => supabase.from("profiles").select("*").eq("id", userId).maybeSingle());

        if (!profileResponse.error || !isAbortLikeError(profileResponse.error) || attempt === 2) break;
        await sleep(450 + attempt * 350);
      }

      const profile = profileResponse?.data;
      const profileError = profileResponse?.error;

      if (profileError) {
        console.error("fetchProfile profile error:", profileError);
        if (!isAbortLikeError(profileError)) {
          setUser(null);
          setRole(null);
        }
        return { profile: null, role: null, error: friendlyAuthError(profileError) };
      }

      if (!profile) {
        setUser(null);
        setRole(null);
        return { profile: null, role: null, error: "Perfil do usuário não encontrado." };
      }

      // If user is archived, force logout
      if (profile.status === "archived") {
        setUser(null);
        setRole(null);
        await supabase.auth.signOut({ scope: "local" });
        return { profile: null, role: null, error: "Seu acesso está arquivado. Entre em contato com o suporte." };
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        roleResponse = await retryQuery(() => supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle());

        if (!roleResponse.error || !isAbortLikeError(roleResponse.error) || attempt === 2) break;
        await sleep(450 + attempt * 350);
      }

      const roleData = roleResponse?.data;
      const roleError = roleResponse?.error;

      if (roleError) {
        console.warn("fetchProfile role warning:", roleError);
      }

      const nextProfile = profile as unknown as Profile;
      const nextRole = (roleData?.role as UserRole) || "client";
      setUser(nextProfile);
      setRole(nextRole);
      return { profile: nextProfile, role: nextRole, error: null };
    } catch (err) {
      console.error("fetchProfile error:", err);
      if (!isAbortLikeError(err)) {
        setUser(null);
        setRole(null);
      }
      return {
        profile: null,
        role: null,
        error: friendlyAuthError(err),
      };
    }
  };

  const refreshProfile = async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      await fetchProfile(authUser.id);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialLoad = true;

    // Listener for ONGOING auth changes (does NOT control loading after init)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        // No evento SIGNED_IN, o próprio login já carrega o perfil.
        // Isso evita duas consultas ao mesmo tempo e evita erro de signal abortado em alguns PWAs.
        if (event === "SIGNED_IN") return;

        setTimeout(() => {
          fetchProfile(session.user.id).then(() => {
            if (isMounted && !initialLoad) {
              setLoading(false);
            }
          });
        }, 0);
      } else {
        setUser(null);
        setRole(null);
        if (!initialLoad) setLoading(false);
      }
    });

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.error("initializeAuth error:", err);
      } finally {
        if (isMounted) {
          initialLoad = false;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithRetry = async (email: string, password: string) => {
    let lastResult: any = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await supabase.auth.signInWithPassword({ email, password });
        lastResult = result;

        if (result.error && isAbortLikeError(result.error) && attempt < 2) {
          await sleep(500 + attempt * 400);
          continue;
        }

        return result;
      } catch (error) {
        lastError = error;
        if (!isAbortLikeError(error) || attempt === 2) throw error;
        await sleep(500 + attempt * 400);
      }
    }

    if (lastResult) return lastResult;
    throw lastError;
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true);
    setUser(null);
    setRole(null);

    try {
      const { data, error } = await signInWithRetry(email, password);
      if (error) {
        setLoading(false);
        return { error: friendlyAuthError(error), profile: null, role: null };
      }

      if (!data.session?.user) {
        setLoading(false);
        return { error: "Sessão não iniciada. Tente novamente.", profile: null, role: null };
      }

      const profileResult = await fetchProfile(data.session.user.id);
      setLoading(false);

      if (!profileResult.profile) {
        if (!isAbortLikeError(profileResult.error)) {
          await supabase.auth.signOut({ scope: "local" });
        }
        return {
          error: profileResult.error || "Login realizado, mas o perfil não foi carregado.",
          profile: null,
          role: null,
        };
      }

      // Log login event with device info (fire-and-forget)
      try {
        const ua = navigator.userAgent;
        const deviceType = /Mobile|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
        const browser = /Firefox/i.test(ua)
          ? "Firefox"
          : /Edg/i.test(ua)
            ? "Edge"
            : /Chrome/i.test(ua)
              ? "Chrome"
              : /Safari/i.test(ua)
                ? "Safari"
                : "Outro";
        const os = /Android/i.test(ua)
          ? "Android"
          : /iPhone|iPad|Mac/i.test(ua)
            ? "iOS/macOS"
            : /Windows/i.test(ua)
              ? "Windows"
              : /Linux/i.test(ua)
                ? "Linux"
                : "Outro";
        supabase
          .from("login_logs")
          .insert({
            user_id: data.session.user.id,
            user_agent: ua,
            device_type: deviceType,
            browser,
            os,
          })
          .then(() => {});
      } catch {}

      return { error: null, profile: profileResult.profile, role: profileResult.role || "client" };
    } catch (err) {
      setLoading(false);
      return { error: friendlyAuthError(err), profile: null, role: null };
    }
  };

  const logout = async () => {
    setUser(null);
    setRole(null);
    setLoading(false);
    await supabase.auth.signOut({ scope: "local" });
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, isAdmin: role === "admin", refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
