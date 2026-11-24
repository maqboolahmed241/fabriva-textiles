import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const form = document.querySelector("#newsletter-form");
const status = document.querySelector("#newsletter-status");
const messages = {
 en: {ok:"Thank you. Your subscription has been saved.",bad:"We could not save your subscription. Please try again."},
 ur: {ok:"شکریہ! آپ کا ای میل سبسکرائب ہو گیا ہے۔",bad:"سبسکرپشن محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔"},
 ar: {ok:"شكراً لك، تم حفظ اشتراكك.",bad:"تعذر حفظ الاشتراك. حاول مرة أخرى."},
 fr: {ok:"Merci, votre inscription est enregistrée.",bad:"Impossible d’enregistrer votre inscription. Réessayez."},
 de: {ok:"Vielen Dank, Ihre Anmeldung wurde gespeichert.",bad:"Die Anmeldung konnte nicht gespeichert werden. Bitte erneut versuchen."},
 es: {ok:"Gracias, tu suscripción se ha guardado.",bad:"No se pudo guardar la suscripción. Inténtalo de nuevo."}
};
form?.addEventListener("submit", async event => {
 event.preventDefault();
 const email = document.querySelector("#newsletter-email").value.trim().toLowerCase();
 const consent = document.querySelector("#newsletter-consent").checked;
 const language = (localStorage.getItem("maryam_luxe_language_v1") || document.documentElement.lang || "en").slice(0,2);
 const copy = messages[language] || messages.en;
 if (!consent || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
  status.textContent = copy.bad; return;
 }
 const button = form.querySelector("button[type=submit]");
 button.disabled = true; status.textContent = "";
 try {
  const response = await fetch(SUPABASE_URL + "/functions/v1/customer-email-subscribe", {
   method:"POST", headers:{"Content-Type":"application/json", apikey:SUPABASE_PUBLISHABLE_KEY},
   body:JSON.stringify({email, consent:true, language})
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || "Subscription failed");
  status.textContent = copy.ok; form.reset();
 } catch (error) {
  console.error("Newsletter subscription:", error); status.textContent = copy.bad;
 } finally { button.disabled = false; }
});
