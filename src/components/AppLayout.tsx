import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, LayoutDashboard, Target, Users, History, Tv, Menu, X, Shield, Settings, LogOut, Gift, Megaphone, BarChart3 } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-bitz.jpg";

const clientLinks = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
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
  { to: "/admin/settings", label: "Config", icon: Settings },
];

// Bottom nav: show first 4 + "Menu" for the rest
const clientBottomNav = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/missions", label: "Missões", icon: Target },
  { to: "/referrals", label: "Indicar", icon: Users },
  { to: "/withdrawals", label: "Saques", icon: Wallet },
];

const clientMenuLinks = [
  { to: "/history", label: "Histórico", icon: History },
  { to: "/iptv-info", label: "Meu IPTV", icon: Tv },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const balance = Number(user?.balance || 0);
  const isFrozen = user?.balance_frozen;
  const canWithdraw = balance >= 30 && !isFrozen;
  const links = isAdmin ? adminLinks : clientLinks;

  return (
    <div className="min-h-screen bg-background">
      {/* === TOP HEADER BAR === */}
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border bg-sidebar px-3 py-2.5 md:left-64">
        {/* Mobile: Logo + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <img src={logo} alt="Bitz IPTV" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-display text-xs font-bold tracking-wider text-foreground">BITZ IPTV</span>
        </div>
        {/* Desktop: greeting */}
        <div className="hidden md:block">
          <p className="text-sm text-muted-foreground">
            {isAdmin ? (
              <span className="flex items-center gap-1"><Shield size={12} /> Administrador</span>
            ) : (
              <>Olá, <span className="font-semibold text-foreground">{user?.name?.split(" ")[0]}</span></>
            )}
          </p>
        </div>

        {/* Right side: Saque button + Balance */}
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => canWithdraw && navigate("/withdrawals")}
              disabled={!canWithdraw}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-md transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wallet size={13} />
              Saque
            </button>
            <div className="flex items-center gap-1 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-bold text-foreground">
              💰 R$&nbsp;{balance.toFixed(2)}
            </div>
          </div>
        )}
        {isAdmin && (
          <div className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">
            <Shield size={13} /> Admin
          </div>
        )}
      </header>

      {/* === DESKTOP SIDEBAR === */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <img src={logo} alt="Bitz IPTV" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <h2 className="font-display text-sm font-bold tracking-wider text-foreground">BITZ IPTV</h2>
            <p className="text-xs text-muted-foreground">{isAdmin ? "Administração" : "Fidelidade"}</p>
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
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>

      {/* === MOBILE BOTTOM NAV === */}
      {!isAdmin && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-sidebar md:hidden">
          <div className="flex items-stretch">
            {clientBottomNav.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <link.icon size={20} />
                  {link.label}
                </NavLink>
              );
            })}
            {/* Menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                menuOpen ? "text-primary" : "text-muted-foreground"
              )}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
              Menu
            </button>
          </div>
        </nav>
      )}

      {/* Admin mobile bottom nav */}
      {isAdmin && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-sidebar md:hidden">
          <div className="flex items-stretch overflow-x-auto">
            {adminLinks.slice(0, 4).map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <link.icon size={20} />
                  {link.label}
                </NavLink>
              );
            })}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                menuOpen ? "text-primary" : "text-muted-foreground"
              )}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
              Mais
            </button>
          </div>
        </nav>
      )}

      {/* === MOBILE MENU OVERLAY === */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden" onClick={() => setMenuOpen(false)} />
          <div className="fixed bottom-14 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-sidebar p-4 md:hidden">
            <div className="mb-3 rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">@{user?.username}</p>
            </div>
            <ul className="space-y-1">
              {(isAdmin ? adminLinks.slice(4) : clientMenuLinks).map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        isActive ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                    >
                      <link.icon size={18} />
                      {link.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </>
      )}

      {/* === MAIN CONTENT === */}
      <main className="pb-16 pt-14 md:ml-64 md:pb-0 md:pt-14">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
