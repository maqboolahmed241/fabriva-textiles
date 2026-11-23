import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { send, vapidPublicKey } from "jsr:@daaku/webpush@0.2.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const privateJwk=Deno.env.get("VAPID_PRIVATE_JWK"),subject=Deno.env.get("VAPID_SUBJECT");
  if(req.method==="GET"){
   if(!privateJwk)return reply({error:"Push service is not configured."},503);
   return reply({publicKey:await vapidPublicKey(JSON.parse(privateJwk))});
  }
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const body=await req.json();
  if(body.action==="subscribe"){
   const sub=body.subscription;
   if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth||!sub.endpoint.startsWith("https://"))return reply({error:"Invalid push subscription."},400);
   const {error}=await db.from("customer_push_subscriptions").upsert({endpoint:sub.endpoint,subscription:sub,user_agent:String(req.headers.get("user-agent")||"").slice(0,500),is_active:true,updated_at:new Date().toISOString()},{onConflict:"endpoint"});
   if(error)throw error;
   return reply({ok:true});
  }
  if(body.action==="send"){
   const auth=req.headers.get("Authorization")||"";
   const token=auth.replace(/^Bearer\s+/i,"");
   if(!token)return reply({error:"Sign-in required."},401);
   const {data:{user},error:userError}=await db.auth.getUser(token);
   if(userError||!user)return reply({error:"Invalid administrator session."},401);
   const {data:profile,error:profileError}=await db.from("admin_profiles").select("is_owner,can_manage_settings").eq("user_id",user.id).maybeSingle();
   if(profileError||!(profile?.is_owner||profile?.can_manage_settings))return reply({error:"Only the owner or a settings administrator can send collection notifications."},403);
   const title=String(body.title||"").trim().slice(0,90),message=String(body.body||"").trim().slice(0,220),path=String(body.url||"./shop.html");
   if(!title||!message||!path.startsWith("/")&&!path.startsWith("./")&&!path.startsWith("https://maqboolahmed241.github.io/fabriva-textiles/"))return reply({error:"Enter a title, message and a safe store link."},400);
   if(!privateJwk||!subject)return reply({error:"Push credentials are not configured."},503);
   const {data:rows,error}=await db.from("customer_push_subscriptions").select("id,endpoint,subscription").eq("is_active",true);
   if(error)throw error;
   let sent=0,failed=0;
   for(const row of rows||[]){
    try{await send(row.subscription,JSON.stringify({title,body:message,url:path}),{vapid:JSON.parse(privateJwk),subscriber:subject,ttl:60*60*24,urgency:"normal"});sent++;}
    catch(e){failed++;if(e?.permanent)await db.from("customer_push_subscriptions").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",row.id);}
   }
   return reply({ok:true,sent,failed,total:(rows||[]).length});
  }
  return reply({error:"Unknown action."},400);
 }catch(error){console.error("customer-push:",error);return reply({error:error?.message||"Notification request failed."},500);}
});
