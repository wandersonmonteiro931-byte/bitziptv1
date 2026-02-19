import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Base64URL helpers ───
function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─── VAPID key generation ───
async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pubRaw = await crypto.subtle.exportKey("raw", kp.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: b64UrlEncode(pubRaw), privateKey: privJwk.d! };
}

// ─── VAPID JWT ───
async function createVapidJwt(audience: string, vapidPub: string, vapidPriv: string): Promise<string> {
  const header = b64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: now + 12 * 3600, sub: "mailto:push@bitziptv.app",
  })));
  const unsigned = `${header}.${payload}`;

  const pubBytes = b64UrlDecode(vapidPub);
  const jwk = { kty: "EC", crv: "P-256", d: vapidPriv, x: b64UrlEncode(pubBytes.slice(1, 33)), y: b64UrlEncode(pubBytes.slice(33, 65)) };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));

  return `${unsigned}.${b64UrlEncode(sig)}`;
}

// ─── HKDF helper ───
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// ─── RFC 8291 aes128gcm encryption ───
async function encryptPayload(
  sub: { p256dh: string; auth: string },
  payloadText: string
): Promise<Uint8Array> {
  const clientPubBytes = b64UrlDecode(sub.p256dh);
  const authSecret = b64UrlDecode(sub.auth);

  // 1. Generate ephemeral ECDH key pair
  const localKP = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKP.publicKey));

  // 2. Import subscriber's public key and derive shared secret
  const clientPubKey = await crypto.subtle.importKey("raw", clientPubBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecretBuf = await crypto.subtle.deriveBits({ name: "ECDH", public: clientPubKey }, localKP.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuf);

  // 3. Build "WebPush: info" context for IKM derivation
  const infoHeader = new TextEncoder().encode("WebPush: info\0");
  const keyInfo = new Uint8Array(infoHeader.length + clientPubBytes.length + localPubRaw.length);
  keyInfo.set(infoHeader, 0);
  keyInfo.set(clientPubBytes, infoHeader.length);
  keyInfo.set(localPubRaw, infoHeader.length + clientPubBytes.length);

  // 4. IKM = HKDF(salt=authSecret, ikm=sharedSecret, info=keyInfo, len=32)
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  // 5. Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  // NOTE: WebCrypto HKDF deriveBits handles the HKDF-Expand counter internally.
  // Do NOT append 0x01 — that would corrupt the derived key!
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdf(salt, ikm, cekInfo, 16);

  // 7. Nonce = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // 8. Pad payload (add delimiter byte 0x02 for final record)
  const payloadBytes = new TextEncoder().encode(payloadText);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // final record delimiter

  // 9. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, paddedPayload));

  // 10. Build aes128gcm body: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);

  const body = new Uint8Array(16 + 4 + 1 + localPubRaw.length + ciphertext.length);
  let off = 0;
  body.set(salt, off); off += 16;
  body.set(new Uint8Array(rs.buffer), off); off += 4;
  body[off] = localPubRaw.length; off += 1;
  body.set(localPubRaw, off); off += localPubRaw.length;
  body.set(ciphertext, off);

  return body;
}

// ─── Send push notification ───
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPub: string,
  vapidPriv: string
): Promise<boolean> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience, vapidPub, vapidPriv);
    const body = await encryptPayload(sub, payload);

    console.log(`[PUSH] Sending to: ${sub.endpoint.slice(0, 80)}...`);
    console.log(`[PUSH] Payload length: ${payload.length}, Encrypted body length: ${body.length}`);

    const resp = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "2419200",
        Authorization: `vapid t=${jwt}, k=${vapidPub}`,
      },
      body,
    });

    const respText = await resp.text().catch(() => "");
    console.log(`[PUSH] Response status: ${resp.status}, body: ${respText.slice(0, 200)}`);

    if (resp.status === 410 || resp.status === 404) {
      console.log(`[PUSH] Subscription expired (${resp.status})`);
      return false;
    }
    if (!resp.ok) {
      console.error(`[PUSH] Failed ${resp.status}: ${respText}`);
      return true; // Don't delete subscription on temporary errors
    }
    console.log(`[PUSH] SUCCESS - delivered to push service`);
    return true;
  } catch (err) {
    console.error("[PUSH] Send error:", err);
    return false;
  }
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // ── Get VAPID public key (no auth needed) ──
    if (action === "get_vapid_public_key") {
      let { data: vapid } = await supabaseAdmin.from("push_vapid_keys").select("public_key").limit(1).maybeSingle();
      if (!vapid) {
        const keys = await generateVapidKeys();
        const { data: inserted } = await supabaseAdmin
          .from("push_vapid_keys").insert({ public_key: keys.publicKey, private_key: keys.privateKey })
          .select("public_key").single();
        vapid = inserted;
      }
      return new Response(JSON.stringify({ public_key: vapid?.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Internal send_to_user (called by other edge functions with service-role key) ──
    if (action === "send_to_user") {
      const internalKey = req.headers.get("x-internal-key");
      if (internalKey !== supabaseServiceKey) {
        return new Response(JSON.stringify({ error: "Acesso interno não autorizado" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { user_id, title, body: notifBody, icon, url: clickUrl } = body;
      if (!user_id || !title || !notifBody) throw new Error("user_id, title e body são obrigatórios");

      const { data: vapid } = await supabaseAdmin.from("push_vapid_keys").select("*").limit(1).single();
      if (!vapid) throw new Error("VAPID keys not configured");

      const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*").eq("user_id", user_id);
      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.stringify({
        title, body: notifBody, icon: icon || "/logo-bitz.jpg",
        badge: "/logo-bitz.jpg", data: { url: clickUrl || "/" },
      });

      let sent = 0, failed = 0;
      const expired: string[] = [];
      for (const s of subs) {
        const ok = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid.public_key, vapid.private_key);
        if (ok) sent++; else { failed++; expired.push(s.endpoint); }
      }
      if (expired.length > 0) {
        await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
      }

      console.log(`[INTERNAL PUSH] user=${user_id} sent=${sent} failed=${failed}`);
      return new Response(JSON.stringify({ success: true, sent, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Send to admins (called by authenticated users) ──
    if (action === "send_to_admins") {
      const { title, body: notifBody } = body;
      if (!title || !notifBody) throw new Error("title e body são obrigatórios");

      const { data: vapid } = await supabaseAdmin.from("push_vapid_keys").select("*").limit(1).single();
      if (!vapid) throw new Error("VAPID keys not configured");

      // Get all admin user IDs
      const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = (adminRoles || []).map(r => r.user_id);
      if (adminIds.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*").in("user_id", adminIds);
      if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.stringify({
        title, body: notifBody, icon: "/logo-bitz.jpg",
        badge: "/logo-bitz.jpg", data: { url: "/admin/iptv" },
      });

      let sent = 0, failed = 0;
      const expired: string[] = [];
      for (const s of subs) {
        const ok = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid.public_key, vapid.private_key);
        if (ok) sent++; else { failed++; expired.push(s.endpoint); }
      }
      if (expired.length > 0) {
        await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
      }

      return new Response(JSON.stringify({ success: true, sent, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Auth required ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Subscribe ──
    if (action === "subscribe") {
      const { endpoint, p256dh, auth } = body;
      if (!endpoint || !p256dh || !auth) throw new Error("Dados de subscription incompletos");

      // Delete old subscriptions for this user+endpoint, then insert new
      await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", caller.id).eq("endpoint", endpoint);
      await supabaseAdmin.from("push_subscriptions").insert({ user_id: caller.id, endpoint, p256dh, auth });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Unsubscribe ──
    if (action === "unsubscribe") {
      const { endpoint } = body;
      await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", caller.id).eq("endpoint", endpoint);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Admin only: send notifications ──
    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      const { title, body: notifBody, icon, target_type, target_ids } = body;
      if (!title || !notifBody) throw new Error("title e body são obrigatórios");

      const { data: vapid } = await supabaseAdmin.from("push_vapid_keys").select("*").limit(1).single();
      if (!vapid) throw new Error("VAPID keys not configured");

      let subsQuery = supabaseAdmin.from("push_subscriptions").select("*");
      if (target_type === "user" && target_ids?.length > 0) {
        subsQuery = subsQuery.in("user_id", target_ids);
      }
      const { data: subs } = await subsQuery;

      if (!subs || subs.length === 0) {
        await supabaseAdmin.from("push_notifications").insert({
          title, body: notifBody, icon: icon || "", target_type: target_type || "all",
          target_ids: target_ids || [], sent_count: 0, failed_count: 0, sent_by: caller.id,
        });
        return new Response(JSON.stringify({ success: true, sent: 0, failed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.stringify({
        title, body: notifBody, icon: icon || "/logo-bitz.jpg",
        badge: "/logo-bitz.jpg", data: { url: "/" },
      });

      let sent = 0, failed = 0;
      const expired: string[] = [];

      // Send in parallel batches of 10
      const batchSize = 10;
      for (let i = 0; i < subs.length; i += batchSize) {
        const batch = subs.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(s => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid.public_key, vapid.private_key))
        );
        results.forEach((r, idx) => {
          if (r.status === "fulfilled" && r.value) { sent++; }
          else { failed++; expired.push(batch[idx].endpoint); }
        });
      }

      // Cleanup expired subscriptions
      if (expired.length > 0) {
        await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
      }

      await supabaseAdmin.from("push_notifications").insert({
        title, body: notifBody, icon: icon || "", target_type: target_type || "all",
        target_ids: target_ids || [], sent_count: sent, failed_count: failed, sent_by: caller.id,
      });

      return new Response(JSON.stringify({ success: true, sent, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação desconhecida: " + action);
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
