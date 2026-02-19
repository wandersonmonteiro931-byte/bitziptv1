import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-bitz.jpg";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, User, Loader2, MessageCircle, Shield, AlertTriangle } from "lucide-react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 120;

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [supportLink, setSupportLink] = useState("https://wa.me/5562995657915");
  const { login, isAdmin, user } = useAuth();
  const navigate = useNavigate();

  // Fetch support link
  useEffect(() => {
    supabase.from("support_settings").select("whatsapp_link").limit(1).single()
      .then(({ data }) => { if (data?.whatsapp_link) setSupportLink(data.whatsapp_link); });
  }, []);

  // Lockout timer
  useEffect(() => {
    if (!lockoutEnd) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockoutEnd(null);
        setAttempts(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd]);

  const isLockedOut = lockoutEnd !== null && Date.now() < lockoutEnd;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || submitting) return;
    setError("");
    setSubmitting(true);

    try {
      // Try login with @iptv.bitz first, then fallback to @bitziptv.local for legacy users
      const emailValue = username.includes("@") ? username : `${username}@iptv.bitz`;
      let err = await login(emailValue, password);
      
      // Fallback for legacy accounts
      if (err && !username.includes("@")) {
        err = await login(`${username}@bitziptv.local`, password);
      }

      if (err) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutEnd(Date.now() + LOCKOUT_SECONDS * 1000);
          setError(`Muitas tentativas. Aguarde ${LOCKOUT_SECONDS}s.`);
        } else if (err.toLowerCase().includes("invalid")) {
          setError("Usuário ou senha inválidos.");
        } else {
          setError("Usuário ou senha inválidos.");
        }
        setSubmitting(false);
        return;
      }
      // Success — useEffect handles redirect, but add safety timeout
      setTimeout(() => setSubmitting(false), 8000);
    } catch {
      setError("Erro ao conectar. Tente novamente.");
      setSubmitting(false);
    }
  }, [username, password, attempts, isLockedOut, submitting, login]);

  // Redirect when authenticated
  useEffect(() => {
    if (user) {
      if (user.status === "blocked") {
        setError("Seu acesso está bloqueado. Entre em contato com o suporte.");
        setSubmitting(false);
        return;
      }
      if (user.status === "pending") {
        setError("Seu pagamento foi identificado. Aguarde liberação do sistema.");
        setSubmitting(false);
        return;
      }
      navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
    }
  }, [user, isAdmin, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a1a] p-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          className="mb-8 flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="relative mb-4">
            <div className="absolute -inset-2 animate-pulse rounded-2xl bg-primary/20 blur-xl" />
            <img src={logo} alt="Bitz IPTV" className="relative h-20 w-20 rounded-2xl object-cover shadow-2xl ring-2 ring-primary/30" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-widest text-white">BITZ IPTV</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plataforma Oficial de Fidelidade</p>
        </motion.div>

        {/* Login card */}
        <motion.div
          className="rounded-2xl border border-white/5 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <div className="mb-6 flex items-center justify-center gap-2 text-center">
            <Lock size={16} className="text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Área de Login Oficial</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <User size={13} /> Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                placeholder="Digite seu usuário"
                required
                disabled={isLockedOut}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Lock size={13} /> Senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 pr-12 text-sm text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                  placeholder="Digite sua senha"
                  required
                  disabled={isLockedOut}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lockout warning */}
            <AnimatePresence>
              {isLockedOut && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3"
                >
                  <Shield size={16} className="text-yellow-400" />
                  <p className="text-sm text-yellow-400">Bloqueado por {lockoutRemaining}s</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || isLockedOut}
              className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-4 font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:opacity-40"
            >
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              {submitting ? <Loader2 size={20} className="animate-spin" /> : <Lock size={18} />}
              {submitting ? "Autenticando..." : "ACESSAR MINHA CONTA"}
            </button>
          </form>

          {/* Info text */}
          <p className="mt-5 text-center text-xs text-white/30">
            Acesso exclusivo para clientes cadastrados.
          </p>
        </motion.div>

        {/* Support section */}
        <motion.div
          className="mt-6 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-xs text-white/30">Não possui acesso?</p>
          <a
            href={supportLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-[0.97]"
          >
            <MessageCircle size={16} className="text-green-400" />
            Falar com Suporte
          </a>

          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-white/15">
            <Shield size={10} />
            <span>Conexão segura • Bitz IPTV © 2026</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
