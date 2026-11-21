import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{...cors,"Cache-Control":"no-store"}});
const currencies:Record<string,string>={PKR:"Pakistani Rupee",USD:"US Dollar",AED:"UAE Dirham",SAR:"Saudi Riyal",GBP:"Pound Sterling",EUR:"Euro",CAD:"Canadian Dollar",AUD:"Australian Dollar",QAR:"Qatari Riyal",KWD:"Kuwaiti Dinar",OMR:"Omani Rial",BHD:"Bahraini Dinar",INR:"Indian Rupee",CNY:"Chinese Yuan",JPY:"Japanese Yen",TRY:"Turkish Lira",MYR:"Malaysian Ringgit",SGD:"Singapore Dollar",CHF:"Swiss Franc"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(!["GET","POST"].includes(req.method))return reply({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")!;
  const secretJson=Deno.env.get("SUPABASE_SECRET_KEYS");
  const secret=secretJson?JSON.parse(secretJson).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if(!url||!secret||!anon)return reply({error:"Currency service is not configured"},503);
  const adminDb=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  let actor:string|null=null;
  if(req.method==="POST"){
   const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
   if(!token)return reply({error:"Sign in required"},401);
   const authDb=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:{user},error:authError}=await authDb.auth.getUser(token);
   if(authError||!user)return reply({error:"Sign in required"},401);
   const {data:profile}=await adminDb.from("admin_profiles").select("is_owner,can_manage_settings").eq("user_id",user.id).maybeSingle();
   if(!profile||!(profile.is_owner||profile.can_manage_settings))return reply({error:"Settings permission required"},403);
   actor=user.id;
  }
  const refresh=async()=>{
   const r=await fetch("https://api.frankfurter.dev/v2/rates?base=PKR",{headers:{"Accept":"application/json"}});
   if(!r.ok)throw new Error("FX provider unavailable");
   const rows=await r.json();
   if(!Array.isArray(rows)||!rows.length)throw new Error("No exchange rates returned");
   const stamp=rows.reduce((latest:any,row:any)=>!latest||row.date>latest?row.date:latest,null);
   const entries=[{currency_code:"PKR",currency_name:currencies.PKR,rate_to_pkr:1,rate_mode:"automatic",source:"Base currency",rate_date:stamp,is_active:true,updated_at:new Date().toISOString()}];
   for(const row of rows){
    const code=String(row.quote||"").toUpperCase(),rate=Number(row.rate);
    if(!currencies[code]||!Number.isFinite(rate)||rate<=0)continue;
    entries.push({currency_code:code,currency_name:currencies[code],rate_to_pkr:1/rate,rate_mode:"automatic",source:"Frankfurter (multi-source reference rate)",rate_date:row.date,is_active:true,updated_at:new Date().toISOString()});
   }
   if(entries.length<5)throw new Error("Insufficient currency coverage from provider");
   for(const item of entries){
    const {data:existing}=await adminDb.from("currency_rates").select("rate_mode").eq("currency_code",item.currency_code).maybeSingle();
    if(existing?.rate_mode==="manual")continue;
    const {error}=await adminDb.from("currency_rates").upsert(item,{onConflict:"currency_code"});
    if(error)throw error;
   }
  };
  if(req.method==="POST"){
   const body=await req.json();
   if(body.action==="manual"){
    const code=String(body.currency_code||"").toUpperCase(),rate=Number(body.rate_to_pkr);
    if(!currencies[code]||code==="PKR"||!Number.isFinite(rate)||rate<=0||rate>10000000)return reply({error:"Choose a supported currency and enter a valid PKR-per-unit rate"},400);
    const {error}=await adminDb.from("currency_rates").upsert({currency_code:code,currency_name:currencies[code],rate_to_pkr:rate,rate_mode:"manual",source:"Admin manual override",rate_date:new Date().toISOString().slice(0,10),is_active:true,updated_at:new Date().toISOString(),updated_by:actor},{onConflict:"currency_code"});
    if(error)throw error;
   }else if(body.action==="automatic"){
    const code=String(body.currency_code||"").toUpperCase();
    if(!currencies[code])return reply({error:"Unsupported currency"},400);
    const {data:existing}=await adminDb.from("currency_rates").select("currency_code,rate_mode").eq("currency_code",code).maybeSingle();
    if(!existing)return reply({error:"No saved rate. Refresh automatic rates first."},409);
    const {error}=await adminDb.from("currency_rates").update({rate_mode:"automatic",updated_by:actor}).eq("currency_code",code);
    if(error)throw error;
    await refresh();
   }else if(body.action==="refresh"){await refresh();}
   else return reply({error:"Unsupported action"},400);
  }else{
   const {data:stale}=await adminDb.from("currency_rates").select("currency_code,updated_at").eq("rate_mode","automatic").lt("updated_at",new Date(Date.now()-20*60*60*1000).toISOString()).limit(1);
   if(stale?.length){try{await refresh();}catch{/* Last successful rates remain available; response includes their timestamp. */}}
  }
  const {data,error}=await adminDb.from("currency_rates").select("currency_code,currency_name,rate_to_pkr,rate_mode,source,rate_date,updated_at").eq("is_active",true).order("currency_code");
  if(error)throw error;
  return reply({base:"PKR",rates:data||[],provider:"Frankfurter",disclaimer:"Daily reference rates, not bank settlement or card-network rates."});
 }catch(e){return reply({error:"Currency service temporarily unavailable",detail:e instanceof Error?e.message:"Unknown error"},503);}
});
