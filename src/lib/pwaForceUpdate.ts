type RemoteVersionPayload = {
  buildTimestamp?: number;
  buildId?: string;
  version?: string;
  appName?: string;
};

export type ForcePwaUpdateResult = {
  remoteBuild: string | null;
  deletedCaches: number;
  updatedRegistrations: number;
  hadWaitingWorker: boolean;
};

const UPDATE_HANDLED_KEY = "wmcflix_pwa_update_handled_build";
const UPDATE_LOCK_UNTIL_KEY = "wmcflix_pwa_update_lock_until";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildReloadUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("pwa_update", String(Date.now()));
  url.searchParams.set("force_update", "1");
  return url.toString();
};

async function fetchRemoteVersion() {
  try {
    const response = await fetch(`/version.json?force_update=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as RemoteVersionPayload;
    return String(data.buildId || data.buildTimestamp || data.version || "");
  } catch {
    return null;
  }
}

async function clearAllCaches() {
  if (!("caches" in window)) return 0;

  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  return keys.length;
}

async function forceServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) {
    return { updatedRegistrations: 0, hadWaitingWorker: false };
  }

  let updatedRegistrations = 0;
  let hadWaitingWorker = false;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const registration of registrations) {
      try {
        await registration.update();
        updatedRegistrations += 1;
      } catch {
        // Continua nos outros registros.
      }

      if (registration.waiting) {
        hadWaitingWorker = true;
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      if (registration.installing) {
        registration.installing.postMessage({ type: "SKIP_WAITING" });
      }

      if (registration.active) {
        registration.active.postMessage({ type: "SKIP_WAITING" });
      }
    }

    // Dá tempo para o controllerchange acontecer quando existe SW aguardando.
    await sleep(550);
  } catch {
    // Sem permissão/sem SW: segue para cache/reload.
  }

  return { updatedRegistrations, hadWaitingWorker };
}

export async function forcePwaUpdateAndReload() {
  if (typeof window === "undefined") return null;

  sessionStorage.removeItem(UPDATE_HANDLED_KEY);
  sessionStorage.removeItem(UPDATE_LOCK_UNTIL_KEY);

  const [remoteBuild, swResult] = await Promise.all([
    fetchRemoteVersion(),
    forceServiceWorkerUpdate(),
  ]);

  const deletedCaches = await clearAllCaches();

  try {
    const registrations = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    for (const registration of registrations) {
      // Se o navegador insistir em usar SW antigo, desregistra.
      // No próximo carregamento o VitePWA registra o SW novo.
      await registration.unregister().catch(() => false);
    }
  } catch {
    // Mesmo se falhar, o reload com cache-buster busca os arquivos novos.
  }

  const result: ForcePwaUpdateResult = {
    remoteBuild,
    deletedCaches,
    updatedRegistrations: swResult.updatedRegistrations,
    hadWaitingWorker: swResult.hadWaitingWorker,
  };

  window.location.replace(buildReloadUrl());
  return result;
}
