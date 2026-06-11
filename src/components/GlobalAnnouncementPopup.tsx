import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AnnouncementData {
  id: string;
  title: string;
  body: string;
  bannerUrl?: string;
  displayFrequency: "always" | "once";
}

export function GlobalAnnouncementPopup() {
  const { user, isAdmin } = useAuth();
  const [popup, setPopup] = useState<AnnouncementData | null>(null);
  const popupRef = useRef(popup);
  const dismissedThisLoadRef = useRef<Set<string>>(new Set());
  popupRef.current = popup;

  const preloadImage = useCallback((src: string, timeoutMs = 1200) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      const done = () => resolve();
      img.onload = done;
      img.onerror = done;
      img.src = src;
      setTimeout(done, timeoutMs);
    });
  }, []);

  const loadAnnouncements = useCallback(async () => {
    if (!user?.id || isAdmin) return;
    if (popupRef.current) return;

    const { data: announcementsRaw } = await supabase
      .from("announcements")
      .select(
        "id, title, body, banner_url, announcement_type, target_type, target_ids, schedule_at, expires_at, display_frequency" as any,
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    const announcements = (announcementsRaw || []) as any[];
    if (announcements.length === 0) return;

    const { data: dismissed } = await supabase
      .from("announcement_dismissals")
      .select("announcement_id")
      .eq("user_id", user.id);
    const dismissedIds = new Set((dismissed || []).map((d: any) => d.announcement_id));

    for (const a of announcements) {
      const displayFrequency = (a.display_frequency || "once") as "always" | "once";

      // "Sempre ao entrar": aparece a cada nova abertura/reload do app, mas não reabre na mesma tela após clicar Entendi.
      if (dismissedThisLoadRef.current.has(a.id)) continue;

      // "Uma vez": depois que o cliente clicar Entendi, não aparece mais até o admin resetar visualizações.
      if (displayFrequency !== "always" && dismissedIds.has(a.id)) continue;

      if (a.schedule_at && new Date(a.schedule_at) > new Date()) continue;
      if (a.expires_at && new Date(a.expires_at) < new Date()) continue;
      if (a.target_type === "specific" && !(a.target_ids || []).includes(user.id)) continue;

      const bannerUrl = a.announcement_type === "banner" && a.banner_url ? a.banner_url : undefined;

      if (bannerUrl) {
        await preloadImage(bannerUrl);
      }

      setPopup({ id: a.id, title: a.title, body: a.body || "", bannerUrl, displayFrequency });
      break;
    }
  }, [user?.id, isAdmin, preloadImage]);

  useEffect(() => {
    if (!user?.id || isAdmin) return;

    loadAnnouncements();

    const channel = supabase
      .channel("global-announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        loadAnnouncements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAnnouncements, user?.id, isAdmin]);

  const dismiss = async () => {
    if (popup && user?.id) {
      dismissedThisLoadRef.current.add(popup.id);

      if (popup.displayFrequency !== "always") {
        await supabase.from("announcement_dismissals").insert({
          announcement_id: popup.id,
          user_id: user.id,
        });
      }
    }

    setPopup(null);
    setTimeout(() => loadAnnouncements(), 500);
  };

  if (isAdmin || !popup) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm px-5"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl"
        >
          {popup.bannerUrl && (
            <img
              src={popup.bannerUrl}
              alt={popup.title}
              className="mb-4 h-auto max-h-[70vh] w-auto max-w-full rounded-2xl object-contain mx-auto"
            />
          )}
          {popup.title && <h3 className="text-lg font-bold text-foreground mb-2">{popup.title}</h3>}
          {popup.body && (
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{popup.body}</p>
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
