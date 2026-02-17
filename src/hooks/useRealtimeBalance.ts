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
  const prevCredits = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    prevBalance.current = Number(user.balance);
    prevCredits.current = Number((user as any).credits ?? 0);
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
          const newCredits = Number(payload.new.credits ?? 0);
          const oldBalance = prevBalance.current ?? Number(user.balance);
          const oldCredits = prevCredits.current ?? Number((user as any).credits ?? 0);
          const balanceDiff = newBalance - oldBalance;
          const creditsDiff = newCredits - oldCredits;

          if (balanceDiff !== 0) {
            const sign = balanceDiff > 0 ? "+" : "";
            toast({
              title: `${sign} R$ ${Math.abs(balanceDiff).toFixed(2)} ${balanceDiff > 0 ? "adicionados" : "removidos"} do seu saldo`,
              description: `Saldo atual: R$ ${newBalance.toFixed(2)}`,
            });
          }

          if (creditsDiff !== 0 && balanceDiff === 0) {
            const sign = creditsDiff > 0 ? "+" : "";
            toast({
              title: `${sign}${creditsDiff} 💎 créditos`,
              description: `Créditos atuais: ${newCredits} 💎`,
            });
          }

          prevBalance.current = newBalance;
          prevCredits.current = newCredits;
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
