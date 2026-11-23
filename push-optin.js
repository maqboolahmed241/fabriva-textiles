import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
const button=document.querySelector("#enable-push"),status=document.querySelector("#push-status");
const decodeKey=value=>{const pad="=".repeat((4-value.length%4)%4);return Uint8Array.from(atob((value+pad).replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));};
async function enable(){button.disabled=true;try{
 if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))throw new Error("This browser does not support push notifications. Please use Chrome.");
 const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error("Please allow notifications in your browser settings.");
 status.textContent="Setting up notifications…";
 const response=await fetch(SUPABASE_URL+"/functions/v1/customer-push",{headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});const config=await response.json();if(!response.ok||!config.publicKey)throw new Error(config.error||"Notification service is unavailable.");
 const registration=await navigator.serviceWorker.register("./service-worker.js");let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(config.publicKey)});
 const saved=await fetch(SUPABASE_URL+"/functions/v1/customer-push",{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({action:"subscribe",subscription:subscription.toJSON(),language:document.documentElement.lang||"en",userAgent:navigator.userAgent})});const result=await saved.json();if(!saved.ok)throw new Error(result.error||"Could not save your notification preference.");
 status.textContent="Notifications are enabled. We will alert you when a new collection arrives.";button.textContent="Notifications enabled";
 }catch(error){status.textContent=error.message||"Could not enable notifications. Please try again.";button.disabled=false;}}
if(button){button.addEventListener("click",enable);if("Notification" in window&&Notification.permission==="granted")status.textContent="Permission already allowed. Tap the button to complete setup.";}
