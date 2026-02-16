import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const balance = Number(user?.balance || 0);
  const canWithdraw = balance >= 30;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Top bar with balance — client only */}
      {!isAdmin && (
        <div className="fixed right-0 top-0 z-30 flex items-center gap-2 p-3 md:pr-6">
          <button
            onClick={() => canWithdraw && navigate("/withdrawals")}
            disabled={!canWithdraw}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wallet size={14} />
            Saque
          </button>
          <div className="flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-2 text-sm font-bold text-foreground">
            💰 R$ {balance.toFixed(2)}
          </div>
        </div>
      )}

      <main className="md:ml-64">
        <div className="p-4 pt-16 md:p-8 md:pt-8">{children}</div>
      </main>
    </div>
  );
}
