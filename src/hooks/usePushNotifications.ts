import { useEffect, useRef } from "react";
import {
  enablePushNotifications,
  isPushNotificationSupported,
  PUSH_DISABLED_STORAGE,
} from "@/lib/pushNotifications";

export function usePushNotifications(userId: string | undefined) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (!isPushNotificationSupported()) return;
    if (localStorage.getItem(PUSH_DISABLED_STORAGE) === "1") return;
    if (Notification.permission !== "granted") return;

    let cancelled = false;

    const setupPush = async () => {
      if (cancelled || runningRef.current) return;
      runningRef.current = true;

      try {
        await enablePushNotifications({
          userId,
          requestPermission: false,
        });
      } catch (error) {
        console.error("[Push] Não foi possível confirmar a inscrição:", error);
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
