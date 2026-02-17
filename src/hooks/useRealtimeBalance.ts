import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribes to realtime changes on the user's profile (balance/credits updates)
 * and triggers a profile refresh automatically.
 */
export function useRealtimeBalance() {
  const { user, refreshProfile } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`balance-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          refreshProfile();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "balance_history",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Just trigger a refresh — the profile UPDATE handler shows the toast
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
