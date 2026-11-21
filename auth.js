import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const form=document.querySelector("#login-form");
const message=document.querySelector("#login-message");
form?.addEventListener("submit",async(event)=>{
 event.preventDefault(); message.textContent="Signing in…";
 const email=document.querySelector("#email").value.trim();
 const password=document.querySelector("#password").value;
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error){message.textContent="Sign-in failed. Check your email and password, then try again.";return;}
 const {data:profile,error:profileError}=await supabase.from("admin_profiles").select("user_id,is_owner,role").eq("user_id",data.user.id).maybeSingle();
 if(profileError||!profile){await supabase.auth.signOut();message.textContent="This account has not been approved as a MARYAM LUXE administrator.";return;}
 window.location.replace("admin.html");
});
const {data:{session}}=await supabase.auth.getSession();
if(session) window.location.replace("admin.html");
