import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare const __BUILD_TIMESTAMP__: number;

const PWA_RESCUE_DONE_KEY = "wmcflix_pwa_rescue_v1_done";
const PWA_LAST_BUILD_KEY = "wmcflix_pwa_last_build";
const PWA_AUTO_UPDATE_ATTEMPT_KEY = "wmcflix_pwa_auto_update_attempt";
const CURRENT_BUILD_ID = String(__BUILD_TIMESTAMP__ || Date.now());

async function clearAllBrowserCaches() {
  if (!("caches" in window)) return;

  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

async function updateOrResetServiceWorkers(unregister = false) {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map(async (registration) => {
      try {
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        registration.installing?.postMessage({ type: "SKIP_WAITING" });
        registration.active?.postMessage({ type: "SKIP_WAITING" });
        await registration.update();

        if (unregister) {
          await registration.unregister();
        }
      } catch {
        // Continua com os outros registros.
      }
    }),
  );
}

function reloadWithCacheBuster(reason: string) {
  if (sessionStorage.getItem(`wmcflix_${reason}_reload_done`) === "1") return;

  sessionStorage.setItem(`wmcflix_${reason}_reload_done`, "1");
  const url = new URL(window.location.href);
  url.searchParams.set(reason, String(Date.now()));
  window.location.replace(url.toString());
}

async function checkRemoteBuildAndAutoUpdate() {
  if (typeof window === "undefined") return;

  try {
    const response = await fetch(`/version.json?auto_update=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) return;

    const remote = await response.json();
    const remoteBuild = String(remote.buildId || remote.buildTimestamp || remote.version || "");
    if (!remoteBuild || remoteBuild === CURRENT_BUILD_ID) return;

    const attemptedForBuild = sessionStorage.getItem(PWA_AUTO_UPDATE_ATTEMPT_KEY);
    if (attemptedForBuild === remoteBuild) return;

    sessionStorage.setItem(PWA_AUTO_UPDATE_ATTEMPT_KEY, remoteBuild);

    await clearAllBrowserCaches();
    await updateOrResetServiceWorkers(true);

    reloadWithCacheBuster("pwa_auto_update");
  } catch {
    // Se falhar, o modal/botão manual ainda continua funcionando.
  }
}

async function rescueOldInstalledPwa() {
  if (typeof window === "undefined") return;

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const alreadyRescued = localStorage.getItem(PWA_RESCUE_DONE_KEY) === "1";
  const lastBuild = localStorage.getItem(PWA_LAST_BUILD_KEY);

  localStorage.setItem(PWA_LAST_BUILD_KEY, CURRENT_BUILD_ID);

  const needsRescue = isStandalone && !alreadyRescued;
  const buildChanged = Boolean(lastBuild && lastBuild !== CURRENT_BUILD_ID);

  if (!needsRescue && !buildChanged) return;

  localStorage.setItem(PWA_RESCUE_DONE_KEY, "1");

  try {
    await clearAllBrowserCaches();
    await updateOrResetServiceWorkers(false);
  } catch {
    // Continua para reload.
  }

  reloadWithCacheBuster("pwa_rescue");
}

void checkRemoteBuildAndAutoUpdate();
void rescueOldInstalledPwa();

// Helper: check if the event target is an editable field
function isEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

// Allow copy, paste, cut everywhere (no blocking)
// Context menu is still blocked for non-editable areas

// Block context menu (right-click)
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Block print screen / screen recording attempts
document.addEventListener("keydown", (e) => {
  if (e.key === "PrintScreen") e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && e.key === "p") e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S")) e.preventDefault();
  // Ctrl+C/X/V allowed everywhere for copy/paste
});

// CSS-based screenshot protection on game pages
const style = document.createElement("style");
style.textContent = `
  @media print { body { display: none !important; } }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(<App />);
