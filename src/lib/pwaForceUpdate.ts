export type ForcePwaUpdateResult = {
  updatedRegistrations: number;
  hadWaitingWorker: boolean;
};

const waitForState = (worker: ServiceWorker, desired: ServiceWorkerState, timeoutMs = 8000) =>
  new Promise<void>((resolve) => {
    if (worker.state === desired || worker.state === "activated") {
      resolve();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (worker.state === desired || worker.state === "activated" || worker.state === "redundant") finish();
    };

    worker.addEventListener("statechange", onStateChange);
    window.setTimeout(finish, timeoutMs);
  });

export async function forcePwaUpdateAndReload(): Promise<ForcePwaUpdateResult | null> {
  if (typeof window === "undefined") return null;

  let updatedRegistrations = 0;
  let hadWaitingWorker = false;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    for (const registration of registrations) {
      try {
        await registration.update();
        updatedRegistrations += 1;

        if (registration.installing) {
          await waitForState(registration.installing, "installed");
        }

        const waiting = registration.waiting;
        if (waiting) {
          hadWaitingWorker = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch (error) {
        console.error("Falha ao verificar atualização do PWA:", error);
      }
    }
  }

  // A atualização manual nunca apaga caches nem desregistra o aplicativo.
  window.setTimeout(() => window.location.reload(), hadWaitingWorker ? 1200 : 250);

  return { updatedRegistrations, hadWaitingWorker };
}
