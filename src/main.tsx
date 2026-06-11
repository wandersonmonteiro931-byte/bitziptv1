import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare const __BUILD_TIMESTAMP__: number;

const PWA_RESCUE_DONE_KEY = "wmcflix_pwa_rescue_v1_done";
const PWA_LAST_BUILD_KEY = "wmcflix_pwa_last_build";
const CURRENT_BUILD_ID = String(__BUILD_TIMESTAMP__ || Date.now());

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
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          try {
            await registration.update();
          } catch {}
        }),
      );
    }
  } catch {}

  if (!sessionStorage.getItem("wmcflix_pwa_rescue_reload_done")) {
    sessionStorage.setItem("wmcflix_pwa_rescue_reload_done", "1");
    const url = new URL(window.location.href);
    url.searchParams.set("pwa_rescue", String(Date.now()));
    window.location.replace(url.toString());
  }
}

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
