import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const APP_REALTIME_PREFIXES = [
  "wmcplayer-client-",
  "wmcplayer-admin",
  "wmcplayer-finance-",
  "wmcplayer-client-profile-",
  "wmcplayer-pix-payment-",
  "wmcplayer-credit-pix-",
  "wmcplayer-renewal-plans-push",
  "wmcplayer-admin-finance",
  "global-announcements-realtime-",
  "referrals-",
  "admin-referrals-realtime",
  "tv-realtime",
];

const dispatchAppEvent = (name: string, payload: any) => {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail: payload }));
  } catch {
    // Evento local opcional.
  }
};

/**
 * Mantém somente um canal Realtime aberto por sessão autenticada:
 * - cliente: wmcplayer-client-<id>
 * - admin:   wmcplayer-admin
 *
 * Não usa polling e não consulta banco ao receber ordens.
 */
export function useRealtimeBalance() {
  const { user, isAdmin, applyProfilePatch } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const channelName = isAdmin ? "wmcplayer-admin" : `wmcplayer-client-${user.id}`;

    const applyProfileCommand = (payload: any) => {
      if (!payload || (payload.user_id && payload.user_id !== user.id)) return;

      const patch: Record<string, any> = {
        ...(payload.profile_patch || payload.profile || {}),
      };

      // Pagamento recebido após teste: a ordem Realtime precisa tirar o cliente
      // imediatamente do estado de teste/bloqueado e colocá-lo no fluxo padrão.
      if (payload.action === "pix_payment_received" || payload.status === "paid_pending_activation") {
        patch.iptv_status = payload.iptv_status || "awaiting_activation";
        patch.trial_enabled = false;
        patch.trial_payment_confirmed = true;
        patch.trial_expired_at = null;
        patch.trial_expired_notice_sent_at = null;
      }

      if (payload.balance_after !== undefined) patch.balance = Number(payload.balance_after);
      if (payload.credits_after !== undefined) patch.credits = Number(payload.credits_after);
      if (payload.level_points_after !== undefined) patch.level_points = Number(payload.level_points_after);
      if (payload.user_level !== undefined) patch.user_level = payload.user_level;
      if (payload.vip_badge !== undefined) patch.vip_badge = Boolean(payload.vip_badge);

      if (Object.keys(patch).length > 0) applyProfilePatch(patch);
    };

    const receiveCommand = (message: any) => {
      if (!active) return;

      const eventName = String(message?.event || message?.payload?.event || "command");
      const payload = message?.payload ?? message;

      if (!isAdmin && payload?.user_id && payload.user_id !== user.id) return;

      if (eventName === "finance-updated" || eventName === "client-profile-updated") {
        applyProfileCommand(payload);
      }

      dispatchAppEvent("wmcplayer-realtime-command", { event: eventName, payload });

      switch (eventName) {
        case "finance-updated":
          dispatchAppEvent("wmcplayer-finance-updated", payload);
          break;
        case "client-profile-updated":
          dispatchAppEvent("wmcplayer-client-profile-update", payload);
          break;
        case "renewal-plans-updated":
          dispatchAppEvent("wmcplayer-renewal-plans-updated", payload);
          break;
        case "announcement-updated":
          dispatchAppEvent("wmcplayer-announcement-updated", payload);
          break;
        case "referrals-updated":
          dispatchAppEvent("wmcplayer-referrals-updated", payload);
          break;
        case "tv-guide-updated":
          dispatchAppEvent("wmcplayer-tv-guide-updated", payload);
          break;
        case "trust-request-created":
        case "admin-refresh":
          dispatchAppEvent("wmcplayer-admin-refresh", payload);
          break;
        default:
          break;
      }
    };

    const startSingleChannel = async () => {
      const oldChannels = supabase.getChannels().filter((existing) => {
        const topic = String((existing as any)?.topic || "").replace(/^realtime:/, "");
        return APP_REALTIME_PREFIXES.some((prefix) => topic.startsWith(prefix));
      });

      await Promise.all(oldChannels.map((existing) => supabase.removeChannel(existing)));
      if (!active) return;

      channel = supabase
        .channel(channelName)
        .on("broadcast", { event: "*" }, receiveCommand)
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn(`[Realtime] Falha no canal único ${channelName}:`, error || status);
          }
        });
    };

    void startSingleChannel();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, applyProfilePatch]);
}
