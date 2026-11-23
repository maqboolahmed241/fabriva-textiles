import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
const button=document.querySelector("#enable-push"),status=document.querySelector("#push-status");
const b64=(value)=>{const padding="=".repeat((4-value.length%4)%4);return Uint8Array.from(atob((value+padding).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));};
async function setup(){
 if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){status.textContent="Push notifications are not supported by this browser. Please use Chrome.";button.disabled=true;return;}
 try{
  const response=await fetch(SUPABASE_URL+"/functions/v1/customer-push",{headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});
  const config=await response.json();if(!response.ok||!config.publicKey)throw new Error(config.error||"Notification service is being prepared.");
  const registration=await navigator.serviceWorker.register("./service-worker.js");
  const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Notification permission was not granted.");
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(config.publicKey)});
  const saved=await fetch(SUPABASE_URL+"/functions/v1/customer-push",{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",subscription:subscription.toJSON()})});
  const result=await saved.json();if(!saved.ok)throw new Error(result.error||"Could not save notification preference.");
  status.textContent="Notifications are ON. We will let you know when new collections arrive.";button.textContent="Notifications enabled";button.disabled=true;
 }catch(error){status.textContent=error.message||"Could not enable notifications. Please try again.";button.disabled=false;}
}
if(button){button.addEventListener("click",setup);if(Notification.permission==="granted")status.textContent="Notifications permission is already allowed. Tap the button to finish setup.";}
