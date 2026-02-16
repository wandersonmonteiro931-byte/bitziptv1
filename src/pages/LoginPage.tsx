import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-bitz.jpg";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn } from "lucide-react";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (login(username, password)) {
      const user = JSON.parse(localStorage.getItem("bitz_user") || "{}");
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } else {
      setError("Usuário ou senha inválidos");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 flex flex-col items-center">
            <img src={logo} alt="Bitz IPTV" className="mb-4 h-20 w-20 rounded-2xl object-cover shadow-lg" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">BITZ IPTV</h1>
            <p className="mt-1 text-sm text-muted-foreground">Plataforma de Fidelidade</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Usuário IPTV</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Digite seu usuário"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Digite sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <LogIn size={18} />
              Entrar
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Acesso exclusivo para clientes Bitz IPTV
          </p>

          <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80 mb-1">Demo:</p>
            <p>Admin: admin / admin123</p>
            <p>Cliente: cliente1 / 123456</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
