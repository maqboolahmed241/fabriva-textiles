import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const form = document.querySelector("#reset-form");
const message = document.querySelector("#reset-message");

try {
  // Supabase detects and exchanges the recovery token in the URL for a short-lived session.
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const hasRecoveryToken = hash.get("type") === "recovery" || query.get("type") === "recovery";
  if (!data.session || (!hasRecoveryToken && !data.session.user)) {
    throw new Error("This reset link is invalid or has expired. Request a new password reset email.");
  }
  form.hidden = false;
  message.textContent = "Reset link verified. Enter your new password below.";
} catch (error) {
  message.textContent = error?.message || "Could not verify this reset link. Request a new one.";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#password").value;
  const confirmPassword = document.querySelector("#confirm-password").value;
  if (password.length < 8) {
    message.textContent = "Use at least 8 characters for your new password.";
    return;
  }
  if (password !== confirmPassword) {
    message.textContent = "The two passwords do not match.";
    return;
  }
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  message.textContent = "Saving your new password…";
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    form.hidden = true;
    message.textContent = "Your password has been updated. You can now sign in with your new password.";
  } catch (error) {
    message.textContent = "Password update failed: " + (error?.message || "Please request a new reset link.");
  } finally {
    button.disabled = false;
  }
});
