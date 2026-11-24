import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const PUSH_URL = SUPABASE_URL + "/functions/v1/customer-push";
const EMAIL_URL = SUPABASE_URL + "/functions/v1/customer-email-subscribe";
const $ = (selector) => document.querySelector(selector);
const bell = $("#notification-bell"), toggle = $("#push-toggle"), status = $("#push-status");
const form = $("#newsletter-form"), message = $("#newsletter-message");
const language = () => ["ur","ar","fr","de","es"].includes(document.documentElement.lang) ? document.documentElement.lang : "en";
const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" };
function setPushState(enabled, text) {
  if (bell) bell.classList.toggle("is-enabled", enabled);
  if (toggle) { toggle.setAttribute("aria-pressed", String(enabled)); toggle.textContent = enabled ? "Notifications enabled" : "Enable notifications"; }
  if (status && text) status.textContent = text;
}
async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    setPushState(false, "This browser does not support web notifications. You can still subscribe by email.");
    return;
  }
  if (Notification.permission === "denied") {
    setPushState(false, "Notifications are blocked in browser settings. Email updates remain available.");
    return;
  }
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") { setPushState(false, "Notifications are off. No browser alerts will be sent."); return; }
  const keyResponse = await fetch(PUSH_URL, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
  const keyData = await keyResponse.json();
  if (!keyResponse.ok || !keyData.publicKey) throw new Error(keyData.error || "Notification service is not configured yet.");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const raw = keyData.publicKey.replace(/-/g, "+").replace(/_/g, "/");
    const padded = raw + "=".repeat((4 - raw.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  }
  const saved = await fetch(PUSH_URL, { method: "POST", headers, body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON(), language: language(), userAgent: navigator.userAgent }) });
  const result = await saved.json();
  if (!saved.ok || !result.ok) throw new Error(result.error || "Could not save notification preference.");
  setPushState(true, "Notifications are enabled on this browser. You can turn them off in browser settings.");
}
if (toggle) toggle.addEventListener("click", async () => {
  toggle.disabled = true;
  try { await enablePush(); } catch (error) { setPushState(false, error.message || "Could not enable notifications."); }
  finally { toggle.disabled = false; }
});
if (bell) bell.addEventListener("click", () => {
  if (Notification?.permission === "granted") { status && (status.textContent = "Notifications are enabled. Manage permission in your browser settings."); return; }
  toggle?.click();
});
if (form) form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  if (data.get("website")) return;
  if (!data.get("consent")) { message.textContent = "Please confirm email consent."; return; }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; message.textContent = "Saving your subscription…";
  try {
    const response = await fetch(EMAIL_URL, { method: "POST", headers, body: JSON.stringify({ email: String(data.get("email") || "").trim().toLowerCase(), consent: true, language: language(), website: "" }) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Subscription could not be saved.");
    form.reset(); message.textContent = "Thank you. Your email is subscribed to collection updates.";
  } catch (error) { message.textContent = error.message || "Email subscription is temporarily unavailable."; }
  finally { submit.disabled = false; }
});
