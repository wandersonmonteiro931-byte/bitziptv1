import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Recebe ordens financeiras enviadas pelas Edge Functions via Supabase Broadcast.
 * Não faz polling e não consulta o banco ao receber uma atualização.
 */
export function useRealtimeBalance() {
  const { user, applyProfilePatch } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const applyCommand = (payload: any) => {
      if (!payload || (payload.user_id && payload.user_id !== user.id)) return;

      const patch: Record<string, any> = {
        ...(payload.profile_patch || payload.profile || {}),
      };

      if (payload.balance_after !== undefined) patch.balance = Number(payload.balance_after);
      if (payload.credits_after !== undefined) patch.credits = Number(payload.credits_after);
      if (payload.level_points_after !== undefined) patch.level_points = Number(payload.level_points_after);
      if (payload.user_level !== undefined) patch.user_level = payload.user_level;
      if (payload.vip_badge !== undefined) patch.vip_badge = Boolean(payload.vip_badge);

      if (Object.keys(patch).length > 0) applyProfilePatch(patch);
    };

    const financeChannel = supabase
      .channel(`wmcplayer-finance-${user.id}`)
      .on("broadcast", { event: "finance-updated" }, (event) => applyCommand((event as any)?.payload))
      .subscribe();

    const profileChannel = supabase
      .channel(`wmcplayer-client-profile-${user.id}`)
      .on("broadcast", { event: "client-profile-updated" }, (event) => applyCommand((event as any)?.payload))
      .subscribe();

    return () => {
      supabase.removeChannel(financeChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id, applyProfilePatch]);
}
