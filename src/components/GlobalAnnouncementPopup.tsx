import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getFhdImageUrl, preloadFhdImage } from "@/lib/imageQuality";

interface AnnouncementData {
  id: string;
  title: string;
  body: string;
  bannerUrl?: string;
  displayFrequency: "always" | "once";
  updatedAt?: string;
}

// Memória viva da aba: não zera ao trocar de seção/rota.
// Só zera quando o app/site é realmente recarregado.
const dismissedUntilReload = new Set<string>();
let firstLoadExecuted = false;
let sessionUserId: string | null = null;

export function GlobalAnnouncementPopup() {
  const { user, isAdmin } = useAuth();
  const [popup, setPopup] = useState<AnnouncementData | null>(null);
  const popupRef = useRef<AnnouncementData | null>(null);
  const queueRef = useRef<AnnouncementData[]>([]);
  const loadingRef = useRef(false);

  popupRef.current = popup;

  const preloadImage = useCallback((src: string, timeoutMs = 1200) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      img.onload = done;
      img.onerror = done;
      img.src = src;
      setTimeout(done, timeoutMs);
    });
  }, []);

  const showNextFromQueue = useCallback(() => {
    const next = queueRef.current.find((item) => !dismissedUntilReload.has(item.id));

    if (!next) {
      setPopup(null);
      return;
    }

    queueRef.current = queueRef.current.filter((item) => item.id !== next.id);
    setPopup(next);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    if (!user?.id || isAdmin) return;
    if (loadingRef.current) return;
    if (popupRef.current) return;

    loadingRef.current = true;

    try {
      const now = new Date().toISOString();

      const { data: announcements, error } = await supabase
        .from("announcements")
        .select(
          "id, title, body, banner_url, announcement_type, target_type, target_ids, schedule_at, expires_at, display_frequency, updated_at, created_at",
        )
        .eq("is_active", true)
        .or(`schedule_at.is.null,schedule_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false });

      if (error || !announcements || announcements.length === 0) return;

      const { data: dismissed } = await supabase
        .from("announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id);

      const dismissedIds = new Set((dismissed || []).map((d: any) => d.announcement_id));
      const validAnnouncements: AnnouncementData[] = [];

      for (const a of announcements as any[]) {
        const displayFrequency = (a.display_frequency || "once") as "always" | "once";

        // REGRA:
        // Depois de clicar "Entendi", não aparece novamente ao trocar de seção.
        // Só volta a aparecer em recarregamento real do app/site.
        if (dismissedUntilReload.has(a.id)) continue;

        // "Uma vez": respeita dismissão salva no banco.
        // "Sempre": ignora dismissão do banco, mas respeita a memória da aba até recarregar.
        if (displayFrequency !== "always" && dismissedIds.has(a.id)) continue;

        if (a.target_type === "specific" && !(a.target_ids || []).includes(user.id)) continue;

        const bannerUrl = a.announcement_type === "banner" && a.banner_url ? a.banner_url : undefined;
        if (bannerUrl) await preloadFhdImage(bannerUrl, 700);

        validAnnouncements.push({
          id: a.id,
          title: a.title || "",
          body: a.body || "",
          bannerUrl,
          displayFrequency,
          updatedAt: a.updated_at,
        });
      }

      queueRef.current = validAnnouncements;
      showNextFromQueue();
    } finally {
      loadingRef.current = false;
    }
  }, [user?.id, isAdmin, preloadImage, showNextFromQueue]);

  useEffect(() => {
    if (!user?.id || isAdmin) return;

    // Se trocar de usuário na mesma aba, reinicia o ciclo.
    if (sessionUserId !== user.id) {
      sessionUserId = user.id;
      firstLoadExecuted = false;
      dismissedUntilReload.clear();
      queueRef.current = [];
      setPopup(null);
    }

    // Só carrega avisos quando o app abre/recarrega pela primeira vez.
    // Trocar de seção pode remontar layout, mas não deve reabrir aviso.
    if (!firstLoadExecuted) {
      firstLoadExecuted = true;
      loadAnnouncements();
    }

    const channel = supabase
      .channel(`global-announcements-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        // Não abre automaticamente. Novo aviso aparece somente no próximo reload.
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAnnouncements, user?.id, isAdmin]);

  const dismiss = async () => {
    if (popup && user?.id) {
      dismissedUntilReload.add(popup.id);

      if (popup.displayFrequency !== "always") {
        await supabase.from("announcement_dismissals").insert({
          announcement_id: popup.id,
          user_id: user.id,
        });
      }
    }

    setPopup(null);
    setTimeout(() => showNextFromQueue(), 180);
  };

  if (isAdmin || !popup) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={popup.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full max-w-[94vw] rounded-3xl border border-border bg-card p-4 shadow-2xl sm:max-w-md sm:p-6"
        >
          {popup.bannerUrl && (
            <div className="mb-4 flex max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-2xl bg-black/20">
              <img
                src={getFhdImageUrl(popup.bannerUrl)}
                alt={popup.title || "Aviso"}
                className="h-auto max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
              />
            </div>
          )}

          {popup.title && <h3 className="mb-2 text-lg font-bold text-foreground">{popup.title}</h3>}

          {popup.body && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{popup.body}</p>
          )}

          <button
            onClick={dismiss}
            className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            Entendi
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
