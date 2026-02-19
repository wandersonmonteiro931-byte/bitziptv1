import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Smartphone, Monitor, Bell, Clock, User, Search } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface LoginLog {
  id: string;
  user_id: string;
  logged_in_at: string;
  user_agent: string;
  device_type: string;
  browser: string;
  os: string;
  profile?: { name: string; username: string } | null;
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  created_at: string;
  profile?: { name: string; username: string } | null;
}

const AdminReportsPage = () => {
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [pushSubs, setPushSubs] = useState<PushSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [logsRes, pushRes, profilesRes] = await Promise.all([
        supabase
          .from("login_logs")
          .select("*")
          .order("logged_in_at", { ascending: false })
          .limit(200),
        supabase
          .from("push_subscriptions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, name, username"),
      ]);

      const profileMap = new Map<string, { name: string; username: string }>();
      (profilesRes.data || []).forEach((p: any) => profileMap.set(p.id, { name: p.name, username: p.username }));

      const logs = (logsRes.data || []).map((l: any) => ({
        ...l,
        profile: profileMap.get(l.user_id) || null,
      }));
      const subs = (pushRes.data || []).map((s: any) => ({
        ...s,
        profile: profileMap.get(s.user_id) || null,
      }));

      setLoginLogs(logs);
      setPushSubs(subs);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredLogs = loginLogs.filter(
    (l) =>
      !search ||
      l.profile?.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.profile?.username?.toLowerCase().includes(search.toLowerCase()) ||
      l.device_type?.toLowerCase().includes(search.toLowerCase()) ||
      l.browser?.toLowerCase().includes(search.toLowerCase()) ||
      l.os?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSubs = pushSubs.filter(
    (s) =>
      !search ||
      s.profile?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.profile?.username?.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const uniqueDevices = new Set(loginLogs.map((l) => `${l.user_id}-${l.device_type}-${l.browser}-${l.os}`)).size;
  const mobileLogins = loginLogs.filter((l) => l.device_type === "mobile").length;
  const desktopLogins = loginLogs.filter((l) => l.device_type === "desktop").length;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <BarChart3 className="text-primary" /> Relatórios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logins, dispositivos e notificações push
        </p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{loginLogs.length}</p>
          <p className="text-xs text-muted-foreground">Total de Logins</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{uniqueDevices}</p>
          <p className="text-xs text-muted-foreground">Dispositivos Únicos</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Smartphone size={16} className="text-blue-400" />
            <p className="text-2xl font-bold text-blue-400">{mobileLogins}</p>
          </div>
          <p className="text-xs text-muted-foreground">Mobile</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <Bell size={16} className="text-yellow-400" />
            <p className="text-2xl font-bold text-yellow-400">{pushSubs.length}</p>
          </div>
          <p className="text-xs text-muted-foreground">Push Ativados</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, usuário, dispositivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="logins">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="logins" className="flex-1 gap-1">
            <Clock size={14} /> Logins ({filteredLogs.length})
          </TabsTrigger>
          <TabsTrigger value="push" className="flex-1 gap-1">
            <Bell size={14} /> Push ({filteredSubs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logins">
          {loading ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Nenhum login registrado ainda.</div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className="glass-card flex items-center gap-3 rounded-xl p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {log.device_type === "mobile" ? (
                      <Smartphone size={18} className="text-primary" />
                    ) : (
                      <Monitor size={18} className="text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {log.profile?.name || log.profile?.username || "—"}
                      </p>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {log.os}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.browser} • {log.device_type === "mobile" ? "Celular" : "Desktop"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(log.logged_in_at), "dd/MM/yy")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(log.logged_in_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="push">
          {loading ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filteredSubs.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Nenhuma inscrição push encontrada.</div>
          ) : (
            <div className="space-y-2">
              {filteredSubs.map((sub) => (
                <div key={sub.id} className="glass-card flex items-center gap-3 rounded-xl p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Bell size={18} className="text-yellow-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {sub.profile?.name || sub.profile?.username || "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{sub.profile?.username || "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-foreground">
                      {format(new Date(sub.created_at), "dd/MM/yy")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(sub.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default AdminReportsPage;
