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
  iptv_client_code: string;
  iptv_password: string;
  admin_notes: string;
  admin_notes_urgent: boolean;
}

interface AuthContextType {
  user: Profile | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const [{ data: profile }, { data: roleData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      if (profile) {
        setUser(profile as Profile);
      }
      setRole((roleData?.role as UserRole) || "client");
    } catch (err) {
      console.error("fetchProfile error:", err);
      setRole("client");
    }
  };

  const refreshProfile = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await fetchProfile(authUser.id);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let initialLoad = true;

    // Listener for ONGOING auth changes (does NOT control loading after init)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          // Dispatch after callback completes to avoid deadlock
          setTimeout(() => {
            fetchProfile(session.user.id).then(() => {
              if (isMounted && !initialLoad) {
                // only needed for subsequent changes, not initial
              }
            });
          }, 0);
        } else {
          setUser(null);
          setRole(null);
          if (!initialLoad) setLoading(false);
        }
      }
    );

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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

  const login = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    // Immediately fetch profile instead of relying on onAuthStateChange
    if (data.session?.user) {
      await fetchProfile(data.session.user.id);
    }
    return null;
  };

  const logout = async () => {
    setUser(null);
    setRole(null);
    setLoading(false);
    await supabase.auth.signOut({ scope: 'local' });
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
