import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const notice = document.querySelector("#notice");
const composer = document.querySelector("#composer");
const form = document.querySelector("#push-form");
const result = document.querySelector("#result");

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  window.location.replace("login.html");
} else {
  const { data: profile, error } = await supabase
    .from("admin_profiles")
    .select("is_owner,can_manage_settings")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !(profile?.is_owner === true || profile?.can_manage_settings === true)) {
    notice.textContent = "Only the owner or a settings administrator can send customer notifications.";
    await supabase.auth.signOut();
  } else {
    notice.textContent = "Access verified. Only opted-in customers can receive these announcements.";
    composer.hidden = false;
  }
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  result.textContent = "Sending notification…";
  try {
    const { data: { session: activeSession } } = await supabase.auth.getSession();
    if (!activeSession) throw new Error("Your session has expired. Please sign in again.");
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch(SUPABASE_URL + "/functions/v1/customer-push", {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + activeSession.access_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "send", ...values })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Notification sending failed.");
    result.textContent = "Completed: " + data.sent + " sent, " + data.failed + " failed, " + data.total + " opted-in devices.";
  } catch (error) {
    result.textContent = error?.message || "Notification sending failed.";
  } finally {
    submit.disabled = false;
  }
});
