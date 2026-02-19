import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications(userId: string | undefined) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const setup = async () => {
      try {
        // Register push service worker
        const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        // Get VAPID public key from server
        const { data: vapidData, error: vapidError } = await supabase.functions.invoke("push-notification", {
          body: { action: "get_vapid_public_key" },
        });
        if (vapidError || !vapidData?.public_key) {
          console.error("Failed to get VAPID key:", vapidError);
          return;
        }

        const serverVapidKey = vapidData.public_key;
        const applicationServerKey = urlBase64ToUint8Array(serverVapidKey);

        // Check existing subscription
        let subscription = await (registration as any).pushManager.getSubscription();

        // Compare stored VAPID key — if different, must resubscribe
        const storedVapid = localStorage.getItem("push_vapid_key");
        if (subscription && storedVapid !== serverVapidKey) {
          try { await subscription.unsubscribe(); } catch {}
          subscription = null;
        }

        if (!subscription) {
          subscription = await (registration as any).pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        }

        // Save VAPID key used for this subscription
        localStorage.setItem("push_vapid_key", serverVapidKey);

        // Send subscription to server
        const subJson = subscription.toJSON();
        await supabase.functions.invoke("push-notification", {
          body: {
            action: "subscribe",
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        });

        subscribedRef.current = true;
        console.log("Push notifications subscribed successfully");
      } catch (err) {
        console.error("Push notification setup error:", err);
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(setup, 2000);
    return () => clearTimeout(timer);
  }, [userId]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
