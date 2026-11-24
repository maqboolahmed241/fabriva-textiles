import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s),status=$("#newsletter-admin-status"),content=$("#newsletter-admin-content");
let session=null,subscribers=[],selected=new Set();
function say(message,error=false){status.textContent=message;status.dataset.state=error?"error":"success";}
function render(){
 const list=$("#subscriber-list");list.replaceChildren();
 $("#subscriber-count").textContent=subscribers.length+" subscribers";
 subscribers.forEach(row=>{
  const label=document.createElement("label");label.className="subscriber-row";
  const input=document.createElement("input");input.type="checkbox";input.checked=selected.has(row.id);
  input.addEventListener("change",()=>{input.checked?selected.add(row.id):selected.delete(row.id);$("#selected-count").textContent=selected.size;});
  const wrap=document.createElement("span");wrap.append(document.createTextNode(row.email||"No email"));
  const meta=document.createElement("small");meta.textContent=(row.preferred_language||"en").toUpperCase()+" · "+new Date(row.consent_updated_at||row.created_at).toLocaleDateString();wrap.append(meta);label.append(input,wrap);list.append(label);
 });
 if(!subscribers.length){const empty=document.createElement("div");empty.className="subscriber-empty";empty.textContent="No email subscribers yet. New signups will appear here.";list.append(empty);}
 $("#selected-count").textContent=selected.size;
}
async function load(){
 const {data,error}=await db.from("customer_notification_preferences").select("id,email,preferred_language,consent_updated_at,created_at").eq("email_marketing_enabled",true).not("email","is",null).order("created_at",{ascending:false});
 if(error)throw error;subscribers=data||[];selected=new Set([...selected].filter(id=>subscribers.some(s=>s.id===id)));render();
}
try{
 const {data:{session:s},error}=await db.auth.getSession();if(error)throw error;session=s;
 if(!session){location.replace("login.html");}
 else{
  const {data:p,error:pe}=await db.from("admin_profiles").select("is_owner,can_manage_campaigns").eq("user_id",session.user.id).maybeSingle();
  if(pe)throw pe;if(!p||!(p.is_owner||p.can_manage_campaigns))throw new Error("Access denied. Campaign permission is required.");
  await load();content.hidden=false;say("Access verified. Select subscribers and prepare a campaign.");
 }
}catch(e){say(e.message||"Could not load subscribers.",true);}
$("#refresh-subscribers").addEventListener("click",()=>load().catch(e=>say(e.message,true)));
$("#select-batch").addEventListener("click",()=>{
 const count=Number($("#batch-size").value),batch=subscribers.filter(s=>!selected.has(s.id)).slice(0,count);
 batch.forEach(s=>selected.add(s.id));render();
 $("#campaign-status").textContent=batch.length?batch.length+" customers selected.":"No more unselected subscribers.";
});
$("#campaign-form").addEventListener("submit",async e=>{
 e.preventDefault();
 try{
  const title=$("#campaign-title").value.trim(),message=$("#campaign-message").value.trim(),image=$("#campaign-image").value.trim(),target=$("#campaign-link").value.trim();
  const {error}=await db.from("collection_announcements").insert({title:{en:title},message:{en:message},media_type:image?"image":"link",media_url:image||null,target_url:target,status:"draft",created_by:session.user.id});
  if(error)throw error;$("#campaign-status").textContent="Campaign draft saved. Email sending remains disabled until provider verification.";
 }catch(e){$("#campaign-status").textContent="Could not save draft: "+e.message;}
});
