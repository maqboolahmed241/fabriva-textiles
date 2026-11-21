import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function reply(body:unknown,status=200){return Response.json(body,{status,headers:{...cors,"Cache-Control":"no-store"}});}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const form=await req.formData();
  const file=form.get("receipt");
  const trap=form.get("website");
  if(typeof trap==="string"&&trap.trim())return reply({error:"Request rejected"},400);
  if(!(file instanceof File))return reply({error:"Please select a receipt image."},400);
  if(file.size<1||file.size>5*1024*1024)return reply({error:"Receipt image must be 5 MB or smaller."},400);
  const types:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  const ext=types[file.type]; if(!ext)return reply({error:"Only JPG, PNG or WebP receipt images are accepted."},400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const sig=Array.from(bytes.slice(0,12));
  const valid=file.type==="image/jpeg"?sig[0]===255&&sig[1]===216&&sig[2]===255:file.type==="image/png"?sig.slice(0,8).join(",")==="137,80,78,71,13,10,26,10":sig[0]===82&&sig[1]===73&&sig[2]===70&&sig[8]===87&&sig[9]===69&&sig[10]===66&&sig[11]===80;
  if(!valid)return reply({error:"The selected file is not a valid image."},400);
  const secretJson=Deno.env.get("SUPABASE_SECRET_KEYS");
  const secret=secretJson?JSON.parse(secretJson).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url=Deno.env.get("SUPABASE_URL"); if(!url||!secret)return reply({error:"Receipt upload is not configured."},503);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const ip=req.headers.get("x-forwarded-for")?.split(",")[0].trim()||"unknown";
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip));
  const ipHash=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
  const {data:allowed,error:limitError}=await db.rpc("consume_fabriva_checkout_rate_limit",{p_ip_hash:ipHash});
  if(limitError||allowed!==true)return reply({error:"Too many upload attempts. Please try again later."},429);
  const path=`receipts/${crypto.randomUUID()}.${ext}`;
  const {error}=await db.storage.from("maryam-payment-receipts").upload(path,bytes,{contentType:file.type,upsert:false});
  if(error)return reply({error:"Could not securely save the receipt. Please try again."},500);
  return reply({ok:true,path});
 }catch{return reply({error:"Receipt upload failed. Please try again."},500);}
});