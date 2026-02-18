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

function getPemCredentials(): { cert: string; key: string } {
  if (_cachedPem) return _cachedPem;

  // Try direct PEM secrets first
  const certPem = Deno.env.get("EFI_CERT_PEM");
  const keyPem = Deno.env.get("EFI_KEY_PEM");
  if (certPem && keyPem) {
    _cachedPem = { cert: ensurePemNewlines(certPem), key: ensurePemNewlines(keyPem) };
    return _cachedPem;
  }

  // Fallback: convert .p12 from base64 using node-forge (pure JS, no openssl)
  const b64 = getEnv("EFI_CERTIFICATE_BASE64");
  const derBytes = forge.util.decode64(b64);
  const asn1 = forge.asn1.fromDer(derBytes);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, "");

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
  if (!certBag?.cert) throw new Error("No certificate found in .p12");
  const cert = forge.pki.certificateToPem(certBag.cert);

  // Extract private key in PKCS#8 format (BEGIN PRIVATE KEY, not BEGIN RSA PRIVATE KEY)
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag?.key) throw new Error("No private key found in .p12");
  
  // Convert to PKCS#8 format which Deno's rustls requires
  const rsaPrivateKey = forge.pki.privateKeyToAsn1(keyBag.key);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
  const key = forge.pki.privateKeyInfoToPem(privateKeyInfo);

  _cachedPem = { cert, key };
  console.log("Extracted PEM from .p12 successfully (PKCS#8 format)");
  console.log("Cert header:", cert.substring(0, 30));
  console.log("Key header:", key.substring(0, 30));
  return _cachedPem;
}

/** Ensure PEM strings have proper newlines (secrets might strip them) */
function ensurePemNewlines(pem: string): string {
  // If it already has proper newlines, return as-is
  if (pem.includes("\n")) return pem;
  // Otherwise reconstruct: header + base64 in 64-char lines + footer
  const match = pem.match(/^(-----BEGIN [^-]+-----)(.+)(-----END [^-]+-----)$/);
  if (!match) return pem;
  const [, header, body, footer] = match;
  const lines = body.match(/.{1,64}/g) || [];
  return `${header}\n${lines.join("\n")}\n${footer}`;
}

// ── Efí API ──────────────────────────────────────────────────────────────

const EFI_BASE_URL = "https://pix.api.efipay.com.br";
const EFI_SANDBOX_URL = "https://pix-h.api.efipay.com.br";

function getBaseUrl(): string {
  // Use sandbox if EFI_SANDBOX env is "true"
  const sandbox = Deno.env.get("EFI_SANDBOX") === "true";
  return sandbox ? EFI_SANDBOX_URL : EFI_BASE_URL;
}

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, options);
      return resp;
    } catch (err) {
      console.error(`Fetch attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt >= maxRetries) throw err;
      const delay = 2000 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

function createMtlsClient(cert: string, key: string): Deno.HttpClient {
  // Try newer Deno API first (cert/key), fallback to legacy (certChain/privateKey)
  try {
    return Deno.createHttpClient({ cert, key });
  } catch {
    console.log("Falling back to certChain/privateKey API");
    return Deno.createHttpClient({ certChain: cert, privateKey: key } as any);
  }
}

async function getAccessToken(httpClient: Deno.HttpClient): Promise<string> {
  const clientId = getEnv("EFI_CLIENT_ID");
  const clientSecret = getEnv("EFI_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const baseUrl = getBaseUrl();

  const resp = await fetchWithRetry(`${baseUrl}/oauth/token`, {
    method: "POST",
    client: httpClient,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  } as RequestInit & { client: Deno.HttpClient });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
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

async function createPixCharge(
  httpClient: Deno.HttpClient,
  token: string,
  payload: CobPayload
): Promise<CobResponse> {
  const baseUrl = getBaseUrl();
  const resp = await fetchWithRetry(`${baseUrl}/v2/cob`, {
    method: "POST",
    client: httpClient,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  } as RequestInit & { client: Deno.HttpClient });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Create cob failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

async function getQrCode(
  httpClient: Deno.HttpClient,
  token: string,
  locId: number
): Promise<{ qrcode: string; imagemQrcode: string }> {
  const baseUrl = getBaseUrl();
  const resp = await fetchWithRetry(`${baseUrl}/v2/loc/${locId}/qrcode`, {
    method: "GET",
    client: httpClient,
    headers: { Authorization: `Bearer ${token}` },
  } as RequestInit & { client: Deno.HttpClient });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`QR code failed (${resp.status}): ${text}`);
  }

  return resp.json();
}

// ── Supabase helpers ─────────────────────────────────────────────────────

function getAdminSupabase() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

function getUserSupabase(authHeader: string) {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // ── Webhook (public, called by Efí) ──
    if (path === "webhook" && req.method === "POST") {
      return await handleWebhook(req);
    }

    // ── Authenticated endpoints ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabase = getUserSupabase(authHeader);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();

    if (path === "create-charge") {
      return await handleCreateCharge(userId, body);
    }

    if (path === "register-webhook") {
      return await handleRegisterWebhook(userId);
    }

    if (path === "check-webhook") {
      return await handleCheckWebhook(userId);
    }

    return jsonResp({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("pix-efi error:", err);
    return jsonResp({ error: err.message }, 500);
  }
});

// ── Action handlers ──────────────────────────────────────────────────────

async function handleCreateCharge(userId: string, body: any) {
  const { payment_id, amount, devedor_nome, devedor_cpf, descricao } = body;

  if (!payment_id || !amount) {
    return jsonResp({ error: "payment_id and amount required" }, 400);
  }

  const pixKey = getEnv("EFI_PIX_KEY");
  const { cert, key: privKey } = getPemCredentials();
  console.log("PEM cert length:", cert.length, "has newlines:", cert.includes("\n"));
  console.log("PEM key length:", privKey.length, "has newlines:", privKey.includes("\n"));

  const httpClient = createMtlsClient(cert, privKey);

  try {
    const accessToken = await getAccessToken(httpClient);

    const cobPayload: CobPayload = {
      calendario: { expiracao: 3600 }, // 1 hour
      valor: { original: Number(amount).toFixed(2) },
      chave: pixKey,
      solicitacaoPagador: descricao || "Pagamento IPTV",
    };

    if (devedor_nome && devedor_cpf) {
      cobPayload.devedor = { cpf: devedor_cpf, nome: devedor_nome };
    }

    const cob = await createPixCharge(httpClient, accessToken, cobPayload);

    // Get QR code
    const qr = await getQrCode(httpClient, accessToken, cob.loc.id);

    // Update payment record with PIX data
    const adminSupa = getAdminSupabase();
    await adminSupa
      .from("iptv_payments")
      .update({
        pix_txid: cob.txid,
        pix_location: cob.loc.location,
        pix_copia_cola: qr.qrcode,
        status: "pending",
      })
      .eq("id", payment_id);

    return jsonResp({
      txid: cob.txid,
      qrcode: qr.qrcode,
      qrcode_image: qr.imagemQrcode,
      location: cob.loc.location,
      expiracao: cob.calendario.expiracao,
    });
  } finally {
    httpClient.close();
  }
}

async function handleRegisterWebhook(userId: string) {
  // Verify user is admin
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const pixKey = getEnv("EFI_PIX_KEY");
  const { cert, key } = getPemCredentials();
  const httpClient = createMtlsClient(cert, key);

  try {
    const accessToken = await getAccessToken(httpClient);
    const baseUrl = getBaseUrl();
    const supabaseUrl = getEnv("SUPABASE_URL");
    const webhookUrl = `${supabaseUrl}/functions/v1/pix-efi/webhook`;

    const resp = await fetchWithRetry(`${baseUrl}/v2/webhook/${pixKey}`, {
      method: "PUT",
      client: httpClient,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ webhookUrl }),
    } as RequestInit & { client: Deno.HttpClient });

    if (!resp.ok) {
      const text = await resp.text();
      return jsonResp({ error: `Falha ao registrar webhook (${resp.status}): ${text}` }, 400);
    }

    const data = await resp.json();
    console.log("Webhook registered:", JSON.stringify(data));
    return jsonResp({ ok: true, webhookUrl, data });
  } finally {
    httpClient.close();
  }
}

async function handleCheckWebhook(userId: string) {
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const pixKey = getEnv("EFI_PIX_KEY");
  const { cert, key } = getPemCredentials();
  const httpClient = createMtlsClient(cert, key);

  try {
    const accessToken = await getAccessToken(httpClient);
    const baseUrl = getBaseUrl();

    const resp = await fetchWithRetry(`${baseUrl}/v2/webhook/${pixKey}`, {
      method: "GET",
      client: httpClient,
      headers: { Authorization: `Bearer ${accessToken}` },
    } as RequestInit & { client: Deno.HttpClient });

    if (!resp.ok) {
      const text = await resp.text();
      return jsonResp({ error: `Falha ao consultar webhook (${resp.status}): ${text}` }, 400);
    }

    const data = await resp.json();
    return jsonResp({ ok: true, data });
  } finally {
    httpClient.close();
  }
}

async function handleWebhook(req: Request) {
  // Efí sends PIX webhook notifications as POST /pix
  // The body contains an array of pix received
  try {
    const body = await req.json();
    console.log("PIX webhook received:", JSON.stringify(body));

    const pixArray = body.pix || [];
    if (pixArray.length === 0) {
      // Could be a test notification from Efí
      return jsonResp({ ok: true });
    }

    const adminSupa = getAdminSupabase();

    for (const pix of pixArray) {
      const txid = pix.txid;
      if (!txid) continue;

      // Find payment by txid
      const { data: payment } = await adminSupa
        .from("iptv_payments")
        .select("*")
        .eq("pix_txid", txid)
        .single();

      if (!payment) {
        console.log(`No payment found for txid: ${txid}`);
        continue;
      }

      if (payment.status === "confirmed") {
        console.log(`Payment ${payment.id} already confirmed`);
        continue;
      }

      // Confirm payment
      await adminSupa
        .from("iptv_payments")
        .update({ status: "confirmed", payment_date: new Date().toISOString() })
        .eq("id", payment.id);

      // Update user iptv_expiry based on period_end
      await adminSupa
        .from("profiles")
        .update({ iptv_status: "active", iptv_expiry: payment.period_end })
        .eq("id", payment.user_id);

      // Log in balance_history
      await adminSupa.from("balance_history").insert({
        user_id: payment.user_id,
        amount: -payment.amount,
        type: "iptv_payment",
        description: `Pagamento IPTV confirmado via PIX (txid: ${txid})`,
      });

      console.log(`Payment ${payment.id} confirmed via webhook`);
    }

    return jsonResp({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResp({ ok: true }); // Always return 200 to Efí
  }
}

// ── Utils ────────────────────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
