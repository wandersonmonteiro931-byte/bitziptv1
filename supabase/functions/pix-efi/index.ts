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

  // Always extract from .p12 to guarantee PKCS#8 key format (required by Deno's rustls)
  const b64 = getEnv("EFI_CERTIFICATE_BASE64");
  console.log("Extracting PEM from .p12 base64 (length:", b64.length, ")");
  
  const derBytes = forge.util.decode64(b64);
  const asn1 = forge.asn1.fromDer(derBytes);
  const p12Password = Deno.env.get("EFI_CERTIFICATE_PASSWORD") || "";
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, p12Password);

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
  if (!certBag?.cert) throw new Error("No certificate found in .p12");
  const cert = forge.pki.certificateToPem(certBag.cert);

  // Extract ALL certificates for the full chain
  const allCertBags = certBags[forge.pki.oids.certBag] || [];
  let fullCertChain = cert;
  if (allCertBags.length > 1) {
    fullCertChain = allCertBags
      .filter((b: any) => b.cert)
      .map((b: any) => forge.pki.certificateToPem(b.cert))
      .join("\n");
    console.log(`Found ${allCertBags.length} certificates in chain`);
  }

  // Extract private key in PKCS#8 format (BEGIN PRIVATE KEY)
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag?.key) throw new Error("No private key found in .p12");
  
  // Convert to PKCS#8 format which Deno's rustls requires
  const rsaPrivateKey = forge.pki.privateKeyToAsn1(keyBag.key);
  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
  const key = forge.pki.privateKeyInfoToPem(privateKeyInfo);

  _cachedPem = { cert: fullCertChain, key };
  
  console.log("PEM extraction successful");
  console.log("Cert starts with:", fullCertChain.substring(0, 27));
  console.log("Key starts with:", key.substring(0, 27));
  console.log("Cert length:", fullCertChain.length, "Key length:", key.length);
  
  // Log cert details for debugging
  const certObj = certBag.cert;
  console.log("Cert subject:", certObj.subject.getField("CN")?.value || "unknown");
  console.log("Cert issuer:", certObj.issuer.getField("CN")?.value || "unknown");
  console.log("Cert valid from:", certObj.validity.notBefore.toISOString());
  console.log("Cert valid to:", certObj.validity.notAfter.toISOString());
  
  return _cachedPem;
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

function getUserSupabase(authHeader: string) {
  return createClient(getEnv("SUPABASE_URL"), (Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY")), {
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
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const path = pathSegments[pathSegments.length - 1];
    
    // Efí appends /pix to webhook URL, so match both "webhook" and "pix"
    const isWebhook = path === "webhook" || path === "pix" || 
      (pathSegments.length >= 2 && pathSegments[pathSegments.length - 2] === "webhook");

    // ── Webhook (public, called by Efí) ──
    if (isWebhook && (req.method === "POST" || req.method === "GET")) {
      if (req.method === "GET") {
        // Efí sends GET to verify webhook URL exists
        return jsonResp({ ok: true });
      }
      return await handleWebhook(req);
    }

    // ── Authenticated endpoints ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const userSupa = getUserSupabase(authHeader);
    const { data: { user: authUser }, error: authError } = await userSupa.auth.getUser();
    if (authError || !authUser) {
      console.error("Auth error:", authError?.message);
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const userId = authUser.id;

    const body = await req.json();

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

  const accessToken = await getAccessToken();

  const cobPayload: CobPayload = {
    calendario: { expiracao: 3600 },
    valor: { original: Number(amount).toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: descricao || "Pagamento IPTV",
  };

  if (devedor_nome && devedor_cpf) {
    cobPayload.devedor = { cpf: devedor_cpf, nome: devedor_nome };
  }

  const cob = await createPixCharge(accessToken, cobPayload);

  // Get QR code
  const qr = await getQrCode(accessToken, cob.loc.id);

  // Update payment record with PIX data
  const adminSupa = getAdminSupabase();
  await adminSupa
    .from("iptv_payments")
    .update({
      pix_txid: cob.txid,
      pix_location: cob.loc.location,
      pix_copia_cola: qr.qrcode,
      status: "pix_pending",
    })
    .eq("id", payment_id);

  // Fire background server-side polling (runs even if client closes the app)
  scheduleBackgroundCheck(adminSupa, payment_id, cob.txid, "iptv");

  return jsonResp({
    txid: cob.txid,
    qrcode: qr.qrcode,
    qrcode_image: qr.imagemQrcode,
    location: cob.loc.location,
    expiracao: cob.calendario.expiracao,
  });
}

async function handleRegisterWebhook(userId: string) {
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const pixKey = getEnv("EFI_PIX_KEY");
  const accessToken = await getAccessToken();
  const supabaseUrl = getEnv("SUPABASE_URL");
  const webhookUrl = `${supabaseUrl}/functions/v1/pix-efi/webhook`;

  const resp = await mtlsFetchWithRetry(`/v2/webhook/${pixKey}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhookUrl }),
  });

  if (resp.status < 200 || resp.status >= 300) {
    return jsonResp({ error: `Falha ao registrar webhook (${resp.status}): ${resp.body}` }, 400);
  }

  const data = JSON.parse(resp.body);
  console.log("Webhook registered:", JSON.stringify(data));
  return jsonResp({ ok: true, webhookUrl, data });
}

async function handleCheckWebhook(userId: string) {
  const adminSupa = getAdminSupabase();
  const { data: isAdmin } = await adminSupa.rpc("has_role", { _role: "admin", _user_id: userId });
  if (!isAdmin) return jsonResp({ error: "Admin only" }, 403);

  const pixKey = getEnv("EFI_PIX_KEY");
  const accessToken = await getAccessToken();

  const resp = await mtlsFetchWithRetry(`/v2/webhook/${pixKey}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status < 200 || resp.status >= 300) {
    return jsonResp({ error: `Falha ao consultar webhook (${resp.status}): ${resp.body}` }, 400);
  }

  const data = JSON.parse(resp.body);
  return jsonResp({ ok: true, data });
}

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

  const pixKey = getEnv("EFI_PIX_KEY");
  const accessToken = await getAccessToken();

  const cobPayload: CobPayload = {
    calendario: { expiracao: 3600 },
    valor: { original: Number(amount).toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: descricao || "Compra de Créditos - Bitz IPTV",
  };

  const cob = await createPixCharge(accessToken, cobPayload);
  const qr = await getQrCode(accessToken, cob.loc.id);

  // Update credit_purchases record with PIX data
  const adminSupa = getAdminSupabase();
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

  // Fire background server-side polling for credit purchases too
  scheduleBackgroundCheck(adminSupa, purchase_id, cob.txid, "credit");

  return jsonResp({
    txid: cob.txid,
    qrcode: qr.qrcode,
    qrcode_image: qr.imagemQrcode,
    location: cob.loc.location,
    expiracao: cob.calendario.expiracao,
  });
}

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
  const { data: updated } = await adminSupa
    .from("credit_purchases")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", purchase.id)
    .eq("status", "pending")
    .select("id");

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
  const { data: settings } = await adminSupa.from("credit_settings").select("level_thresholds, vip_threshold").limit(1).single();
  if (settings) {
    const thresholds = settings.level_thresholds as Record<string, number>;
    let level = "bronze";
    if (newPoints >= (thresholds.diamante || 2000)) level = "diamante";
    else if (newPoints >= (thresholds.ouro || 500)) level = "ouro";
    else if (newPoints >= (thresholds.prata || 100)) level = "prata";
    const vip = newPoints >= (settings.vip_threshold || 200);
    await adminSupa.from("profiles").update({ user_level: level, vip_badge: vip }).eq("id", purchase.user_id);
  }

  console.log(`Credit purchase ${purchase.id} confirmed. ${totalCredits} credits added to user ${purchase.user_id}`);
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

  // If no rows were updated, another process already handled this payment
  if (updateErr || !updated || updated.length === 0) {
    console.log(`Payment ${payment.id} already processed by another request — skipping.`);
    return;
  }

  // 2. Update profile: set awaiting_activation status only
  // The iptv_expiry is NOT updated here — it will only be updated when the admin confirms the activation
  await adminSupa
    .from("profiles")
    .update({ 
      iptv_status: "awaiting_activation" 
    })
    .eq("id", payment.user_id);

  // 4. Log in balance_history
  await adminSupa.from("balance_history").insert({
    user_id: payment.user_id,
    amount: -payment.amount,
    type: "iptv_payment",
    description: `Pagamento IPTV confirmado via PIX (txid: ${payment.pix_txid})`,
  });

  // 5. Send automatic push notifications based on DB rules
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

    for (const rule of (rules || [])) {
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
          title, body, url: rule.click_url || "/",
        }),
      });
    }

    console.log(`Push notifications sent to user ${payment.user_id} (${(rules || []).length} rules)`);

    // Notify admins about new support request
    try {
      const { data: adminRules } = await adminSupa.from("notification_rules").select("*").eq("trigger_event", "new_support_request").eq("is_active", true);
      if (adminRules && adminRules.length > 0) {
        // Get all admin user IDs
        const { data: adminRoles } = await adminSupa.from("user_roles").select("user_id").eq("role", "admin");
        const adminVars: Record<string, string> = {
          "{nome}": userProfile?.name || "",
          "{valor}": Number(payment.amount).toFixed(2),
          "{servidor}": userProfile?.iptv_server || "",
          "{data_pagamento}": new Date().toLocaleDateString("pt-BR"),
          "{validade}": "", "{plano_meses}": "",
        };
        for (const rule of adminRules) {
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
        console.log(`Admin notified about new support request from ${payment.user_id}`);
      }
    } catch (adminPushErr) {
      console.error("Failed to notify admin:", adminPushErr);
    }
  } catch (pushErr) {
    console.error("Failed to send push notification:", pushErr);
  }

  console.log(`Payment ${payment.id} confirmed. Awaiting admin activation.`);
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

      // Check iptv_payments first
      const { data: payment } = await adminSupa
        .from("iptv_payments")
        .select("*")
        .eq("pix_txid", txid)
        .single();

      if (payment) {
        if (!["pending", "pix_pending"].includes(payment.status)) {
          console.log(`Payment ${payment.id} already processed (status: ${payment.status})`);
          continue;
        }
        await confirmPaymentAndUpdateExpiry(adminSupa, payment);
        console.log(`Payment ${payment.id} confirmed via webhook`);
        continue;
      }

      // Check credit_purchases
      const { data: creditPurchase } = await adminSupa
        .from("credit_purchases")
        .select("*")
        .eq("pix_txid", txid)
        .single();

      if (creditPurchase) {
        if (creditPurchase.status !== "pending") {
          console.log(`Credit purchase ${creditPurchase.id} already processed`);
          continue;
        }
        await confirmCreditPurchase(adminSupa, creditPurchase);
        console.log(`Credit purchase ${creditPurchase.id} confirmed via webhook`);
        continue;
      }

      console.log(`No payment or credit purchase found for txid: ${txid}`);
    }

    return jsonResp({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResp({ ok: true }); // Always return 200 to Efí
  }
}

// ── Server-side background polling ──────────────────────────────────────
// Checks Efí API every 5s for up to 1 minute after charge creation.
// Runs async — does NOT block the response to the client.

function scheduleBackgroundCheck(adminSupa: any, recordId: string, txid: string, type: "iptv" | "credit") {
  // Use EdgeRuntime.waitUntil if available, otherwise fire-and-forget
  const checkLoop = async () => {
    const maxAttempts = 12; // 12 × 5s = 60s
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        // First check if still pending in DB (avoid unnecessary API calls)
        if (type === "iptv") {
          const { data: p } = await adminSupa.from("iptv_payments").select("status").eq("id", recordId).single();
          if (!p || !["pending", "pix_pending"].includes(p.status)) {
            console.log(`[BG-CHECK] IPTV payment ${recordId} already processed (${p?.status}), stopping.`);
            return;
          }
        } else {
          const { data: p } = await adminSupa.from("credit_purchases").select("status").eq("id", recordId).single();
          if (!p || p.status !== "pending") {
            console.log(`[BG-CHECK] Credit purchase ${recordId} already processed (${p?.status}), stopping.`);
            return;
          }
        }

        // Check Efí API
        const accessToken = await getAccessToken();
        const resp = await mtlsFetchWithRetry(`/v2/cob/${txid}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (resp.status >= 200 && resp.status < 300) {
          const cobData = JSON.parse(resp.body);
          console.log(`[BG-CHECK] txid ${txid} attempt ${i + 1}/${maxAttempts}: ${cobData.status}`);

          if (cobData.status === "CONCLUIDA") {
            if (type === "iptv") {
              const { data: payment } = await adminSupa.from("iptv_payments").select("*").eq("id", recordId).in("status", ["pending", "pix_pending"]).single();
              if (payment) await confirmPaymentAndUpdateExpiry(adminSupa, payment);
            } else {
              const { data: purchase } = await adminSupa.from("credit_purchases").select("*").eq("id", recordId).eq("status", "pending").single();
              if (purchase) await confirmCreditPurchase(adminSupa, purchase);
            }
            console.log(`[BG-CHECK] ${type} ${recordId} confirmed via background check!`);
            return;
          }

          if (cobData.status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || cobData.status === "REMOVIDA_PELO_PSP") {
            console.log(`[BG-CHECK] txid ${txid} was removed, stopping.`);
            return;
          }
        }
      } catch (err) {
        console.error(`[BG-CHECK] Error on attempt ${i + 1}:`, err.message);
      }
    }
    console.log(`[BG-CHECK] ${type} ${recordId} — 1 minute elapsed, no confirmation detected.`);
  };

  // Fire and forget — the response is already sent to the client
  checkLoop().catch(err => console.error(`[BG-CHECK] Fatal:`, err));
}

// ── Utils ────────────────────────────────────────────────────────────────

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
