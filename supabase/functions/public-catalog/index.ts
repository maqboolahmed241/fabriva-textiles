import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};
function reply(body:unknown,status=200){return Response.json(body,{status,headers:{...cors,"Cache-Control":"public, max-age=60"}});}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="GET")return reply({error:"Method not allowed"},405);
 try{
  const secretJson=Deno.env.get("SUPABASE_SECRET_KEYS");
  const secret=secretJson?JSON.parse(secretJson).default:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url=Deno.env.get("SUPABASE_URL");
  if(!url||!secret)return reply({error:"Catalogue service is not configured"},503);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.from("products").select("id,sku,audience,category,product_type,title,description,price,currency,sale_price,stock_qty,unit,image_paths,is_limited_stock").eq("is_active",true).order("created_at",{ascending:false}).limit(100);
  if(error)return reply({error:"Could not load the catalogue"},500);
  const visible=(data??[]).filter(p=>Number(p.stock_qty)>0&&!String(p.sku??"").startsWith("DEMO-"));
  const products=await Promise.all(visible.map(async(p)=>{
   const images=await Promise.all((p.image_paths??[]).slice(0,4).map(async(path:string)=>{
    const {data:signed}=await db.storage.from("fabriva-product-images").createSignedUrl(path,3600);
    return signed?.signedUrl??null;
   }));
   const {image_paths:privateImagePaths,...publicProduct}=p;
   return {...publicProduct,images:images.filter(Boolean)};
  }));
  return reply({products});
 }catch{return reply({error:"Catalogue temporarily unavailable"},500);}
});