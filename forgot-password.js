import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const form = document.querySelector("#recovery-form");
const message = document.querySelector("#recovery-message");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]");
  const email = document.querySelector("#email").value.trim();
  button.disabled = true;
  message.textContent = "Sending secure reset link…";
  try {
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    message.textContent = "If this email belongs to an administrator account, a password reset link has been sent. Check your inbox and spam folder.";
    form.reset();
  } catch (error) {
    message.textContent = "Could not send the reset email: " + (error?.message || "Please try again.");
  } finally {
    button.disabled = false;
  }
});
