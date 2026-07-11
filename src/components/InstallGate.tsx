import { useEffect } from "react";

const isComputerBrowser = () => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isIpadOSDesktopMode = /Macintosh/i.test(ua) && maxTouchPoints > 1;
  const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isDesktopPlatform = /Win32|Win64|Windows|MacIntel|MacPPC|Mac68K|Linux x86_64|Linux i686/i.test(platform);
  const isDesktopUserAgent = /Windows NT|Macintosh|X11|CrOS|Linux x86_64|Linux i686/i.test(ua);

  return !isIpadOSDesktopMode && !isMobileOrTablet && (isDesktopPlatform || isDesktopUserAgent);
};

const isInstalledPwa = () => {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export const InstallGate = ({ children }: { children: React.ReactNode }) => {
  const accessAllowed = isInstalledPwa() || isComputerBrowser();

  useEffect(() => {
    if (accessAllowed) return;

    // No navegador móvel existe somente uma tela de instalação.
    // A confirmação nativa do PWA é aberta diretamente em /app/install/.
    window.location.replace("/app/install/");
  }, [accessAllowed]);

  if (accessAllowed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
      <div>
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold">Abrindo a instalação do WMCPLAYER...</p>
      </div>
    </div>
  );
};
