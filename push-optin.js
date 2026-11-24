import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const button = document.querySelector("#enable-push");
const status = document.querySelector("#push-status");

function decodeKey(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function enablePush() {
  button.disabled = true;
  status.textContent = "Setting up notifications…";
  try {
    if (!window.isSecureContext || !("serviceWorker" in navigator) ||
        !("PushManager" in window) || !("Notification" in window)) {
      throw new Error("Please open this website in an updated browser over HTTPS.");
    }
    if (Notification.permission === "denied") {
      throw new Error("Notifications are blocked. Allow them in your browser's site settings first.");
    }
    if (await Notification.requestPermission() !== "granted") {
      throw new Error("Please allow notifications to continue.");
    }

    const configResponse = await fetch(SUPABASE_URL + "/functions/v1/customer-push", {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store"
    });
    const config = await configResponse.json();
    if (!configResponse.ok || !config.publicKey) {
      throw new Error(config.error || "The notification service is not configured.");
    }

    await navigator.serviceWorker.register("./service-worker.js");
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(config.publicKey)
      });
    }

    const saved = await fetch(SUPABASE_URL + "/functions/v1/customer-push", {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "subscribe",
        subscription: subscription.toJSON(),
        language: document.documentElement.lang || "en",
        userAgent: navigator.userAgent
      })
    });
    const result = await saved.json();
    if (!saved.ok) throw new Error(result.error || "Could not save your notification preference.");

    status.textContent = "Notifications enabled. You will receive new collection alerts.";
    button.textContent = "Notifications enabled";
  } catch (error) {
    status.textContent = error.message || "Could not enable notifications.";
    button.disabled = false;
  }
}

if (button && status) button.addEventListener("click", enablePush);
