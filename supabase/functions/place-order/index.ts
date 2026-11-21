import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function reply(body:unknown,status=200){return Response.json(body,{status,headers:{...cors,"Cache-Control":"no-store"}});}
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const raw=await req.text();
  if(raw.length>20000)return reply({error:"Request too large"},413);
  const body=JSON.parse(raw);
  if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"Invalid request"},400);
  if(typeof body.website==="string"&&body.website.trim())return reply({error:"Request rejected"},400);
  const secretJson=Deno.env.get("SUPABASE_SECRET_KEYS");
  const secret=secretJson?JSON.parse(secretJson).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url=Deno.env.get("SUPABASE_URL");
  if(!url||!secret)return reply({error:"Checkout is not configured"},503);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0].trim()||req.headers.get("cf-connecting-ip")||"unknown";
  const ipHash=await sha256(forwarded);
  const {data:allowed,error:limitError}=await db.rpc("consume_fabriva_checkout_rate_limit",{p_ip_hash:ipHash});
  if(limitError)return reply({error:"Checkout is temporarily unavailable"},503);
  if(allowed!==true)return reply({error:"Too many order attempts. Please wait 10 minutes and try again."},429);
  const {data,error}=await db.rpc("place_fabriva_order",{p_order:body});
  if(error){
   const clientError=["22023","P0001"].includes(error.code);
   return reply({error:clientError?error.message:"Could not place your order. Please try again."},clientError?400:500);
  }
  return reply(data,201);
 }catch{return reply({error:"Checkout is temporarily unavailable"},500);}
});