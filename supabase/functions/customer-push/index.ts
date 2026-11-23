import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { send, vapidPublicKey } from "jsr:@daaku/webpush@0.2.0";

// Polyfill the TypedArray base64 helpers used by the webpush package on older runtimes.
const typedArray = Uint8Array as typeof Uint8Array & {
  fromBase64?: (value: string, options?: { alphabet?: "base64" | "base64url" }) => Uint8Array;
};
if (!typedArray.fromBase64) {
  typedArray.fromBase64 = (value, options) => {
    let normalized = value.replace(/\s/g, "");
    if (options?.alphabet === "base64url") normalized = normalized.replace(/-/g, "+").replace(/_/g, "/");
    normalized += "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };
}
if (!(Uint8Array.prototype as Uint8Array & { toBase64?: (options?: { alphabet?: "base64" | "base64url"; omitPadding?: boolean }) => string }).toBase64) {
  (Uint8Array.prototype as Uint8Array & { toBase64: (options?: { alphabet?: "base64" | "base64url"; omitPadding?: boolean }) => string }).toBase64 = function (options) {
    let binary = "";
    for (const byte of this) binary += String.fromCharCode(byte);
    let encoded = btoa(binary);
    if (options?.alphabet === "base64url") encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_");
    return options?.omitPadding ? encoded.replace(/=+$/, "") : encoded;
  };
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const privateJwkText = Deno.env.get("VAPID_PRIVATE_JWK");
    const subject = Deno.env.get("VAPID_SUBJECT");

    if (req.method === "GET") {
      if (!privateJwkText) return reply({ error: "Push service is not configured." }, 503);
      return reply({ publicKey: await vapidPublicKey(JSON.parse(privateJwkText)) });
    }
    if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);

    const body = await req.json();
    if (body.action === "subscribe") {
      const sub = body.subscription;
      if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
        return reply({ error: "Invalid push subscription." }, 400);
      }
      let endpointUrl: URL;
      try {
        endpointUrl = new URL(sub.endpoint);
      } catch {
        return reply({ error: "Invalid push service endpoint." }, 400);
      }
      const host = endpointUrl.hostname;
      const supported = host === "fcm.googleapis.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host === "updates.push.services.mozilla.com" ||
        host === "web.push.apple.com" || host === "wns.windows.com";
      if (endpointUrl.protocol !== "https:" || !supported) {
        return reply({ error: "Unsupported push service endpoint." }, 400);
      }

      // Reuse an existing endpoint so repeated taps do not create duplicate consent records.
      const { data: existing, error: lookupError } = await db
        .from("customer_push_subscriptions").select("id,preference_id")
        .eq("endpoint", sub.endpoint).maybeSingle();
      if (lookupError) throw lookupError;

      let preferenceId = existing?.preference_id;
      if (preferenceId) {
        const { error } = await db.from("customer_notification_preferences")
          .update({ web_push_enabled: true, consent_updated_at: new Date().toISOString() })
          .eq("id", preferenceId);
        if (error) throw error;
      } else {
        const language = ["ur", "ar", "fr", "de", "es"].includes(String(body.language))
          ? String(body.language) : "en";
        const { data: preference, error } = await db.from("customer_notification_preferences")
          .insert({ web_push_enabled: true, consent_updated_at: new Date().toISOString(), preferred_language: language })
          .select("id").single();
        if (error) throw error;
        preferenceId = preference.id;
      }

      const { error } = await db.from("customer_push_subscriptions").upsert({
        preference_id: preferenceId,
        endpoint: sub.endpoint,
        subscription: sub,
        user_agent: String(body.userAgent || "").slice(0, 500) || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return reply({ ok: true });
    }

    if (body.action === "send") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return reply({ error: "Sign-in required." }, 401);
      const { data: { user }, error: userError } = await db.auth.getUser(token);
      if (userError || !user) return reply({ error: "Invalid administrator session." }, 401);

      const { data: profile, error: profileError } = await db.from("admin_profiles")
        .select("is_owner,can_manage_settings").eq("user_id", user.id).maybeSingle();
      if (profileError || !(profile?.is_owner || profile?.can_manage_settings)) {
        return reply({ error: "Only the owner or a settings administrator can send collection notifications." }, 403);
      }

      const title = String(body.title || "").trim().slice(0, 90);
      const message = String(body.body || "").trim().slice(0, 220);
      const destination = String(body.url || "./shop.html");
      if (!title || !message || (!destination.startsWith("/") && !destination.startsWith("./") &&
        !destination.startsWith("https://maqboolahmed241.github.io/fabriva-textiles/"))) {
        return reply({ error: "Enter a title, message and a safe store link." }, 400);
      }
      if (!privateJwkText || !subject) return reply({ error: "Push credentials are not configured." }, 503);

      const { data: rows, error } = await db.from("customer_push_subscriptions")
        .select("id,endpoint,subscription,preference_id").eq("enabled", true);
      if (error) throw error;

      let sent = 0, failed = 0;
      for (const row of rows || []) {
        try {
          await send(row.subscription, JSON.stringify({ title, body: message, url: destination }), {
            vapid: JSON.parse(privateJwkText), subscriber: subject, ttl: 86400, urgency: "normal",
          });
          sent++;
        } catch (sendError) {
          failed++;
          if ((sendError as { permanent?: boolean })?.permanent) {
            await db.from("customer_push_subscriptions")
              .update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", row.id);
            await db.from("customer_notification_preferences")
              .update({ web_push_enabled: false, updated_at: new Date().toISOString() })
              .eq("id", row.preference_id);
          }
        }
      }
      return reply({ ok: true, sent, failed, total: (rows || []).length });
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("customer-push:", error);
    return reply({ error: (error as Error)?.message || "Notification request failed." }, 500);
  }
});
