import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from "./config.js";
const button=document.querySelector("#floating-whatsapp");
if(button){
  try{
    const response=await fetch(SUPABASE_URL+"/rest/v1/rpc/get_public_whatsapp_contact",{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:"{}"});
    const phone=await response.json();
    if(response.ok&&typeof phone==="string"&&phone.length>=8){
      const lang=document.documentElement.lang||"en";
      const hello={ur:"السلام علیکم! مجھے MARYAM LUXE کے بارے میں معلومات درکار ہیں۔",ar:"السلام عليكم، أود معرفة المزيد عن MARYAM LUXE.",fr:"Bonjour, je souhaite en savoir plus sur MARYAM LUXE.",de:"Hallo, ich möchte mehr über MARYAM LUXE erfahren.",es:"Hola, me gustaría obtener más información sobre MARYAM LUXE."};
      button.href="https://wa.me/"+phone+"?text="+encodeURIComponent(hello[lang]||"Hello, I would like to know more about MARYAM LUXE.");
      button.hidden=false;
    }
  }catch(error){console.error("WhatsApp contact is unavailable",error);}
}
