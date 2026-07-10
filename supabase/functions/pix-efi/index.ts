import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let _cachedPem: { cert: string; key: string } | null = null;

function normalizeCertificateBase64(value: string | null | undefined): string {
  if (!value) return "";

  let cleaned = String(value).trim();

  // Aceita valor colado com aspas, quebra de linha, prefixo data:, PEM ou \\n escapado.
  cleaned = cleaned.replace(/^["']|["']$/g, "");
  cleaned = cleaned.replace(/\\r/g, "");
  cleaned = cleaned.replace(/\\n/g, "");
  cleaned = cleaned.replace(/\r/g, "");
  cleaned = cleaned.replace(/\n/g, "");
  cleaned = cleaned.replace(/-----BEGIN[^-]+-----/g, "");
  cleaned = cleaned.replace(/-----END[^-]+-----/g, "");
  cleaned = cleaned.replace(/^data:[^,]+,/i, "");
  cleaned = cleaned.replace(/\s+/g, "");

  return cleaned;
}

function extractPemCredentialsFromBase64(rawValue: string, sourceName: string): { cert: string; key: string } {
  const b64 = normalizeCertificateBase64(rawValue);

  console.log(`Trying Efí certificate from ${sourceName}. Raw length: ${rawValue?.length || 0}. Clean length: ${b64.length}.`);

  if (b64.length < 1000) {
    throw new Error(`Certificado ${sourceName} muito curto ou incompleto.`);
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
    throw new Error(`Certificado ${sourceName} possui caracteres inválidos no Base64.`);
  }

  const derBytes = forge.util.decode64(b64);

  if (!derBytes || derBytes.length < 700) {
    throw new Error(`Certificado ${sourceName} decodificado ficou incompleto.`);
  }

  const asn1 = forge.asn1.fromDer(derBytes);
  const p12Password = Deno.env.get("EFI_CERTIFICATE_PASSWORD") || "";
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, p12Password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
  if (!certBag?.cert) throw new Error(`No certificate found in ${sourceName}`);

  const allCertBags = certBags[forge.pki.oids.certBag] || [];
  let fullCertChain = forge.pki.certificateToPem(certBag.cert);

  if (allCertBags.length > 1) {
    fullCertChain = allCertBags
      .filter((b: any) => b.cert)
      .map((b: any) => forge.pki.certificateToPem(b.cert))
      .join("\n");
    console.log(`Found ${allCertBags.length} certificates in chain`);
  }

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag?.key) throw new Error(`No private key found in ${sourceName}`);

  const rsaPrivateKey = forge.pki.privateKeyToAsn1(keyBag.key);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
  const key = forge.pki.privateKeyInfoToPem(privateKeyInfo);

  const certObj = certBag.cert;
  console.log("PEM extraction successful from:", sourceName);
  console.log("Cert subject:", certObj.subject.getField("CN")?.value || "unknown");
  console.log("Cert issuer:", certObj.issuer.getField("CN")?.value || "unknown");
  console.log("Cert valid from:", certObj.validity.notBefore.toISOString());
  console.log("Cert valid to:", certObj.validity.notAfter.toISOString());

  return { cert: fullCertChain, key };
}

function getPemCredentials(): { cert: string; key: string } {
  if (_cachedPem) return _cachedPem;

  const candidates = [
    { name: "EFI_CERTIFICATE_BASE64", value: Deno.env.get("EFI_CERTIFICATE_BASE64") },
    { name: "EFI_CERTIFICATE_BASE64_BACKUP", value: Deno.env.get("EFI_CERTIFICATE_BASE64_BACKUP") },
  ].filter((item) => Boolean(item.value));

  const errors: string[] = [];

  for (const item of candidates) {
    try {
      _cachedPem = extractPemCredentialsFromBase64(item.value || "", item.name);
      return _cachedPem;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Falha ao ler certificado ${item.name}:`, message);
      errors.push(`${item.name}: ${message}`);
    }
  }

  throw new Error(
    "Certificado PIX Efí inválido ou incompleto. Rode CONFIGURAR_PIX_E_FUNCOES_SUPABASE.bat novamente para reenviar o certificado correto. Detalhes: " +
      errors.join(" | "),
  );
}

// ── mTLS HTTP via Deno.connectTls ─────────────────────────────────────────

const EFI_BASE_URL = "https://pix.api.efipay.com.br";
const EFI_SANDBOX_URL = "https://pix-h.api.efipay.com.br";

function getBaseUrl(): string {
  const sandbox = Deno.env.get("EFI_SANDBOX") === "true";
  return sandbox ? EFI_SANDBOX_URL : EFI_BASE_URL;
}

function getHostname(): string {
  const sandbox = Deno.env.get("EFI_SANDBOX") === "true";
  return sandbox ? "pix-h.api.efipay.com.br" : "pix.api.efipay.com.br";
}

async function mtlsFetch(
  path: string,
  options: { method: string; headers?: Record<string, string>; body?: string }
): Promise<{ status: number; body: string }> {
  const { cert, key } = getPemCredentials();
  const hostname = getHostname();

  // Also get PKCS#1 key for compatibility
  const pkcs1Key = forge.pki.privateKeyToPem(forge.pki.privateKeyFromPem(key));
  
  // Try multiple TLS connection approaches
  const approaches = [
    { name: "cert/key (PKCS#8)", opts: { hostname, port: 443, cert, key } },
    { name: "cert/key (PKCS#1)", opts: { hostname, port: 443, cert, key: pkcs1Key } },
    { name: "certChain/privateKey (PKCS#8)", opts: { hostname, port: 443, certChain: cert, privateKey: key } },
    { name: "certChain/privateKey (PKCS#1)", opts: { hostname, port: 443, certChain: cert, privateKey: pkcs1Key } },
  ];

  let lastError: Error | null = null;

  for (const approach of approaches) {
    try {
      console.log(`Trying TLS approach: ${approach.name}`);
      const conn = await Deno.connectTls(approach.opts as any);
      
      try {
        const bodyBytes = options.body ? new TextEncoder().encode(options.body) : null;
        const hdrs: Record<string, string> = {
          Host: hostname,
          Connection: "close",
          ...options.headers,
        };
        if (bodyBytes) hdrs["Content-Length"] = String(bodyBytes.length);

        let request = `${options.method} ${path} HTTP/1.1\r\n`;
        for (const [k, v] of Object.entries(hdrs)) request += `${k}: ${v}\r\n`;
        request += "\r\n";

        await conn.write(new TextEncoder().encode(request));
        if (bodyBytes) await conn.write(bodyBytes);

        const chunks: Uint8Array[] = [];
        const buf = new Uint8Array(8192);
        while (true) {
          const n = await conn.read(buf);
          if (n === null) break;
          chunks.push(buf.slice(0, n));
        }

        const rawResponse = new TextDecoder().decode(
          chunks.reduce((acc, chunk) => {
            const merged = new Uint8Array(acc.length + chunk.length);
            merged.set(acc);
            merged.set(chunk, acc.length);
            return merged;
          }, new Uint8Array(0))
        );

        const headerEnd = rawResponse.indexOf("\r\n\r\n");
        if (headerEnd === -1) throw new Error("No HTTP response received");
        
        const statusLine = rawResponse.substring(0, rawResponse.indexOf("\r\n"));
        const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 0;
        let responseBody = rawResponse.substring(headerEnd + 4);

        if (rawResponse.substring(0, headerEnd).toLowerCase().includes("transfer-encoding: chunked")) {
          responseBody = decodeChunked(responseBody);
        }

        console.log(`TLS approach "${approach.name}" succeeded! Status: ${status}`);
        return { status, body: responseBody };
      } finally {
        try { conn.close(); } catch { /* ignore */ }
      }
    } catch (err) {
      console.error(`TLS approach "${approach.name}" failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All mTLS approaches failed");
}

function decodeChunked(data: string): string {
  let result = "";
  let remaining = data;
  while (remaining.length > 0) {
    const lineEnd = remaining.indexOf("\r\n");
    if (lineEnd === -1) break;
    const chunkSize = parseInt(remaining.substring(0, lineEnd), 16);
    if (chunkSize === 0 || isNaN(chunkSize)) break;
    result += remaining.substring(lineEnd + 2, lineEnd + 2 + chunkSize);
    remaining = remaining.substring(lineEnd + 2 + chunkSize + 2);
  }
  return result;
}

async function mtlsFetchWithRetry(
  path: string,
  options: { method: string; headers?: Record<string, string>; body?: string },
  maxRetries = 3
): Promise<{ status: number; body: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await mtlsFetch(path, options);
    } catch (err) {
      console.error(`mTLS attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error("Unreachable");
}

// ── Efí API ──────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId = getEnv("EFI_CLIENT_ID");
  const clientSecret = getEnv("EFI_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const resp = await mtlsFetchWithRetry("/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  if (resp.status !== 200) {
    throw new Error(`OAuth failed (${resp.status}): ${resp.body}`);
  }

  const data = JSON.parse(resp.body);
  return data.access_token;
}

let _webhookEnsuredAt = 0;
let _webhookEnsurePromise: Promise<{ webhookUrl: string; data: any }> | null = null;
const WEBHOOK_ENSURE_TTL_MS = 10 * 60 * 1000;

function getSupabaseServerKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getWebhookHmacToken(): Promise<string> {
  const pixKey = getEnv("EFI_PIX_KEY");
  const serverKey = getSupabaseServerKey();
  return (await sha256Hex(`${pixKey}|${serverKey}|wmcplayer-pix-webhook`)).slice(0, 48);
}

async function getWebhookUrl(): Promise<string> {
  const supabaseUrl = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const hmac = await getWebhookHmacToken();
  // ignorar= impede a Efí de acrescentar /pix e mantém uma única rota estável.
  return `${supabaseUrl}/functions/v1/pix-efi/webhook?hmac=${hmac}&ignorar=`;
}

async function configureWebhook(accessToken: string): Promise<{ webhookUrl: string; data: any }> {
  const pixKey = getEnv("EFI_PIX_KEY");
  const webhookUrl = await getWebhookUrl();

  const resp = await mtlsFetchWithRetry(`/v2/webhook/${encodeURIComponent(pixKey)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // Supabase Edge Functions não exigem certificado de cliente na entrada.
      // A Efí permite registrar em hospedagem compartilhada com skip-mTLS.
      "x-skip-mtls-checking": "true",
    },
    body: JSON.stringify({ webhookUrl }),
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Falha ao registrar webhook Efí (${resp.status}): ${resp.body}`);
  }

  let data: any = {};
  try {
    data = resp.body ? JSON.parse(resp.body) : {};
  } catch {
    data = { raw: resp.body };
  }

  _webhookEnsuredAt = Date.now();
  console.log("Webhook Efí configurado:", JSON.stringify({ webhookUrl, response: data }));
  return { webhookUrl, data };
}

async function ensureWebhookConfigured(accessToken: string): Promise<{ webhookUrl: string; data: any }> {
  if (_webhookEnsuredAt && Date.now() - _webhookEnsuredAt < WEBHOOK_ENSURE_TTL_MS) {
    return { webhookUrl: await getWebhookUrl(), data: { cached: true } };
  }

  if (_webhookEnsurePromise) return await _webhookEnsurePromise;

  _webhookEnsurePromise = configureWebhook(accessToken).finally(() => {
    _webhookEnsurePromise = null;
  });

  return await _webhookEnsurePromise;
}

interface CobPayload {
  calendario: { expiracao: number };
  devedor?: { cpf?: string; nome?: string };
  valor: { original: string };
  chave: string;
  solicitacaoPagador?: string;
  infoAdicionais?: { nome: string; valor: string }[];
}

interface CobResponse {
  txid: string;
  loc: { id: number; location: string };
  status: string;
  calendario: { criacao: string; expiracao: number };
  valor: { original: string };
  chave: string;
  pixCopiaECola?: string;
}

async function createPixCharge(token: string, payload: CobPayload): Promise<CobResponse> {
  const resp = await mtlsFetchWithRetry("/v2/cob", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Create cob failed (${resp.status}): ${resp.body}`);
  }

  return JSON.parse(resp.body);
}

async function getQrCode(token: string, locId: number): Promise<{ qrcode: string; imagemQrcode: string }> {
  const resp = await mtlsFetchWithRetry(`/v2/loc/${locId}/qrcode`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`QR code failed (${resp.status}): ${resp.body}`);
  }

  return JSON.parse(resp.body);
}

// ── Supabase helpers ─────────────────────────────────────────────────────

function getAdminSupabase() {
  return createClient(getEnv("SUPABASE_URL"), (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY")));
}

async function sendRealtimeBroadcast(_adminSupa: any, channelName: string, eventName: string, payload: Record<string, any>) {
  const supabaseUrl = getEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast/${encodeURIComponent(channelName)}/events/${encodeURIComponent(eventName)}`;

  const realtimeHeaders: Record<string, string> = {
    apikey: serviceKey,
    "Content-Type": "application/json",
  };

  // Chaves novas sb_secret_* não são JWT e não podem ser usadas como Bearer.
  // Para chave legada JWT, o Authorization continua permitido.
  if (serviceKey.split(".").length === 3) {
    realtimeHeaders.Authorization = `Bearer ${serviceKey}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: realtimeHeaders,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Realtime REST ${response.status}: ${await response.text()}`);
  }
}

async function emitFinanceUpdated(adminSupa: any, userId: string, payload: Record<string, any> = {}) {
  const eventPayload = { user_id: userId, sentAt: Date.now(), ...payload };
  const commands = [
    sendRealtimeBroadcast(adminSupa, `wmcplayer-client-${userId}`, "finance-updated", eventPayload),
    sendRealtimeBroadcast(adminSupa, "wmcplayer-admin", "finance-updated", eventPayload),
  ];

  if (payload.profile_patch) {
    commands.push(
      sendRealtimeBroadcast(adminSupa, `wmcplayer-client-${userId}`, "client-profile-updated", {
        user_id: userId,
        sentAt: eventPayload.sentAt,
        profile: payload.profile_patch,
        action: payload.action,
      }),
    );
  }

  try {
    await Promise.all(commands);
  } catch (err) {
    console.warn("Falha ao emitir atualização PIX instantânea:", err instanceof Error ? err.message : String(err));
  }
}

function getUserSupabase(authHeader: string) {
  return createClient(getEnv("SUPABASE_URL"), (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY")), {
    global: { headers: { Authorization: authHeader } },
  });
}

async function readJsonBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const userSupa = getUserSupabase(authHeader);
    const { data: { user: authUser }, error: authError } = await userSupa.auth.getUser();

    if (authError || !authUser?.id) {
      console.warn("PIX auth token ignored:", authError?.message || "missing user");
      return null;
    }

    return authUser.id;
  } catch (err) {
    console.warn("PIX auth token fallback:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function getUserIdFromRecord(path: string, body: any): Promise<string | null> {
  const adminSupa = getAdminSupabase();

  if ((path === "create-charge" || path === "check-status") && body?.payment_id) {
    const { data, error } = await adminSupa
      .from("iptv_payments")
      .select("user_id")
      .eq("id", body.payment_id)
      .maybeSingle();

    if (!error && data?.user_id) return data.user_id;
  }

  if ((path === "create-credit-charge" || path === "check-credit-status") && body?.purchase_id) {
    const { data, error } = await adminSupa
      .from("credit_purchases")
      .select("user_id")
      .eq("id", body.purchase_id)
      .maybeSingle();

    if (!error && data?.user_id) return data.user_id;
  }

  return null;
}

function isPixClientAction(path: string): boolean {
  return ["create-charge", "check-status", "create-credit-charge", "check-credit-status"].includes(path);
}

// ── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const path = pathSegments[pathSegments.length - 1];
    console.log("pix-efi request:", JSON.stringify({
      method: req.method,
      pathname: url.pathname,
      action: path,
    }));
    
    // Efí appends /pix to webhook URL, so match both "webhook" and "pix"
    const isWebhook = path === "webhook" || path === "pix" || 
      (pathSegments.length >= 2 && pathSegments[pathSegments.length - 2] === "webhook");

    // ── Webhook (public, called by Efí) ──
    if (isWebhook && (req.method === "POST" || req.method === "GET")) {
      const receivedHmac = url.searchParams.get("hmac") || "";
      const expectedHmac = await getWebhookHmacToken();

      if (!receivedHmac || receivedHmac !== expectedHmac) {
        console.warn("Webhook Efí rejeitado: HMAC ausente ou inválido.");
        return jsonResp({ error: "Webhook não autorizado" }, 401);
      }

      if (req.method === "GET") {
        return jsonResp({ ok: true });
      }
      return await handleWebhook(req);
    }

    // ── Endpoints do cliente/admin ──
    // O admin pode alterar dados do cliente enquanto o cliente está com o painel aberto.
    // Nessa situação o token do navegador pode ficar instável/expirado por alguns segundos.
    // Para PIX do cliente, nunca retornamos "Unauthorized" direto: resolvemos o usuário pelo pagamento já criado.
    const body = await readJsonBody(req);
    const authHeader = req.headers.get("Authorization");
    let userId = await getUserIdFromAuthHeader(authHeader);

    if (!userId && isPixClientAction(path)) {
      userId = await getUserIdFromRecord(path, body);
    }

    if (!userId) {
      console.warn("PIX auth failed without record fallback:", JSON.stringify({
        action: path,
        has_payment_id: Boolean(body?.payment_id),
        has_purchase_id: Boolean(body?.purchase_id),
      }));

      return jsonResp({
        error: "Sessão temporariamente inválida. Atualize a tela e tente novamente.",
        detail: "AUTH_TEMPORARILY_UNAVAILABLE",
      }, 401);
    }

    if (path === "create-charge") {
      return await handleCreateCharge(userId, body);
    }

    if (path === "create-credit-charge") {
      return await handleCreateCreditCharge(userId, body);
    }

    if (path === "check-status") {
      return await handleCheckStatus(userId, body);
    }

    if (path === "check-credit-status") {
      return await handleCheckCreditStatus(userId, body);
    }

    if (path === "register-webhook") {
      return await handleRegisterWebhook(userId);
    }

    if (path === "reconcile-pending-payments") {
      return await handleReconcilePendingPayments(userId);
    }

    if (path === "check-webhook") {
      return await handleCheckWebhook(userId);
    }

    return jsonResp({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("pix-efi detailed error:", JSON.stringify({
      message,
      stack,
    }));
    const lowerMessage = message.toLowerCase();
    const friendlyMessage =
      lowerMessage.includes("asn.1") ||
      lowerMessage.includes("certificado pix efí") ||
      lowerMessage.includes("certificate") ||
      lowerMessage.includes("p12")
        ? "Certificado PIX Efí inválido ou incompleto. Reenvie as configurações do PIX pelo arquivo CONFIGURAR_PIX_E_FUNCOES_SUPABASE.bat."
        : message;

    return jsonResp({
      error: friendlyMessage,
      detail: friendlyMessage,
      technical_detail: message,
      hint: "Erro interno da função pix-efi. Veja Supabase > Edge Functions > pix-efi > Logs.",
    }, 500);
  }
});

// ── Action handlers ──────────────────────────────────────────────────────

async function handleCreateCharge(userId: string, body: any) {
  const { payment_id, amount, devedor_nome, devedor_cpf, descricao } = body;

  console.log("create-charge received:", JSON.stringify({
    userId,
    payment_id,
    amount,
    has_devedor_nome: Boolean(devedor_nome),
    has_devedor_cpf: Boolean(devedor_cpf),
  }));

  if (!payment_id || !amount) {
    return jsonResp({ error: "payment_id and amount required" }, 400);
  }

  const adminSupa = getAdminSupabase();
  const { data: paymentOwner } = await adminSupa
    .from("iptv_payments")
    .select("id,user_id")
    .eq("id", payment_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!paymentOwner) {
    return jsonResp({ error: "Pagamento não encontrado para este cliente." }, 404);
  }

  const pixKey = getEnv("EFI_PIX_KEY");
  console.log("EFI_PIX_KEY loaded:", JSON.stringify({
    length: pixKey.length,
    preview: pixKey.slice(0, 4) + "..." + pixKey.slice(-4),
  }));

  console.log("Requesting Efí OAuth token...");
  const accessToken = await getAccessToken();
  console.log("Efí OAuth token OK.");

  // Evento único: garante o webhook antes de gerar a cobrança. Não usa polling.
  await ensureWebhookConfigured(accessToken);

  const cobPayload: CobPayload = {
    calendario: { expiracao: 3600 },
    valor: { original: Number(amount).toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: descricao || "Pagamento TV",
  };

  if (devedor_nome && devedor_cpf) {
    cobPayload.devedor = { cpf: devedor_cpf, nome: devedor_nome };
  }

  console.log("Creating Efí PIX charge...");
  const cob = await createPixCharge(accessToken, cobPayload);
  console.log("Efí charge created:", JSON.stringify({
    txid: cob.txid,
    loc_id: cob.loc?.id,
    status: cob.status,
  }));

  // Get QR code
  console.log("Getting Efí QR Code...");
  const qr = await getQrCode(accessToken, cob.loc.id);
  console.log("Efí QR Code OK.");

  // Update payment record with PIX data
  await adminSupa
    .from("iptv_payments")
    .update({
      pix_txid: cob.txid,
      pix_location: cob.loc.location,
      pix_copia_cola: qr.qrcode,
      status: "pix_pending",
    })
    .eq("id", payment_id);

  // Sem polling: a confirmação chega exclusivamente pelo webhook da Efí.

  return jsonResp({
    txid: cob.txid,
    qrcode: qr.qrcode,
    qrcode_image: qr.imagemQrcode,
    location: cob.loc.location,
    expiracao: cob.calendario.expiracao,
  });
}

async function reconcilePendingPaymentsForAdmin(adminSupa: any, accessToken: string) {
  const { data: pendingPayments, error: paymentError } = await adminSupa
    .from("iptv_payments")
    .select("*")
    .in("status", ["pending", "pix_pending"])
    .not("pix_txid", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (paymentError) throw paymentError;

  const { data: paidPendingActivation, error: paidPendingError } = await adminSupa
    .from("iptv_payments")
    .select("*")
    .eq("status", "paid_pending_activation")
    .order("payment_date", { ascending: true })
    .limit(200);

  if (paidPendingError) throw paidPendingError;

  const { data: pendingCredits, error: creditError } = await adminSupa
    .from("credit_purchases")
    .select("*")
    .eq("status", "pending")
    .not("pix_txid", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (creditError) throw creditError;

  let recoveredPayments = 0;
  let repairedPaidProfiles = 0;
  let recoveredCredits = 0;
  const errors: string[] = [];

  for (const payment of pendingPayments || []) {
    try {
      const resp = await mtlsFetchWithRetry(`/v2/cob/${encodeURIComponent(payment.pix_txid)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (resp.status >= 200 && resp.status < 300) {
        const cob = JSON.parse(resp.body);
        if (cob.status === "CONCLUIDA") {
          await confirmPaymentAndUpdateExpiry(adminSupa, payment);
          recoveredPayments += 1;
        }
      }
    } catch (err) {
      errors.push(`Pagamento ${payment.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Comando único do admin: repara pagamentos já recebidos cujo perfil
  // ainda permaneceu bloqueado/teste por uma versão anterior.
  for (const payment of paidPendingActivation || []) {
    try {
      const result = await syncPaidAwaitingActivationProfile(adminSupa, payment, true);
      if (!result.skippedActive) repairedPaidProfiles += 1;
    } catch (err) {
      errors.push(`Perfil do pagamento ${payment.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const purchase of pendingCredits || []) {
    try {
      const resp = await mtlsFetchWithRetry(`/v2/cob/${encodeURIComponent(purchase.pix_txid)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (resp.status >= 200 && resp.status < 300) {
        const cob = JSON.parse(resp.body);
        if (cob.status === "CONCLUIDA") {
          await confirmCreditPurchase(adminSupa, purchase);
          recoveredCredits += 1;
        }
      }
    } catch (err) {
      errors.push(`Crédito ${purchase.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    checked_payments: (pendingPayments || []).length,
    checked_credits: (pendingCredits || []).length,
    recovered_payments: recoveredPayments,
    repaired_paid_profiles: repairedPaidProfiles,
    recovered_credits: recoveredCredits,
    errors,
  };
}

async function handleRegisterWebhook(userId: string) {
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const accessToken = await getAccessToken();
  const registered = await configureWebhook(accessToken);

  // Recupera, por comando único do admin, PIX já pagos que perderam o callback.
  const reconciliation = await reconcilePendingPaymentsForAdmin(adminSupa, accessToken);

  return jsonResp({
    ok: true,
    webhookUrl: registered.webhookUrl,
    data: registered.data,
    reconciliation,
  });
}

async function handleReconcilePendingPayments(userId: string) {
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const accessToken = await getAccessToken();
  const reconciliation = await reconcilePendingPaymentsForAdmin(adminSupa, accessToken);
  return jsonResp({ ok: true, reconciliation });
}

async function handleCheckWebhook(userId: string) {
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const pixKey = getEnv("EFI_PIX_KEY");
  const accessToken = await getAccessToken();

  const resp = await mtlsFetchWithRetry(`/v2/webhook/${encodeURIComponent(pixKey)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status < 200 || resp.status >= 300) {
    return jsonResp({ error: `Falha ao consultar webhook (${resp.status}): ${resp.body}` }, 400);
  }

  const data = JSON.parse(resp.body);
  return jsonResp({ ok: true, expectedWebhookUrl: await getWebhookUrl(), data });
}

// Consulta manual de diagnóstico. Nunca chamar em intervalo automático.
async function handleCheckStatus(userId: string, body: any) {
  const { payment_id } = body;
  if (!payment_id) return jsonResp({ error: "payment_id required" }, 400);

  const adminSupa = getAdminSupabase();
  const { data: payment } = await adminSupa
    .from("iptv_payments")
    .select("*")
    .eq("id", payment_id)
    .eq("user_id", userId)
    .single();

  if (!payment) return jsonResp({ error: "Payment not found" }, 404);
  if (!["pending", "pix_pending"].includes(payment.status)) {
    return jsonResp({ status: payment.status, confirmed: true });
  }

  // If we have a txid, check with Efí API directly
  if (payment.pix_txid) {
    try {
      const accessToken = await getAccessToken();
      const resp = await mtlsFetchWithRetry(`/v2/cob/${payment.pix_txid}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (resp.status >= 200 && resp.status < 300) {
        const cobData = JSON.parse(resp.body);
        console.log(`Check status for txid ${payment.pix_txid}: ${cobData.status}`);
        
        // Efí statuses: ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
        if (cobData.status === "CONCLUIDA") {
          await confirmPaymentAndUpdateExpiry(adminSupa, payment);
          return jsonResp({ status: "paid_pending_activation", confirmed: true });
        }
      }
    } catch (err) {
      console.error("Check status API error:", err.message);
    }
  }

  return jsonResp({ status: "pending", confirmed: false });
}

// ── Credit purchase charge ───────────────────────────────────────────────

async function handleCreateCreditCharge(userId: string, body: any) {
  const { purchase_id, amount, descricao } = body;

  if (!purchase_id || !amount) {
    return jsonResp({ error: "purchase_id and amount required" }, 400);
  }

  const adminSupa = getAdminSupabase();
  const { data: purchaseOwner } = await adminSupa
    .from("credit_purchases")
    .select("id,user_id")
    .eq("id", purchase_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!purchaseOwner) {
    return jsonResp({ error: "Compra não encontrada para este cliente." }, 404);
  }

  const pixKey = getEnv("EFI_PIX_KEY");
  const accessToken = await getAccessToken();

  // Evento único: garante o webhook antes de gerar a cobrança. Não usa polling.
  await ensureWebhookConfigured(accessToken);

  const cobPayload: CobPayload = {
    calendario: { expiracao: 3600 },
    valor: { original: Number(amount).toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: descricao || "Compra de Créditos - Bitz TV",
  };

  const cob = await createPixCharge(accessToken, cobPayload);
  const qr = await getQrCode(accessToken, cob.loc.id);

  // Update credit_purchases record with PIX data
  await adminSupa
    .from("credit_purchases")
    .update({
      pix_txid: cob.txid,
      pix_location: cob.loc.location,
      pix_code: qr.qrcode,
      pix_qrcode: qr.imagemQrcode,
      status: "pending",
    })
    .eq("id", purchase_id);

  // Sem polling: a confirmação chega exclusivamente pelo webhook da Efí.

  return jsonResp({
    txid: cob.txid,
    qrcode: qr.qrcode,
    qrcode_image: qr.imagemQrcode,
    location: cob.loc.location,
    expiracao: cob.calendario.expiracao,
  });
}

// Consulta manual de diagnóstico. Nunca chamar em intervalo automático.
async function handleCheckCreditStatus(userId: string, body: any) {
  const { purchase_id } = body;
  if (!purchase_id) return jsonResp({ error: "purchase_id required" }, 400);

  const adminSupa = getAdminSupabase();
  const { data: purchase } = await adminSupa
    .from("credit_purchases")
    .select("*")
    .eq("id", purchase_id)
    .eq("user_id", userId)
    .single();

  if (!purchase) return jsonResp({ error: "Purchase not found" }, 404);
  if (purchase.status !== "pending") {
    return jsonResp({ status: purchase.status, confirmed: purchase.status === "confirmed" });
  }

  // Check with Efi API
  if (purchase.pix_txid) {
    try {
      const accessToken = await getAccessToken();
      const resp = await mtlsFetchWithRetry(`/v2/cob/${purchase.pix_txid}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (resp.status >= 200 && resp.status < 300) {
        const cobData = JSON.parse(resp.body);
        console.log(`Credit check status for txid ${purchase.pix_txid}: ${cobData.status}`);

        if (cobData.status === "CONCLUIDA") {
          await confirmCreditPurchase(adminSupa, purchase);
          return jsonResp({ status: "confirmed", confirmed: true });
        }
      }
    } catch (err) {
      console.error("Credit check status API error:", err.message);
    }
  }

  return jsonResp({ status: "pending", confirmed: false });
}

async function confirmCreditPurchase(adminSupa: any, purchase: any) {
  // ATOMIC GUARD
  const { data: updated, error: updateError } = await adminSupa
    .from("credit_purchases")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", purchase.id)
    .eq("status", "pending")
    .select("id");

  if (updateError) throw updateError;

  if (!updated || updated.length === 0) {
    console.log(`Credit purchase ${purchase.id} already processed — skipping.`);
    return;
  }

  // Add credits to user
  const totalCredits = purchase.credits_amount + purchase.bonus_amount;
  const { data: profile } = await adminSupa.from("profiles").select("credits, level_points").eq("id", purchase.user_id).single();
  if (!profile) return;

  const newBalance = profile.credits + totalCredits;
  const newPoints = profile.level_points + purchase.credits_amount;

  await adminSupa.from("profiles").update({
    credits: newBalance,
    level_points: newPoints,
    daily_credits_purchased: purchase.credits_amount,
    daily_purchase_date: new Date().toISOString().slice(0, 10),
  }).eq("id", purchase.user_id);

  // Log credit transaction
  await adminSupa.from("credit_transactions").insert({
    user_id: purchase.user_id,
    type: "purchase",
    amount: totalCredits,
    balance_after: newBalance,
    description: `Compra via PIX: ${purchase.credits_amount} + ${purchase.bonus_amount} bônus`,
  });

  // Update monthly ranking
  const monthYear = new Date().toISOString().slice(0, 7);
  const { data: rank } = await adminSupa.from("credit_rankings")
    .select("*").eq("user_id", purchase.user_id).eq("month_year", monthYear).maybeSingle();
  if (rank) {
    await adminSupa.from("credit_rankings").update({ total_purchased: rank.total_purchased + purchase.credits_amount }).eq("id", rank.id);
  } else {
    await adminSupa.from("credit_rankings").insert({ user_id: purchase.user_id, month_year: monthYear, total_purchased: purchase.credits_amount });
  }

  // Update user level
  let finalLevel = "bronze";
  let finalVip = false;
  const { data: settings } = await adminSupa.from("credit_settings").select("level_thresholds, vip_threshold").limit(1).single();
  if (settings) {
    const thresholds = settings.level_thresholds as Record<string, number>;
    if (newPoints >= (thresholds.diamante || 2000)) finalLevel = "diamante";
    else if (newPoints >= (thresholds.ouro || 500)) finalLevel = "ouro";
    else if (newPoints >= (thresholds.prata || 100)) finalLevel = "prata";
    finalVip = newPoints >= (settings.vip_threshold || 200);
    await adminSupa.from("profiles").update({ user_level: finalLevel, vip_badge: finalVip }).eq("id", purchase.user_id);
  }

  await emitFinanceUpdated(adminSupa, purchase.user_id, {
    action: "credit_purchase_confirmed",
    source: "credit_transactions",
    purchase_id: purchase.id,
    status: "confirmed",
    credits_added: totalCredits,
    credits_after: newBalance,
    level_points_after: newPoints,
    user_level: finalLevel,
    vip_badge: finalVip,
    profile_patch: {
      credits: newBalance,
      level_points: newPoints,
      user_level: finalLevel,
      vip_badge: finalVip,
      daily_credits_purchased: purchase.credits_amount,
      daily_purchase_date: new Date().toISOString().slice(0, 10),
    },
    purchase: {
      id: purchase.id,
      user_id: purchase.user_id,
      status: "confirmed",
      credits_amount: purchase.credits_amount,
      bonus_amount: purchase.bonus_amount,
      total_credits: totalCredits,
      price: purchase.price,
      confirmed_at: new Date().toISOString(),
    },
  });

  console.log(`Credit purchase ${purchase.id} confirmed. ${totalCredits} credits added to user ${purchase.user_id}`);
}

const PAID_AWAITING_ACTIVATION_PROFILE_PATCH = {
  iptv_status: "awaiting_activation",
  trial_enabled: false,
  trial_payment_confirmed: true,
  trial_expired_at: null,
  trial_expired_notice_sent_at: null,
};

async function syncPaidAwaitingActivationProfile(
  adminSupa: any,
  payment: any,
  emitRepairCommand = false,
) {
  const { data: currentProfile, error: currentProfileError } = await adminSupa
    .from("profiles")
    .select("id, name, username, iptv_client_code, iptv_server, iptv_connections, iptv_expiry, iptv_status, trial_enabled, trial_payment_confirmed")
    .eq("id", payment.user_id)
    .maybeSingle();

  if (currentProfileError) throw currentProfileError;

  // Nunca rebaixa para aguardando ativação um cliente que já foi ativado pelo admin.
  if (currentProfile?.iptv_status === "active" && currentProfile?.trial_enabled !== true) {
    return { profilePatch: null, profileSnapshot: currentProfile, skippedActive: true };
  }

  const { data: updatedProfile, error: profileUpdateError } = await adminSupa
    .from("profiles")
    .update(PAID_AWAITING_ACTIVATION_PROFILE_PATCH)
    .eq("id", payment.user_id)
    .select("id, name, username, iptv_client_code, iptv_server, iptv_connections, iptv_expiry, iptv_status, trial_enabled, trial_payment_confirmed, trial_expired_at, trial_expired_notice_sent_at")
    .maybeSingle();

  if (profileUpdateError) throw profileUpdateError;

  if (emitRepairCommand) {
    await emitFinanceUpdated(adminSupa, payment.user_id, {
      action: "pix_payment_received",
      source: "iptv_payments",
      payment_id: payment.id,
      status: "paid_pending_activation",
      iptv_status: "awaiting_activation",
      period_end: payment.period_end,
      profile_patch: PAID_AWAITING_ACTIVATION_PROFILE_PATCH,
      profile_snapshot: updatedProfile || currentProfile,
      payment: {
        ...payment,
        status: "paid_pending_activation",
        payment_date: payment.payment_date || new Date().toISOString(),
      },
      repaired: true,
    });
  }

  return {
    profilePatch: PAID_AWAITING_ACTIVATION_PROFILE_PATCH,
    profileSnapshot: updatedProfile || currentProfile,
    skippedActive: false,
  };
}

// Shared function: confirm payment, update expiry, set awaiting_activation
async function confirmPaymentAndUpdateExpiry(adminSupa: any, payment: any) {
  // ATOMIC GUARD: Only update if the PIX charge is still waiting to prevent duplicate processing
  const { data: updated, error: updateErr } = await adminSupa
    .from("iptv_payments")
    .update({ status: "paid_pending_activation", payment_date: new Date().toISOString() })
    .eq("id", payment.id)
    .in("status", ["pending", "pix_pending"])
    .select("id");

  if (updateErr) throw updateErr;

  // Se outro callback já marcou como pago, garante que o perfil também entrou
  // no fluxo padrão de aguardando ativação. Isso corrige pagamentos após teste
  // que ficaram com o perfil visualmente bloqueado.
  if (!updated || updated.length === 0) {
    const { data: currentPayment } = await adminSupa
      .from("iptv_payments")
      .select("*")
      .eq("id", payment.id)
      .maybeSingle();

    if (currentPayment?.status === "paid_pending_activation") {
      await syncPaidAwaitingActivationProfile(adminSupa, currentPayment, true);
      console.log(`Payment ${payment.id} already paid; profile/status repaired.`);
    } else {
      console.log(`Payment ${payment.id} already processed by another request — skipping.`);
    }
    return;
  }

  // 2. Atualiza o perfil e envia a ordem completa para a tela do cliente.
  // Se era usuário de teste, o 1º pagamento já tira ele do modo teste.
  const profilePatch = PAID_AWAITING_ACTIVATION_PROFILE_PATCH;
  const syncedProfile = await syncPaidAwaitingActivationProfile(adminSupa, payment, false);

  // 4. Log in balance_history
  await adminSupa.from("balance_history").insert({
    user_id: payment.user_id,
    amount: -payment.amount,
    type: "iptv_payment",
    description: `Pagamento TV confirmado via PIX (txid: ${payment.pix_txid})`,
  });

  // 5. Envia primeiro as ordens Realtime. A tela não depende da entrega do Push.
  const confirmedAt = new Date().toISOString();
  const profileSnapshot = syncedProfile.profileSnapshot;

  await emitFinanceUpdated(adminSupa, payment.user_id, {
    action: "pix_payment_received",
    source: "iptv_payments",
    payment_id: payment.id,
    status: "paid_pending_activation",
    iptv_status: "awaiting_activation",
    period_end: payment.period_end,
    profile_patch: profilePatch,
    profile_snapshot: profileSnapshot,
    payment: {
      ...payment,
      status: "paid_pending_activation",
      payment_date: confirmedAt,
    },
    movement: {
      user_id: payment.user_id,
      amount: -Number(payment.amount || 0),
      type: "iptv_payment",
      description: `Pagamento TV confirmado via PIX (txid: ${payment.pix_txid || ""})`,
      created_at: confirmedAt,
    },
  });

  // 6. Envia Push. Regras personalizadas têm prioridade; se não houver regra, usa mensagem padrão.
  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY"));

    // Get user profile for template variables
    const { data: userProfile } = await adminSupa.from("profiles").select("name, iptv_server, iptv_expiry").eq("id", payment.user_id).single();

    // Load active rules for payment_received event
    const { data: rules } = await adminSupa.from("notification_rules").select("*").eq("trigger_event", "payment_received").eq("is_active", true);

    const templateVars: Record<string, string> = {
      "{nome}": userProfile?.name || "",
      "{valor}": Number(payment.amount).toFixed(2),
      "{servidor}": userProfile?.iptv_server || "",
      "{plano_meses}": String(payment.months || 1),
      "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),
      "{validade}": userProfile?.iptv_expiry ? userProfile.iptv_expiry.split("-").reverse().join("/") : "",
    };

    const clientRules = (rules && rules.length > 0)
      ? rules
      : [{
          title_template: "Pagamento PIX recebido",
          body_template: "Olá {nome}! Recebemos seu pagamento de R$ {valor}. Aguarde a ativação do suporte.",
          click_url: "/dashboard",
        }];

    for (const rule of clientRules) {
      let title = rule.title_template;
      let body = rule.body_template;
      for (const [key, val] of Object.entries(templateVars)) {
        title = title.replaceAll(key, val);
        body = body.replaceAll(key, val);
      }

      await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": serviceKey },
        body: JSON.stringify({
          action: "send_to_user",
          user_id: payment.user_id,
          title, body, url: rule.click_url || "/dashboard",
        }),
      });
    }

    console.log(`Push enviado ao cliente ${payment.user_id} (${clientRules.length} mensagem(ns))`);

    // Notify admins about new support request
    try {
      const { data: adminRules } = await adminSupa.from("notification_rules").select("*").eq("trigger_event", "new_support_request").eq("is_active", true);
      const { data: adminRoles } = await adminSupa.from("user_roles").select("user_id").eq("role", "admin");
      const adminVars: Record<string, string> = {
        "{nome}": userProfile?.name || "",
        "{valor}": Number(payment.amount).toFixed(2),
        "{servidor}": userProfile?.iptv_server || "",
        "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),
        "{validade}": "", "{plano_meses}": String(payment.months || 1),
      };
      const rulesForAdmin = (adminRules && adminRules.length > 0)
        ? adminRules
        : [{
            title_template: "PIX recebido — ativação pendente",
            body_template: "{nome} pagou R$ {valor}. Abra a seção TV para confirmar a ativação.",
            click_url: "/admin/iptv",
          }];

      for (const rule of rulesForAdmin) {
        let at = rule.title_template;
        let ab = rule.body_template;
        for (const [key, val] of Object.entries(adminVars)) {
          at = at.replaceAll(key, val);
          ab = ab.replaceAll(key, val);
        }
        for (const admin of (adminRoles || [])) {
          await fetch(`${supabaseUrl}/functions/v1/push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-internal-key": serviceKey },
            body: JSON.stringify({ action: "send_to_user", user_id: admin.user_id, title: at, body: ab, url: rule.click_url || "/admin/iptv" }),
          });
        }
      }
      console.log(`Admin(s) notificado(s) sobre o PIX de ${payment.user_id}`);
    } catch (adminPushErr) {
      console.error("Failed to notify admin:", adminPushErr);
    }
  } catch (pushErr) {
    console.error("Failed to send push notification:", pushErr);
  }

  console.log(`Payment ${payment.id} confirmed. Awaiting admin activation.`);
}

async function handleWebhook(req: Request) {
  // A Efí chama esta rota por evento. Não existe polling.
  try {
    const rawBody = await req.text();
    if (!rawBody.trim()) {
      // Notificação de teste usada no cadastro do webhook.
      return jsonResp({ ok: true, test: true });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResp({ error: "JSON de webhook inválido" }, 400);
    }

    console.log("PIX webhook received:", JSON.stringify(body));

    const pixArray = Array.isArray(body?.pix) ? body.pix : [];
    if (pixArray.length === 0) {
      return jsonResp({ ok: true, empty: true });
    }

    const expectedPixKey = getEnv("EFI_PIX_KEY");
    const adminSupa = getAdminSupabase();
    let processed = 0;

    for (const pix of pixArray) {
      const txid = String(pix?.txid || "").trim();
      if (!txid) continue;

      if (pix?.chave && String(pix.chave) !== expectedPixKey) {
        console.warn(`Webhook ignorado: chave PIX divergente para txid ${txid}.`);
        continue;
      }

      const { data: payment, error: paymentLookupError } = await adminSupa
        .from("iptv_payments")
        .select("*")
        .eq("pix_txid", txid)
        .maybeSingle();

      if (paymentLookupError) throw paymentLookupError;

      if (payment) {
        if (["pending", "pix_pending"].includes(payment.status)) {
          await confirmPaymentAndUpdateExpiry(adminSupa, payment);
          processed += 1;
          console.log(`Payment ${payment.id} confirmed via webhook`);
        } else {
          console.log(`Payment ${payment.id} already processed (status: ${payment.status})`);
        }
        continue;
      }

      const { data: creditPurchase, error: creditLookupError } = await adminSupa
        .from("credit_purchases")
        .select("*")
        .eq("pix_txid", txid)
        .maybeSingle();

      if (creditLookupError) throw creditLookupError;

      if (creditPurchase) {
        if (creditPurchase.status === "pending") {
          await confirmCreditPurchase(adminSupa, creditPurchase);
          processed += 1;
          console.log(`Credit purchase ${creditPurchase.id} confirmed via webhook`);
        } else {
          console.log(`Credit purchase ${creditPurchase.id} already processed`);
        }
        continue;
      }

      console.warn(`No payment or credit purchase found for txid: ${txid}`);
    }

    return jsonResp({ ok: true, processed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Webhook processing error:", message);
    // Retorna erro para a Efí tentar novamente automaticamente.
    return jsonResp({ error: "Falha temporária ao processar webhook", detail: message }, 500);
  }
}

// Confirmações PIX são recebidas pelo webhook da Efí e enviadas por ordens Realtime.


// ── Utils ────────────────────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
