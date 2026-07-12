declare const __BUILD_TIMESTAMP__: number;

export const APP_UPDATE_CHECK_EVENT = "wmcplayer-check-app-update";

export type PublishedAppVersion = {
  buildId?: string;
  buildTimestamp?: number;
  version?: string;
  appName?: string;
  displayVersionSource?: string;
};

export type AppUpdateCheckResult = {
  currentBuildId: string;
  publishedBuildId: string;
  updateAvailable: boolean;
  published: PublishedAppVersion;
};

export const getLocalBuildId = () =>
  String(typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : "development");

export async function fetchPublishedAppVersion(): Promise<PublishedAppVersion> {
  const response = await fetch(`/app/version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });

  if (!response.ok) {
    throw new Error(`Não foi possível consultar a versão publicada (${response.status}).`);
  }

  const published = (await response.json()) as PublishedAppVersion;
  const publishedBuildId = String(
    published.buildId || published.buildTimestamp || published.version || "",
  ).trim();

  if (!publishedBuildId) {
    throw new Error("A versão publicada não foi identificada.");
  }

  return published;
}

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (import.meta.env.DEV) {
    const local = getLocalBuildId();
    return {
      currentBuildId: local,
      publishedBuildId: local,
      updateAvailable: false,
      published: {
        buildId: local,
        version: local,
        appName: "WMCPLAYER",
        displayVersionSource: "development",
      },
    };
  }

  const published = await fetchPublishedAppVersion();
  const publishedBuildId = String(
    published.buildId || published.buildTimestamp || published.version,
  );
  const currentBuildId = getLocalBuildId();

  return {
    currentBuildId,
    publishedBuildId,
    updateAvailable: publishedBuildId !== currentBuildId,
    published,
  };
}
