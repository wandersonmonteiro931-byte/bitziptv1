import { supabase } from "@/integrations/supabase/client";

export const PUSH_VAPID_KEY_STORAGE = "wmcflix_push_vapid_key";
export const PUSH_ENDPOINT_STORAGE = "wmcflix_push_endpoint";
export const PUSH_DISABLED_STORAGE = "wmcplayer_push_disabled_by_user";
export const PUSH_STATE_CHANGED_EVENT = "wmcplayer-push-state-changed";

export type PushNotificationState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  disabledByUser: boolean;
  subscribed: boolean;
  enabled: boolean;
};

type EnablePushOptions = {
  userId?: string;
  requestPermission?: boolean;
  forceServerSync?: boolean;
};

let inFlightEnable: Promise<PushNotificationState> | null = null;
let lastServerSyncedUserId = "";

export const isPushNotificationSupported = () =>
  typeof window !== "undefined" &&
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

const dispatchPushStateChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PUSH_STATE_CHANGED_EVENT));
  }
};

async function getAppServiceWorkerRegistration() {
  const current =
    (await navigator.serviceWorker.getRegistration("/app/")) ||
    (await navigator.serviceWorker.getRegistration());

  if (current) return current;

  return navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });
}

export async function getPushNotificationState(): Promise<PushNotificationState> {
  if (!isPushNotificationSupported()) {
    return {
      supported: false,
      permission: "unsupported",
      disabledByUser: false,
      subscribed: false,
      enabled: false,
    };
  }

  const disabledByUser = localStorage.getItem(PUSH_DISABLED_STORAGE) === "1";
  const permission = Notification.permission;

  if (permission !== "granted") {
    return {
      supported: true,
      permission,
      disabledByUser,
      subscribed: false,
      enabled: false,
    };
  }

  const registration = await getAppServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const subscribed = Boolean(subscription);

  return {
    supported: true,
    permission,
    disabledByUser,
    subscribed,
    enabled: subscribed && !disabledByUser,
  };
}

export async function enablePushNotifications(
  options: EnablePushOptions = {},
): Promise<PushNotificationState> {
  if (inFlightEnable) return inFlightEnable;

  inFlightEnable = (async () => {
    if (!isPushNotificationSupported()) {
      throw new Error("Este aparelho ou navegador não oferece suporte a notificações push.");
    }

    localStorage.removeItem(PUSH_DISABLED_STORAGE);

    let permission = Notification.permission;
    if (permission !== "granted" && options.requestPermission !== false) {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      dispatchPushStateChanged();
      throw new Error(
        permission === "denied"
          ? "As notificações estão bloqueadas nas configurações do aparelho."
          : "A permissão de notificações não foi concedida.",
      );
    }

    const registration = await getAppServiceWorkerRegistration();
    await registration.update().catch(() => undefined);
    await navigator.serviceWorker.ready;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authenticatedUserId = session?.user?.id || "";
    const requestedUserId = options.userId || authenticatedUserId;

    // Antes do login, a permissão do Android já pode ser concedida.
    // A inscrição completa no servidor é concluída imediatamente após o login.
    if (!session?.access_token || !requestedUserId || authenticatedUserId !== requestedUserId) {
      dispatchPushStateChanged();
      return {
        supported: true,
        permission: "granted",
        disabledByUser: false,
        subscribed: Boolean(await registration.pushManager.getSubscription()),
        enabled: true,
      };
    }

    const authHeaders = { Authorization: `Bearer ${session.access_token}` };
    const existingSubscription = await registration.pushManager.getSubscription();

    // Se já existe inscrição e ela já foi sincronizada nesta sessão, evita
    // repetir chamadas ao servidor a cada troca de página.
    if (
      existingSubscription &&
      lastServerSyncedUserId === requestedUserId &&
      options.forceServerSync !== true
    ) {
      localStorage.setItem(PUSH_ENDPOINT_STORAGE, existingSubscription.endpoint);
      dispatchPushStateChanged();
      return {
        supported: true,
        permission: "granted",
        disabledByUser: false,
        subscribed: true,
        enabled: true,
      };
    }

    const { data: vapidData, error: vapidError } = await supabase.functions.invoke(
      "push-notification",
      {
        body: { action: "get_vapid_public_key" },
        headers: authHeaders,
      },
    );

    if (vapidError || !vapidData?.public_key) {
      throw new Error("Não foi possível obter a chave de notificações do servidor.");
    }

    const serverVapidKey = String(vapidData.public_key);
    const applicationServerKey = urlBase64ToUint8Array(serverVapidKey);
    const storedVapidKey = localStorage.getItem(PUSH_VAPID_KEY_STORAGE);
    let subscription = existingSubscription;

    if (subscription && storedVapidKey && storedVapidKey !== serverVapidKey) {
      await subscription.unsubscribe().catch(() => undefined);
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscriptionJson.endpoint || subscription.endpoint;
    const p256dh = subscriptionJson.keys?.p256dh;
    const auth = subscriptionJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      throw new Error("A inscrição de notificações ficou incompleta.");
    }

    const { error: subscribeError } = await supabase.functions.invoke("push-notification", {
      body: {
        action: "subscribe",
        endpoint,
        p256dh,
        auth,
      },
      headers: authHeaders,
    });

    if (subscribeError) {
      throw new Error("Não foi possível registrar as notificações no servidor.");
    }

    localStorage.setItem(PUSH_VAPID_KEY_STORAGE, serverVapidKey);
    localStorage.setItem(PUSH_ENDPOINT_STORAGE, endpoint);
    localStorage.removeItem(PUSH_DISABLED_STORAGE);
    lastServerSyncedUserId = requestedUserId;
    dispatchPushStateChanged();

    return {
      supported: true,
      permission: "granted",
      disabledByUser: false,
      subscribed: true,
      enabled: true,
    };
  })();

  try {
    return await inFlightEnable;
  } finally {
    inFlightEnable = null;
  }
}

export async function disablePushNotifications(): Promise<PushNotificationState> {
  if (!isPushNotificationSupported()) {
    return getPushNotificationState();
  }

  localStorage.setItem(PUSH_DISABLED_STORAGE, "1");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const registration = await getAppServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  const endpoint = subscription?.endpoint || localStorage.getItem(PUSH_ENDPOINT_STORAGE) || "";

  if (endpoint && session?.access_token) {
    await supabase.functions
      .invoke("push-notification", {
        body: { action: "unsubscribe", endpoint },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      .catch(() => undefined);
  }

  if (subscription) {
    await subscription.unsubscribe().catch(() => undefined);
  }

  localStorage.removeItem(PUSH_VAPID_KEY_STORAGE);
  localStorage.removeItem(PUSH_ENDPOINT_STORAGE);
  lastServerSyncedUserId = "";
  dispatchPushStateChanged();

  return getPushNotificationState();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}
