import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const notice=document.querySelector("#access-message");
const content=document.querySelector("#dashboard-content");
const {data:{session}}=await supabase.auth.getSession();
if(!session){window.location.replace("login.html");}
else{
 document.querySelector("#admin-email").textContent=session.user.email??"Signed in";
 const {data:profile,error}=await supabase.from("admin_profiles").select("role,is_owner,can_view_products,can_edit_products,can_change_prices,can_adjust_stock,can_set_limited_stock,can_change_low_stock_limit,can_view_orders,can_update_order_status,can_cancel_orders,can_manage_admins").eq("user_id",session.user.id).maybeSingle();
 if(error||!profile){await supabase.auth.signOut();window.location.replace("login.html");}
 else{
  document.querySelector("#role-name").textContent=profile.is_owner?"OWNER":(profile.role??"ADMIN").toUpperCase();
  if(profile.is_owner||profile.can_view_products){
   const {count,error:productError}=await supabase.from("products").select("*",{count:"exact",head:true});
   document.querySelector("#product-count").textContent=productError?"—":String(count??0);
  }else document.querySelector("#product-count").textContent="Restricted";
  if(profile.is_owner||profile.can_view_orders||profile.can_update_order_status||profile.can_cancel_orders){
   const {count,error:orderError}=await supabase.from("orders").select("*",{count:"exact",head:true});
   document.querySelector("#order-count").textContent=orderError?"—":String(count??0);
  }else document.querySelector("#order-count").textContent="Restricted";
  document.querySelector("#team-link").hidden=!profile.is_owner;#
  document.querySelector("#products-link").hidden=!(profile.is_owner||profile.can_view_products||profile.can_edit_products||profile.can_change_prices||profile.can_adjust_stock||profile.can_set_limited_stock||profile.can_change_low_stock_limit);#
  document.querySelector("#orders-link").hidden=!(profile.is_owner||profile.can_view_orders||profile.can_update_order_status||profile.can_cancel_orders);\n  notice.textContent="Access verified. Your permissions are being applied.";
  content.hidden=false;
 }
}
document.querySelector("#signout")?.addEventListener("click",async()=>{await supabase.auth.signOut();window.location.replace("login.html");});
