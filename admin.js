import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const notice = document.querySelector("#access-message");
const content = document.querySelector("#dashboard-content");
const $ = (selector) => document.querySelector(selector);

function showError(message) {
  notice.textContent = message;
  notice.setAttribute("data-state", "error");
}
function can(profile, ...keys) {
  return profile?.is_owner === true || keys.some((key) => profile?.[key] === true);
}

try {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Could not verify your sign-in. Refresh the page and try again.");
  if (!session) {
    window.location.replace("login.html");
  } else {
    $("#admin-email").textContent = session.user.email ?? "Signed in";
    const { data: profile, error: profileError } = await supabase
      .from("admin_profiles")
      .select("role,is_owner,can_view_products,can_edit_products,can_change_prices,can_adjust_stock,can_set_limited_stock,can_change_low_stock_limit,can_view_orders,can_update_order_status,can_cancel_orders,can_manage_admins,can_manage_settings")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileError) throw new Error("Administrator permissions could not be loaded: " + profileError.message);
    if (!profile) {
      await supabase.auth.signOut();
      window.location.replace("login.html");
    } else {
      $("#role-name").textContent = profile.is_owner ? "OWNER" : (profile.role ?? "ADMIN").toUpperCase();

      const productAccess = can(profile, "can_view_products", "can_edit_products", "can_change_prices", "can_adjust_stock", "can_set_limited_stock", "can_change_low_stock_limit");
      const orderAccess = can(profile, "can_view_orders", "can_update_order_status", "can_cancel_orders");
      const teamAccess = profile.is_owner === true;
      const shippingAccess = can(profile, "can_manage_settings");

      const [productCount, orderCount] = await Promise.all([
        productAccess ? supabase.from("products").select("*", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null }),
        orderAccess ? supabase.from("orders").select("*", { count: "exact", head: true }) : Promise.resolve({ count: null, error: null })
      ]);

      $("#product-count").textContent = !productAccess ? "Restricted" : productCount.error ? "Unavailable" : String(productCount.count ?? 0);
      $("#order-count").textContent = !orderAccess ? "Restricted" : orderCount.error ? "Unavailable" : String(orderCount.count ?? 0);

      const { data: visitorStats, error: visitorStatsError } = await supabase.rpc("get_store_visitor_stats");
      $("#visitor-unique").textContent = visitorStatsError ? "Unavailable" : String(visitorStats?.unique_visitors ?? 0);
      $("#visitor-views").textContent = visitorStatsError ? "Unavailable" : String(visitorStats?.total_views ?? 0);
      $("#visitor-today").textContent = visitorStatsError ? "Unavailable" : String(visitorStats?.today_visitors ?? 0);
      $("#visitor-month").textContent = visitorStatsError ? "Unavailable" : String(visitorStats?.month_visitors ?? 0);

      $("#team-link").hidden = !teamAccess;
      $("#products-link").hidden = !productAccess;
      $("#orders-link").hidden = !orderAccess;
      $("#shipping-link").hidden = !shippingAccess;

      const visibleTools = [teamAccess, productAccess, orderAccess, shippingAccess].some(Boolean);
      if (!visibleTools) throw new Error("This administrator account has no dashboard permissions. Ask the owner to grant access.");

      notice.textContent = "Access verified. Choose a store-management section below.";
      notice.removeAttribute("data-state");
      content.hidden = false;
    }
  }
} catch (error) {
  showError(error?.message || "The dashboard could not load. Refresh and try again.");
}

$("#signout")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.replace("login.html");
});
