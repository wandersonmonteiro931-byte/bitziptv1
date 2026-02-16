import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Users, Search, MoreVertical, Plus, Shield, Ban, Eye } from "lucide-react";
import { useState } from "react";

const mockUsers = [
  { id: "2", name: "João Silva", username: "cliente1", balance: 45.5, status: "active" as const, referrals: 3, expiry: "2026-06-15" },
  { id: "3", name: "Maria Santos", username: "cliente2", balance: 12.0, status: "active" as const, referrals: 1, expiry: "2026-03-20" },
  { id: "4", name: "Carlos Oliveira", username: "cliente3", balance: 78.0, status: "active" as const, referrals: 5, expiry: "2026-08-01" },
  { id: "5", name: "Ana Costa", username: "cliente4", balance: 0, status: "suspended" as const, referrals: 0, expiry: "2025-12-10" },
  { id: "6", name: "Pedro Lima", username: "cliente5", balance: 22.5, status: "active" as const, referrals: 2, expiry: "2026-04-30" },
];

const statusBadge = {
  active: "bg-success/15 text-success",
  suspended: "bg-warning/15 text-warning",
  blocked: "bg-destructive/15 text-destructive",
};

const AdminUsersPage = () => {
  const [search, setSearch] = useState("");

  const filtered = mockUsers.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Users className="text-primary" /> Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{mockUsers.length} usuários cadastrados</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:brightness-110">
          <Plus size={16} /> Criar Usuário
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-muted/50 py-3 pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Buscar por nome ou usuário..."
        />
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Saldo</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Indicações</th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">R$ {user.balance.toFixed(2)}</td>
                  <td className="hidden px-4 py-3 text-foreground md:table-cell">{user.referrals}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[user.status]}`}>
                      {user.status === "active" ? "Ativo" : user.status === "suspended" ? "Suspenso" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Ver detalhes">
                        <Eye size={16} />
                      </button>
                      <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Admin">
                        <Shield size={16} />
                      </button>
                      <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Bloquear">
                        <Ban size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminUsersPage;
