import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const VISITOR_KEY = "maryam_luxe_visitor_id_v1";
function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch (error) {
    console.warn("Visitor analytics unavailable in this browser:", error);
    return null;
  }
}
const visitorId = getVisitorId();
if (visitorId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const pagePath = location.pathname + location.search;
  supabase.rpc("record_store_visit", {
    p_visitor_id: visitorId,
    p_page_path: pagePath.slice(0, 300)
  }).then(({ error }) => {
    if (error) console.warn("Visitor count could not be recorded:", error.message);
  }).catch(error => console.warn("Visitor count could not be recorded:", error));
}
