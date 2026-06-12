export const FHD_IMAGE_WIDTH = 1920;
export const FHD_IMAGE_QUALITY = 100;

const fhdMemoryCache = new Set<string>();

export function getFhdImageUrl(url?: string | null, width = FHD_IMAGE_WIDTH): string {
  if (!url) return "";

  // Supabase render keeps the original format and returns a FHD optimized delivery URL.
  // quality=100 avoids visible compression loss.
  if (url.includes("/storage/v1/object/public/")) {
    const base = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}width=${width}&quality=${FHD_IMAGE_QUALITY}&format=origin`;
  }

  return url;
}

export function preloadFhdImage(url?: string | null, timeoutMs = 900): Promise<void> {
  const src = getFhdImageUrl(url);

  if (!src || fhdMemoryCache.has(src)) return Promise.resolve();

  return new Promise((resolve) => {
    const img = new Image();
    let finished = false;

    const done = () => {
      if (finished) return;
      finished = true;
      fhdMemoryCache.add(src);
      resolve();
    };

    img.onload = done;
    img.onerror = done;
    img.decoding = "async";
    img.src = src;

    if ("decode" in img) {
      img.decode().then(done).catch(() => {});
    }

    setTimeout(done, timeoutMs);
  });
}

export function preloadFhdImages(urls: Array<string | null | undefined>, timeoutMs = 900): Promise<void[]> {
  return Promise.all(urls.filter(Boolean).map((url) => preloadFhdImage(url, timeoutMs)));
}

export function createImageUploadOptions() {
  return {
    upsert: true,
    cacheControl: "31536000",
    contentType: undefined as string | undefined,
  };
}
