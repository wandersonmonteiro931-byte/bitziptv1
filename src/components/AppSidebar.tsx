import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-bitz.jpg";
import {
  LayoutDashboard, Target, Users, Wallet, History, Tv, Settings, LogOut,
  Shield, Gift, Megaphone, BarChart3, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const clientLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/missions", label: "Missões", icon: Target },
  { to: "/referrals", label: "Indicações", icon: Users },
  { to: "/withdrawals", label: "Saques", icon: Wallet },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/iptv-info", label: "Meu IPTV", icon: Tv },
];

const adminLinks = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/users", label: "Usuários", icon: Users },
  { to: "/admin/missions", label: "Missões", icon: Target },
  { to: "/admin/withdrawals", label: "Saques", icon: Wallet },
  { to: "/admin/referrals", label: "Indicações", icon: Gift },
  { to: "/admin/content", label: "Conteúdo", icon: Megaphone },
  { to: "/admin/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/admin/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const links = isAdmin ? adminLinks : clientLinks;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-card p-2 text-foreground md:hidden"
        aria-label="Toggle menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <img src={logo} alt="Bitz IPTV" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <h2 className="font-display text-sm font-bold tracking-wider text-foreground">BITZ IPTV</h2>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? (
                <span className="flex items-center gap-1"><Shield size={10} /> Admin</span>
              ) : "Fidelidade"}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {links.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/15 text-primary glow-border"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <link.icon size={18} />
                    {link.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">@{user?.username}</p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
