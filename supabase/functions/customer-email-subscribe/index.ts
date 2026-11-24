import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const reply = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return reply({error:"Method not allowed."},405);
 try{
  const body=await req.json();
  if(body.website) return reply({ok:true});
  const email=String(body.email||"").trim().toLowerCase();
  if(body.consent!==true || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({error:"Enter a valid email and confirm consent."},400);
  const language=["ur","ar","fr","de","es"].includes(String(body.language))?String(body.language):"en";
  const now=new Date().toISOString();
  const {data:existing,error:lookupError}=await db.from("customer_notification_preferences").select("id").ilike("email",email).limit(1).maybeSingle();
  if(lookupError) throw lookupError;
  if(existing){
   const {error}=await db.from("customer_notification_preferences").update({email,email_marketing_enabled:true,preferred_language:language,consent_updated_at:now,updated_at:now}).eq("id",existing.id);
   if(error) throw error;
  }else{
   const {error}=await db.from("customer_notification_preferences").insert({email,email_marketing_enabled:true,preferred_language:language,consent_updated_at:now});
   if(error) throw error;
  }
  return reply({ok:true});
 }catch(error){console.error("customer-email-subscribe:",error);return reply({error:"Could not save your subscription right now."},500);}
});
