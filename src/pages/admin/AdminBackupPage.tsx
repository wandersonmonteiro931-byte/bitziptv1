import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Database, Download, FileJson, FolderDown, Loader2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";

type BackupTable = {
  name: string;
  label: string;
  priority?: boolean;
};

type TableResult = {
  table: string;
  label: string;
  success: boolean;
  count: number;
  rows: unknown[];
  error?: string;
};

type StorageResult = {
  bucket: string;
  success: boolean;
  count: number;
  files: unknown[];
  error?: string;
};

const PAGE_SIZE = 1000;

const BACKUP_TABLES: BackupTable[] = [
  { name: "profiles", label: "Clientes / usuários", priority: true },
  { name: "user_roles", label: "Permissões / administradores", priority: true },
  { name: "iptv_servers", label: "Servidores IPTV", priority: true },
  { name: "iptv_tv_apps", label: "Aplicativos de TV", priority: true },
  { name: "iptv_payments", label: "Pagamentos / faturas IPTV", priority: true },
  { name: "iptv_scheduled_rates", label: "Reajustes programados", priority: true },
  { name: "billing_due_dates", label: "Datas de vencimento", priority: true },
  { name: "iptv_cancellation_requests", label: "Pedidos de cancelamento", priority: true },
  { name: "iptv_trust_requests", label: "Pedidos de confiança", priority: true },
  { name: "platform_settings", label: "Configurações da plataforma", priority: true },
  { name: "support_settings", label: "Configurações de suporte", priority: true },
  { name: "custom_variables", label: "Variáveis personalizadas", priority: true },
  { name: "banners", label: "Banners", priority: true },
  { name: "announcements", label: "Avisos", priority: true },
  { name: "notification_rules", label: "Regras de notificação", priority: true },
  { name: "scheduled_notifications", label: "Notificações agendadas", priority: true },
  { name: "push_notifications", label: "Histórico de push", priority: true },
  { name: "tv_channels", label: "Canais ao vivo", priority: true },
  { name: "tv_programs", label: "Programação TV", priority: true },
  { name: "login_logs", label: "Histórico de login", priority: true },
  { name: "admin_audit_logs", label: "Histórico administrativo", priority: true },
  { name: "balance_history", label: "Histórico de saldo" },
  { name: "withdrawals", label: "Saques" },
  { name: "referrals", label: "Indicações" },
  { name: "missions", label: "Missões" },
  { name: "mission_completions", label: "Missões concluídas" },
  { name: "content", label: "Conteúdo" },
  { name: "credit_settings", label: "Configurações de créditos" },
  { name: "credit_packages", label: "Pacotes de créditos" },
  { name: "credit_promotions", label: "Promoções de créditos" },
  { name: "credit_purchases", label: "Compras de créditos" },
  { name: "credit_transactions", label: "Transações de créditos" },
  { name: "credit_challenges", label: "Desafios de créditos" },
  { name: "challenge_attempts", label: "Tentativas de desafios" },
  { name: "credit_rankings", label: "Rankings de créditos" },
  { name: "game_overrides", label: "Ajustes de jogos" },
  { name: "game_memory_sessions", label: "Sessões jogo memória" },
  { name: "game_memory_settings", label: "Configurações jogo memória" },
  { name: "announcement_dismissals", label: "Avisos dispensados" },
  { name: "notification_views", label: "Visualizações de notificações" },
  { name: "push_subscriptions", label: "Inscrições push" },
  { name: "push_vapid_keys", label: "Chaves VAPID push" },
];

const STORAGE_BUCKETS = ["banners", "tv-logos"];

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function nowForFile() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function fetchTableRows(table: BackupTable, onProgress?: (message: string) => void): Promise<TableResult> {
  const rows: unknown[] = [];
  let from = 0;
  let page = 1;

  try {
    while (true) {
      onProgress?.(`Exportando ${table.label} - página ${page}`);

      const { data, error } = await (supabase as any)
        .from(table.name)
        .select("*")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return {
          table: table.name,
          label: table.label,
          success: false,
          count: rows.length,
          rows,
          error: error.message || "Erro ao consultar tabela",
        };
      }

      const pageRows = Array.isArray(data) ? data : [];
      rows.push(...pageRows);

      if (pageRows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
      page += 1;
    }

    return {
      table: table.name,
      label: table.label,
      success: true,
      count: rows.length,
      rows,
    };
  } catch (error) {
    return {
      table: table.name,
      label: table.label,
      success: false,
      count: rows.length,
      rows,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isProbablyFolder(item: any) {
  return !item?.id && !item?.updated_at && !item?.created_at;
}

async function listBucketFiles(bucket: string, prefix = "", files: unknown[] = []): Promise<unknown[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) throw error;

  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;

    if (isProbablyFolder(item)) {
      await listBucketFiles(bucket, path, files);
      continue;
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    files.push({
      bucket,
      path,
      name: item.name,
      id: item.id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      last_accessed_at: item.last_accessed_at,
      metadata: item.metadata,
      publicUrl: publicData.publicUrl,
    });
  }

  return files;
}

async function fetchStorageBucket(bucket: string, onProgress?: (message: string) => void): Promise<StorageResult> {
  try {
    onProgress?.(`Listando arquivos do Storage: ${bucket}`);
    const files = await listBucketFiles(bucket);
    return {
      bucket,
      success: true,
      count: files.length,
      files,
    };
  } catch (error) {
    return {
      bucket,
      success: false,
      count: 0,
      files: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const AdminBackupPage = () => {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<TableResult[]>([]);
  const [storageResults, setStorageResults] = useState<StorageResult[]>([]);

  const summary = useMemo(() => {
    const ok = results.filter((item) => item.success).length;
    const error = results.filter((item) => !item.success).length;
    const totalRows = results.reduce((sum, item) => sum + item.count, 0);
    const storageFiles = storageResults.reduce((sum, item) => sum + item.count, 0);
    return { ok, error, totalRows, storageFiles };
  }, [results, storageResults]);

  const exportSingleTable = async (table: BackupTable) => {
    if (running) return;
    setRunning(true);
    setProgress(`Preparando exportação de ${table.label}`);

    const result = await fetchTableRows(table, setProgress);
    setResults((current) => [result, ...current.filter((item) => item.table !== table.name)]);
    setRunning(false);
    setProgress("");

    if (!result.success) {
      toast({
        title: "Não foi possível exportar",
        description: `${table.label}: ${result.error}`,
        variant: "destructive",
      });
      return;
    }

    downloadJson(`backup-${sanitizeFilePart(table.name)}-${nowForFile()}.json`, {
      exportedAt: new Date().toISOString(),
      table: table.name,
      label: table.label,
      count: result.count,
      rows: result.rows,
    });

    toast({
      title: "Backup gerado",
      description: `${table.label}: ${result.count} registros baixados.`,
    });
  };

  const exportCompleteBackup = async () => {
    if (running) return;

    setRunning(true);
    setResults([]);
    setStorageResults([]);

    const tableResults: TableResult[] = [];
    const bucketResults: StorageResult[] = [];

    for (const table of BACKUP_TABLES) {
      const result = await fetchTableRows(table, setProgress);
      tableResults.push(result);
      setResults([...tableResults]);
    }

    for (const bucket of STORAGE_BUCKETS) {
      const result = await fetchStorageBucket(bucket, setProgress);
      bucketResults.push(result);
      setStorageResults([...bucketResults]);
    }

    const payload = {
      backupName: "BITZIPTV1_WMCFLIX_LOVABLE_SUPABASE_BACKUP",
      exportedAt: new Date().toISOString(),
      exportedFrom: window.location.origin,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      importantNotice: {
        authUsers:
          "O Supabase não permite exportar senhas reais nem a tabela auth.users pelo navegador. Este backup salva os dados que o painel admin consegue ler pelo app atual.",
        storage:
          "Arquivos do Storage são salvos como lista com URL pública. Os arquivos físicos serão migrados depois usando essas URLs, quando disponível.",
      },
      tables: tableResults.reduce<Record<string, unknown>>((acc, item) => {
        acc[item.table] = {
          label: item.label,
          success: item.success,
          count: item.count,
          error: item.error || null,
          rows: item.rows,
        };
        return acc;
      }, {}),
      storage: bucketResults.reduce<Record<string, unknown>>((acc, item) => {
        acc[item.bucket] = {
          success: item.success,
          count: item.count,
          error: item.error || null,
          files: item.files,
        };
        return acc;
      }, {}),
      errors: [
        ...tableResults.filter((item) => !item.success).map((item) => ({ type: "table", name: item.table, label: item.label, error: item.error })),
        ...bucketResults.filter((item) => !item.success).map((item) => ({ type: "storage", name: item.bucket, error: item.error })),
      ],
    };

    downloadJson(`backup-completo-bitziptv1-lovable-${nowForFile()}.json`, payload);

    setRunning(false);
    setProgress("");

    const failedCount = tableResults.filter((item) => !item.success).length + bucketResults.filter((item) => !item.success).length;
    toast({
      title: failedCount ? "Backup gerado com avisos" : "Backup completo gerado",
      description: failedCount
        ? `Arquivo baixado. ${failedCount} item(ns) não puderam ser lidos por permissão/RLS.`
        : "Arquivo JSON baixado com sucesso.",
      variant: failedCount ? "destructive" : "default",
    });
  };

  const exportStorageManifest = async () => {
    if (running) return;
    setRunning(true);
    setStorageResults([]);

    const bucketResults: StorageResult[] = [];
    for (const bucket of STORAGE_BUCKETS) {
      const result = await fetchStorageBucket(bucket, setProgress);
      bucketResults.push(result);
      setStorageResults([...bucketResults]);
    }

    downloadJson(`backup-storage-bitziptv1-${nowForFile()}.json`, {
      exportedAt: new Date().toISOString(),
      buckets: bucketResults,
    });

    setRunning(false);
    setProgress("");

    toast({
      title: "Lista do Storage gerada",
      description: `${bucketResults.reduce((sum, item) => sum + item.count, 0)} arquivo(s) encontrados.`,
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              Backup <span className="text-red-500">Lovable/Supabase</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Exporte o máximo possível do banco atual antes de migrar para Cloudflare + Supabase próprio.
            </p>
          </div>

          <button
            onClick={exportCompleteBackup}
            disabled={running}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Exportar backup completo
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-500/10 p-2 text-red-500"><Database className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Tabelas</p>
                <p className="text-xl font-bold text-foreground">{BACKUP_TABLES.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-500/10 p-2 text-green-500"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Lidas com sucesso</p>
                <p className="text-xl font-bold text-foreground">{summary.ok}</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-yellow-500/10 p-2 text-yellow-500"><FileJson className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Registros</p>
                <p className="text-xl font-bold text-foreground">{summary.totalRows}</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500"><FolderDown className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Arquivos Storage</p>
                <p className="text-xl font-bold text-foreground">{summary.storageFiles}</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
            <div>
              <p className="font-bold text-yellow-300">Importante antes da migração</p>
              <p className="mt-1 text-yellow-100/80">
                Este backup usa o acesso do painel admin atual. Senhas reais e usuários internos do Supabase Auth não são exportados pelo navegador.
                O que estiver bloqueado por permissão/RLS aparecerá com aviso no arquivo JSON.
              </p>
            </div>
          </div>
        </div>

        {running && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-red-400" />
              <div>
                <p className="font-bold">Exportando dados...</p>
                <p className="text-red-100/75">{progress || "Aguarde sem fechar esta tela."}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Tabelas para exportar</h2>
                <p className="text-xs text-muted-foreground">Use o backup completo, ou baixe uma tabela individual para teste.</p>
              </div>
            </div>

            <div className="space-y-2">
              {BACKUP_TABLES.map((table) => {
                const result = results.find((item) => item.table === table.name);
                return (
                  <div key={table.name} className="flex flex-col gap-3 rounded-xl border border-border bg-black/25 p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{table.label}</p>
                        {table.priority && <span className="rounded-full border border-red-500/30 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">Principal</span>}
                        {result?.success && <span className="rounded-full border border-green-500/30 px-2 py-0.5 text-[10px] font-bold text-green-400">{result.count} registros</span>}
                        {result && !result.success && <span className="rounded-full border border-yellow-500/30 px-2 py-0.5 text-[10px] font-bold text-yellow-400">Aviso</span>}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">{table.name}</p>
                      {result && !result.success && <p className="mt-1 text-xs text-yellow-300">{result.error}</p>}
                    </div>
                    <button
                      onClick={() => exportSingleTable(table)}
                      disabled={running}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-500/25 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      Baixar JSON
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-lg font-bold text-foreground">Storage</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Salva uma lista dos arquivos públicos usados em banners e logos. Os arquivos físicos serão baixados/migrados depois pela URL pública.
              </p>
              <button
                onClick={exportStorageManifest}
                disabled={running}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 px-4 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <FolderDown className="h-5 w-5" />}
                Baixar lista do Storage
              </button>

              <div className="mt-4 space-y-2">
                {STORAGE_BUCKETS.map((bucket) => {
                  const result = storageResults.find((item) => item.bucket === bucket);
                  return (
                    <div key={bucket} className="rounded-xl border border-border bg-black/25 p-3">
                      <p className="font-mono text-xs text-foreground">{bucket}</p>
                      {result?.success && <p className="mt-1 text-xs text-green-400">{result.count} arquivo(s) encontrados</p>}
                      {result && !result.success && <p className="mt-1 text-xs text-yellow-300">{result.error}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
                <div className="text-sm">
                  <p className="font-bold text-foreground">Depois de baixar</p>
                  <p className="mt-1 text-muted-foreground">
                    Guarde o arquivo <span className="font-mono text-red-300">backup-completo-bitziptv1-lovable.json</span> e me envie ele na próxima etapa para montar o Supabase novo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminBackupPage;
