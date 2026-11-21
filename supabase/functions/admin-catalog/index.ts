import { withSupabase } from "npm:@supabase/server";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const types=["one_piece_suit","two_piece_suit","three_piece_suit","full_suit","ready_made","tshirt","jeans","trousers","pants","other"];
const units=["piece","suit","roll","pack"];
const audiences=["ladies","gents","unisex"];
const allowed=new Set(["sku","audience","category","product_type","title","description","price","currency","sale_price","stock_qty","unit","image_paths","is_active","is_limited_stock","low_stock_threshold"]);
function response(body,status=200){return Response.json(body,{status,headers:cors});}
Deno.serve(withSupabase({auth:"user"},async(req,ctx)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 const uid=ctx.userClaims?.sub;if(!uid)return response({error:"Sign in required"},401);
 const {data:p,error:pe}=await ctx.supabase.from("admin_profiles").select("*").eq("user_id",uid).maybeSingle();
 if(pe||!p)return response({error:"Administrator access required"},403);
 let b;try{b=await req.json()}catch{return response({error:"Invalid JSON"},400)}
 const db=ctx.supabaseAdmin;
 const owner=p.is_owner===true;
 const has=(k)=>owner||p[k]===true;
 const action=b.action;
 if(action==="list"){
  if(!has("can_view_products")&&!has("can_edit_products")&&!has("can_change_prices")&&!has("can_adjust_stock")&&!has("can_set_limited_stock")&&!has("can_change_low_stock_limit"))return response({error:"You do not have permission to view products"},403);
  const {data,error}=await db.from("products").select("id,sku,audience,category,product_type,title,description,price,currency,sale_price,stock_qty,unit,image_paths,is_active,is_limited_stock,low_stock_threshold,created_at,updated_at").order("created_at",{ascending:false}).limit(250);
  if(error)return response({error:"Could not load products"},500);
  return response({products:data??[]});
 }
 if(action==="create"){
  if(!has("can_edit_products")||!has("can_change_prices"))return response({error:"Product creation requires product-edit and price permissions"},403);
  const x=b.product??{};
  if(!x.title||typeof x.title!=="object"||!Object.values(x.title).some(v=>typeof v==="string"&&v.trim()))return response({error:"At least one product title is required"},400);
  if(!audiences.includes(x.audience)||!types.includes(x.product_type)||!units.includes(x.unit))return response({error:"Invalid product category, type or unit"},400);
  if(!Number.isFinite(Number(x.price))||Number(x.price)<0||!Number.isFinite(Number(x.stock_qty))||Number(x.stock_qty)<0||!Number.isInteger(Number(x.stock_qty)))return response({error:"Price and stock must be valid non-negative numbers"},400);
  const sale=x.sale_price===null||x.sale_price===undefined||x.sale_price===""?null:Number(x.sale_price);
  if(sale!==null&&(!Number.isFinite(sale)||sale<0||sale>Number(x.price)))return response({error:"Sale price must be between zero and the regular price"},400);
  const imagePaths=Array.isArray(x.image_paths)?x.image_paths.slice(0,8):[];
  if(imagePaths.some((path:unknown)=>typeof path!=="string"||!path.startsWith(uid+"/")))return response({error:"Invalid product image path"},400);
  if(!has("can_adjust_stock")&&Number(x.stock_qty)!==0)return response({error:"Stock permission is required to set an opening quantity"},403);
  if(!has("can_set_limited_stock")&&x.is_limited_stock===true)return response({error:"Limited-stock permission required"},403);
  if(!has("can_change_low_stock_limit")&&x.low_stock_threshold!==undefined&&Number(x.low_stock_threshold)!==2)return response({error:"Low-stock threshold permission required"},403);
  const threshold=has("can_change_low_stock_limit")?Math.max(0,Number(x.low_stock_threshold??2)):2;
  if(!Number.isInteger(threshold))return response({error:"Low-stock threshold must be a whole number"},400);
  const row={sku:x.sku||null,audience:x.audience,category:String(x.category??"").slice(0,100),product_type:x.product_type,title:x.title,description:x.description&&typeof x.description==="object"?x.description:{},price:Number(x.price),currency:"PKR",sale_price:sale,stock_qty:has("can_adjust_stock")?Number(x.stock_qty):0,unit:x.unit,image_paths:imagePaths,is_active:x.is_active!==false,is_limited_stock:has("can_set_limited_stock")&&x.is_limited_stock===true,low_stock_threshold:threshold};
  const {data,error}=await db.from("products").insert(row).select("id,sku,title,price,stock_qty,unit").single();
  if(error)return response({error:"Product could not be saved. Check SKU and product details."},400);
  await db.from("admin_activity_logs").insert({actor_user_id:uid,action:"create_product",entity_type:"product",entity_id:data.id,details:{sku:data.sku}});
  return response({ok:true,product:data},201);
 }
 if(action==="update"){
  const id=typeof b.id==="string"?b.id:"";if(!id)return response({error:"Product ID required"},400);
  const x=b.product??{};const patch={};
  for(const [k,v] of Object.entries(x)){
   if(!allowed.has(k))continue;
   const permission=(["price","sale_price","currency"].includes(k)?"can_change_prices":["stock_qty"].includes(k)?"can_adjust_stock":["is_limited_stock"].includes(k)?"can_set_limited_stock":["low_stock_threshold"].includes(k)?"can_change_low_stock_limit":"can_edit_products");
   if(!has(permission))return response({error:"Missing permission for field: "+k},403);
   patch[k]=v;
  }
  if(!Object.keys(patch).length)return response({error:"No permitted changes supplied"},400);
  if(patch.audience&&!audiences.includes(patch.audience)||patch.product_type&&!types.includes(patch.product_type)||patch.unit&&!units.includes(patch.unit))return response({error:"Invalid product field"},400);
  for(const k of ["price","sale_price","stock_qty","low_stock_threshold"])if(k in patch&&patch[k]!==null&&(!Number.isFinite(Number(patch[k]))||Number(patch[k])<0||(["stock_qty","low_stock_threshold"].includes(k)&&!Number.isInteger(Number(patch[k])))))return response({error:"Invalid numeric value: "+k},400);
  if("image_paths" in patch&&(!Array.isArray(patch.image_paths)||patch.image_paths.length>8||patch.image_paths.some((path:unknown)=>typeof path!=="string"||!path.startsWith(uid+"/"))))return response({error:"Invalid product image path"},400);
  if("currency" in patch&&patch.currency!=="PKR")return response({error:"Only PKR currency is currently supported"},400);
  if("price" in patch||"sale_price" in patch){const {data:currentPrice}=await db.from("products").select("price,sale_price").eq("id",id).maybeSingle();if(!currentPrice)return response({error:"Product not found"},404);const effectivePrice="price" in patch?Number(patch.price):Number(currentPrice.price);const effectiveSale="sale_price" in patch?(patch.sale_price===null?null:Number(patch.sale_price)):currentPrice.sale_price;if(effectiveSale!==null&&effectiveSale>effectivePrice)return response({error:"Sale price cannot exceed the regular price"},400);}
  const {data,error}=await db.from("products").update(patch).eq("id",id).select("id,sku,title,price,stock_qty,unit").maybeSingle();
  if(error)return response({error:"Product update failed"},400);if(!data)return response({error:"Product not found"},404);
  await db.from("admin_activity_logs").insert({actor_user_id:uid,action:"update_product",entity_type:"product",entity_id:id,details:{changed_fields:Object.keys(patch)}});
  return response({ok:true,product:data});
 }
 if(action==="delete"){
  if(!has("can_edit_products"))return response({error:"Product edit permission required"},403);
  const id=typeof b.id==="string"?b.id:"";if(!id)return response({error:"Product ID required"},400);
  const {error}=await db.from("products").delete().eq("id",id);
  if(error)return response({error:"Product could not be deleted"},400);
  await db.from("admin_activity_logs").insert({actor_user_id:uid,action:"delete_product",entity_type:"product",entity_id:id,details:{}});
  return response({ok:true});
 }
 return response({error:"Unsupported action"},400);
}));