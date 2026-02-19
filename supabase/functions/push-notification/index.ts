import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push helpers using Web Crypto API
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  return {
    publicKey: base64UrlEncode(publicKeyRaw),
    privateKey: privateKeyJwk.d!,
  };
}

async function createVapidAuthHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;

  // Import private key
  const privateKeyBytes = base64UrlDecode(privateKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKey,
    x: base64UrlEncode(base64UrlDecode(publicKey).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(publicKey).slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    // Already raw format from WebCrypto
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const token = `${unsignedToken}.${base64UrlEncode(rawSig.buffer)}`;
  return token;
}

async function encryptPayload(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<{ body: Uint8Array; headers: Record<string, string> }> {
  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

  // Import subscriber's public key
  const subscriberPublicKeyBytes = base64UrlDecode(subscription.p256dh);
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw",
    subscriberPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    localKeyPair.privateKey,
    256
  );

  const authBytes = base64UrlDecode(subscription.auth);

  // HKDF for auth info
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prkeyMaterial = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);

  // PRK = HKDF-Extract(auth, shared_secret)
  const ikm = new Uint8Array(sharedSecret);
  const prkKey = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = await crypto.subtle.sign("HMAC", prkKey, authBytes);

  // Build info for content encryption key
  const cekInfo = buildInfo("aesgcm", subscriberPublicKeyBytes, new Uint8Array(localPublicKeyRaw));
  const nonceInfo = buildInfo("nonce", subscriberPublicKeyBytes, new Uint8Array(localPublicKeyRaw));

  // Derive CEK and nonce
  const prkImport = await crypto.subtle.importKey("raw", prk, { name: "HKDF" }, false, ["deriveBits"]);
  const cekBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authBytes, info: cekInfo }, prkImport, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authBytes, info: nonceInfo }, prkImport, 96);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Re-derive using salt
  const saltedPrkKey = await crypto.subtle.importKey("raw", new Uint8Array(sharedSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const saltedPrk = await crypto.subtle.sign("HMAC", saltedPrkKey, salt);

  const saltedPrkImport = await crypto.subtle.importKey("raw", saltedPrk, { name: "HKDF" }, false, ["deriveBits"]);

  // Derive aes128gcm content encryption key and nonce
  const aesKeyBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: buildAes128GcmInfo("Content-Encoding: aes128gcm\0", subscriberPublicKeyBytes, new Uint8Array(localPublicKeyRaw)) }, saltedPrkImport, 128);
  const aesNonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: buildAes128GcmInfo("Content-Encoding: nonce\0", subscriberPublicKeyBytes, new Uint8Array(localPublicKeyRaw)) }, saltedPrkImport, 96);

  // AES-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", aesKeyBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const paddedPayload = new Uint8Array(payload.length + 2);
  paddedPayload.set(new TextEncoder().encode(payload));
  paddedPayload[payload.length] = 2; // delimiter

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: aesNonceBits, tagLength: 128 }, aesKey, paddedPayload);

  // Build aes128gcm body
  const recordSize = new DataView(new ArrayBuffer(4));
  recordSize.setUint32(0, 4096);

  const localPubKeyBytes = new Uint8Array(localPublicKeyRaw);

  const body = new Uint8Array(
    salt.length + 4 + 1 + localPubKeyBytes.length + encrypted.byteLength
  );
  let offset = 0;
  body.set(salt, offset); offset += salt.length;
  body.set(new Uint8Array(recordSize.buffer), offset); offset += 4;
  body[offset] = localPubKeyBytes.length; offset += 1;
  body.set(localPubKeyBytes, offset); offset += localPubKeyBytes.length;
  body.set(new Uint8Array(encrypted), offset);

  return {
    body,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "2419200",
    },
  };
}

function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\0`);
  const p256dhBytes = encoder.encode("P-256\0");

  const info = new Uint8Array(
    typeBytes.length + p256dhBytes.length +
    2 + clientPublicKey.length +
    2 + serverPublicKey.length
  );

  let offset = 0;
  info.set(typeBytes, offset); offset += typeBytes.length;
  info.set(p256dhBytes, offset); offset += p256dhBytes.length;
  info[offset] = 0; info[offset + 1] = clientPublicKey.length; offset += 2;
  info.set(clientPublicKey, offset); offset += clientPublicKey.length;
  info[offset] = 0; info[offset + 1] = serverPublicKey.length; offset += 2;
  info.set(serverPublicKey, offset);

  return info;
}

function buildAes128GcmInfo(label: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  return new TextEncoder().encode(label);
}

// Simplified push sending using fetch with VAPID
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createVapidAuthHeader(
      audience,
      "mailto:push@bitziptv.app",
      vapidPublicKey,
      vapidPrivateKey
    );

    const encrypted = await encryptPayload(subscription, payload);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        ...encrypted.headers,
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: encrypted.body,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired, should be removed
      return false;
    }

    return response.ok || response.status === 201;
  } catch (err) {
    console.error("Push send error:", err);
    return false;
  }
}

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

    // Actions that don't require auth
    if (action === "get_vapid_public_key") {
      let { data: vapid } = await supabaseAdmin
        .from("push_vapid_keys")
        .select("public_key")
        .limit(1)
        .maybeSingle();

      if (!vapid) {
        // Generate VAPID keys on first request
        const keys = await generateVapidKeys();
        const { data: inserted } = await supabaseAdmin
          .from("push_vapid_keys")
          .insert({ public_key: keys.publicKey, private_key: keys.privateKey })
          .select("public_key")
          .single();
        vapid = inserted;
      }

      return new Response(JSON.stringify({ public_key: vapid?.public_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth required actions
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

    if (action === "subscribe") {
      const { endpoint, p256dh, auth } = body;
      if (!endpoint || !p256dh || !auth) throw new Error("Dados de subscription incompletos");

      // Upsert subscription
      await supabaseAdmin.from("push_subscriptions").upsert(
        { user_id: caller.id, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unsubscribe") {
      const { endpoint } = body;
      await supabaseAdmin.from("push_subscriptions").delete()
        .eq("user_id", caller.id)
        .eq("endpoint", endpoint);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-only actions
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

      // Get VAPID keys
      const { data: vapid } = await supabaseAdmin
        .from("push_vapid_keys")
        .select("*")
        .limit(1)
        .single();
      if (!vapid) throw new Error("VAPID keys not configured");

      // Get subscriptions based on target
      let subscriptionsQuery = supabaseAdmin.from("push_subscriptions").select("*");
      if (target_type === "user" && target_ids?.length > 0) {
        subscriptionsQuery = subscriptionsQuery.in("user_id", target_ids);
      }
      const { data: subscriptions } = await subscriptionsQuery;

      if (!subscriptions || subscriptions.length === 0) {
        // Log notification even with no subs
        await supabaseAdmin.from("push_notifications").insert({
          title, body: notifBody, icon: icon || "", target_type: target_type || "all",
          target_ids: target_ids || [], sent_count: 0, failed_count: 0, sent_by: caller.id,
        });
        return new Response(JSON.stringify({ success: true, sent: 0, failed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.stringify({
        title,
        body: notifBody,
        icon: icon || "/logo-bitz.jpg",
        badge: "/logo-bitz.jpg",
        data: { url: "/" },
      });

      let sent = 0;
      let failed = 0;
      const expiredEndpoints: string[] = [];

      for (const sub of subscriptions) {
        const success = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapid.public_key,
          vapid.private_key
        );
        if (success) {
          sent++;
        } else {
          failed++;
          expiredEndpoints.push(sub.endpoint);
        }
      }

      // Clean up expired subscriptions
      if (expiredEndpoints.length > 0) {
        await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
      }

      // Log notification
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
