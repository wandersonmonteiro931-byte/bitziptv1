import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications(userId: string | undefined) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!userId || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const setup = async () => {
      try {
        // Register push service worker
        const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;

        // Request notification permission immediately
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("Push notification permission denied");
          return;
        }

        // Get VAPID public key
        const { data: vapidData, error: vapidError } = await supabase.functions.invoke("push-notification", {
          body: { action: "get_vapid_public_key" },
        });
        if (vapidError || !vapidData?.public_key) {
          console.error("Failed to get VAPID key:", vapidError);
          return;
        }

        // Convert VAPID key to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(vapidData.public_key);

        // Check existing subscription — unsubscribe if VAPID key changed
        let subscription = await (registration as any).pushManager.getSubscription();

        if (subscription) {
          // Always unsubscribe old and create new to ensure VAPID key match
          await subscription.unsubscribe();
          subscription = null;
        }

        subscription = await (registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

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
