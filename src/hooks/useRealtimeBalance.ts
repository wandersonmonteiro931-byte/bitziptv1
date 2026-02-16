import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Subscribes to realtime changes on the user's profile (balance updates)
 * and balance_history (new transactions). Shows animated toast on changes.
 */
export function useRealtimeBalance() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const prevBalance = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    prevBalance.current = Number(user.balance);
  }, [user?.id]);

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
        (payload) => {
          const newBalance = Number(payload.new.balance);
          const oldBalance = prevBalance.current ?? Number(user.balance);
          const diff = newBalance - oldBalance;

          if (diff !== 0) {
            const sign = diff > 0 ? "+" : "";
            toast({
              title: `${sign} R$ ${Math.abs(diff).toFixed(2)} ${diff > 0 ? "adicionados" : "removidos"} do seu saldo`,
              description: `Saldo atual: R$ ${newBalance.toFixed(2)}`,
            });
          }

          prevBalance.current = newBalance;
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
