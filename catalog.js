import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const message=document.querySelector("#message"),app=document.querySelector("#catalog-app"),list=document.querySelector("#product-list");
const {data:{session}}=await supabase.auth.getSession();
if(!session)location.replace("login.html");
else{
 const {data:profile,error}=await supabase.from("admin_profiles").select("is_owner,can_view_products,can_edit_products,can_change_prices").eq("user_id",session.user.id).maybeSingle();
 if(error||!profile){await supabase.auth.signOut();location.replace("login.html");}
 else if(!(profile.is_owner||profile.can_view_products||profile.can_edit_products)){message.textContent="You do not have product catalogue permission.";}
 else{message.textContent="Administrator access verified.";app.hidden=false;await loadProducts();}
}
async function call(action,extra={}){
 const {data:{session:current}}=await supabase.auth.getSession();
 const res=await fetch(SUPABASE_URL+"/functions/v1/admin-catalog",{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+current.access_token,"Content-Type":"application/json"},body:JSON.stringify({action,...extra})});
 const body=await res.json().catch(()=>({error:"Unexpected server response"}));
 if(!res.ok)throw new Error(body.error||"Request failed");return body;
}
async function loadProducts(){
 list.textContent="Loading products…";
 try{const {products=[]}=await call("list");list.replaceChildren();
 if(!products.length){list.textContent="No products added yet.";return;}
 for(const p of products){
  const row=document.createElement("article");row.className="product-row";
  const name=document.createElement("div");name.className="product-name";
  const title=p.title?.en||p.title?.ur||p.title?.ar||"Untitled product";
  const strong=document.createElement("strong");strong.textContent=title;
  const small=document.createElement("small");small.textContent=[p.audience,p.product_type,p.sku||"No SKU"].join(" · ");
  name.append(strong,small);
  const detail=document.createElement("div");detail.className="product-meta";detail.textContent=p.currency+" "+Number(p.price).toLocaleString()+" · Stock "+Number(p.stock_qty)+" "+p.unit;
  const status=document.createElement("span");status.className="product-status";status.textContent=p.is_active?"ACTIVE":"INACTIVE";
  row.append(name,detail,status);list.append(row);
 }
 }catch(e){list.textContent=e.message;}
}
document.querySelector("#refresh").addEventListener("click",loadProducts);
document.querySelector("#product-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget;const v=Object.fromEntries(new FormData(f).entries());
 const title={};for(const lang of ["en","ur","ar","fr","de","es"])if(v["title_"+lang]?.trim())title[lang]=v["title_"+lang].trim();
 const product={audience:v.audience,product_type:v.product_type,category:v.category,sku:v.sku||null,title,description:{},price:Number(v.price),sale_price:v.sale_price===""?null:Number(v.sale_price),stock_qty:Number(v.stock_qty),unit:v.unit,low_stock_threshold:Number(v.low_stock_threshold||0),is_limited_stock:f.elements.is_limited_stock.checked,is_active:f.elements.is_active.checked,image_paths:[]};
 const button=f.querySelector("button[type=submit]");button.disabled=true;button.textContent="Saving…";message.textContent="";
 try{await call("create",{product});message.textContent="Product saved successfully.";f.reset();f.elements.low_stock_threshold.value="2";f.elements.is_active.checked=true;await loadProducts();}
 catch(err){message.textContent=err.message;}
 finally{button.disabled=false;button.textContent="Save product";}
});
document.querySelector("#signout").addEventListener("click",async()=>{await supabase.auth.signOut();location.replace("login.html");});
