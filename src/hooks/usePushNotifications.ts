import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const PUSH_VAPID_KEY_STORAGE = "wmcflix_push_vapid_key";
const PUSH_ENDPOINT_STORAGE = "wmcflix_push_endpoint";

export function usePushNotifications(userId: string | undefined) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    let cancelled = false;

    const setupPush = async () => {
      if (cancelled || runningRef.current) return;

      runningRef.current = true;

      try {
        const registration =
          (await navigator.serviceWorker.getRegistration("/")) ||
          (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

        await registration.update().catch(() => undefined);
        await navigator.serviceWorker.ready;

        const { data: vapidData, error: vapidError } = await supabase.functions.invoke("push-notification", {
          body: { action: "get_vapid_public_key" },
        });

        if (vapidError || !vapidData?.public_key) {
          console.error("[Push] Failed to get VAPID key:", vapidError);
          return;
        }

        const serverVapidKey = String(vapidData.public_key);
        const applicationServerKey = urlBase64ToUint8Array(serverVapidKey);

        let subscription = await registration.pushManager.getSubscription();
        const storedVapid = localStorage.getItem(PUSH_VAPID_KEY_STORAGE);

        // Se a chave mudou ou o navegador rotacionou a inscrição, refaz.
        if (subscription && storedVapid && storedVapid !== serverVapidKey) {
          try {
            await subscription.unsubscribe();
          } catch {}
          subscription = null;
        }

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
          });
        }

        const subJson = subscription.toJSON();
        const endpoint = subJson.endpoint || "";

        if (!endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
          console.error("[Push] Subscription incompleta");
          return;
        }

        localStorage.setItem(PUSH_VAPID_KEY_STORAGE, serverVapidKey);
        localStorage.setItem(PUSH_ENDPOINT_STORAGE, endpoint);

        // Atualiza no servidor sempre que abrir/voltar online.
        // Assim o push chega mesmo com PWA fechado, porque o servidor terá endpoint atual.
        const { error: subscribeError } = await supabase.functions.invoke("push-notification", {
          body: {
            action: "subscribe",
            endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
        });

        if (subscribeError) {
          console.error("[Push] Server subscribe error:", subscribeError);
          return;
        }

        console.log("[Push] Web Push inscrito/atualizado com sucesso");
      } catch (err) {
        console.error("[Push] Setup error:", err);
      } finally {
        runningRef.current = false;
      }
    };

    void setupPush();

    const onControllerChange = () => void setupPush();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [userId]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
