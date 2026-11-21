import { withSupabase } from "npm:@supabase/server";
const permissionKeys = ["can_view_products","can_edit_products","can_change_prices","can_adjust_stock","can_set_limited_stock","can_change_low_stock_limit","can_view_orders","can_update_order_status","can_cancel_orders","can_view_customers","can_manage_settings","can_manage_admins","can_manage_campaigns","can_view_audit_logs"] as const;
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(withSupabase({auth:"user"}, async (req,ctx) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return Response.json({error:"Method not allowed"},{status:405,headers:corsHeaders});
  const userId=ctx.userClaims?.sub;
  if(!userId) return Response.json({error:"Sign-in required"},{status:401,headers:corsHeaders});
  const {data:owner,error:ownerError}=await ctx.supabase.from("admin_profiles").select("user_id,is_owner").eq("user_id",userId).maybeSingle();
  if(ownerError||!owner||owner.is_owner!==true) return Response.json({error:"Only the main owner can manage administrators"},{status:403,headers:corsHeaders});
  let body:Record<string,unknown>; try{body=await req.json()}catch{return Response.json({error:"Invalid JSON"},{status:400,headers:corsHeaders})}
  const admin=ctx.supabaseAdmin; const action=body.action;
  if(action==="list"){
    const {data:profiles,error}=await admin.from("admin_profiles").select("user_id,role,is_owner,can_view_products,can_edit_products,can_change_prices,can_adjust_stock,can_set_limited_stock,can_change_low_stock_limit,can_view_orders,can_update_order_status,can_cancel_orders,can_view_customers,can_manage_settings,can_manage_admins,can_manage_campaigns,can_view_audit_logs").order("is_owner",{ascending:false});
    if(error) return Response.json({error:"Could not load admin list"},{status:500,headers:corsHeaders});
    const {data:users}=await admin.auth.admin.listUsers({page:1,perPage:1000});
    const emailById=new Map((users?.users??[]).map((u:any)=>[u.id,u.email??""]));
    return Response.json({admins:(profiles??[]).map((p:any)=>({...p,email:emailById.get(p.user_id)??""}))},{headers:corsHeaders});
  }
  if(action==="invite"){
    const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
    if(!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({error:"A valid email address is required"},{status:400,headers:corsHeaders});
    const {count,error:countError}=await admin.from("admin_profiles").select("user_id",{count:"exact",head:true});
    if(countError) return Response.json({error:"Could not verify admin limit"},{status:500,headers:corsHeaders});
    if((count??0)>=4) return Response.json({error:"Maximum is one owner plus three additional admins"},{status:409,headers:corsHeaders});
    const permissions:Record<string,boolean>={}; for(const key of permissionKeys) permissions[key]=!!(body.permissions&&typeof body.permissions==="object"&&(body.permissions as Record<string,unknown>)[key]===true);
    const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email);
    if(inviteError||!invited.user) return Response.json({error:inviteError?.message??"Invitation failed"},{status:400,headers:corsHeaders});
    const {error:profileError}=await admin.from("admin_profiles").insert({user_id:invited.user.id,role:"admin",is_owner:false,...permissions});
    if(profileError){await admin.auth.admin.deleteUser(invited.user.id);return Response.json({error:"Could not create admin profile"},{status:500,headers:corsHeaders})}
    await admin.from("admin_activity_logs").insert({actor_user_id:userId,action:"invite_admin",entity_type:"admin_profile",entity_id:invited.user.id,details:{invited_email:email,permissions}});
    return Response.json({ok:true,invited:true},{headers:corsHeaders});
  }
  if(action==="set_permissions"){
    const targetId=typeof body.user_id==="string"?body.user_id:"";
    if(!targetId||targetId===userId)return Response.json({error:"Invalid target admin"},{status:400,headers:corsHeaders});
    const permissions:Record<string,boolean>={};for(const key of permissionKeys)permissions[key]=!!(body.permissions&&typeof body.permissions==="object"&&(body.permissions as Record<string,unknown>)[key]===true);
    const {data:target,error:targetError}=await admin.from("admin_profiles").select("user_id,is_owner").eq("user_id",targetId).maybeSingle();
    if(targetError||!target||target.is_owner)return Response.json({error:"Admin not found or protected owner"},{status:404,headers:corsHeaders});
    const {error}=await admin.from("admin_profiles").update(permissions).eq("user_id",targetId);
    if(error)return Response.json({error:"Could not update permissions"},{status:500,headers:corsHeaders});
    await admin.from("admin_activity_logs").insert({actor_user_id:userId,action:"update_admin_permissions",entity_type:"admin_profile",entity_id:targetId,details:{permissions}});
    return Response.json({ok:true},{headers:corsHeaders});
  }
  if(action==="remove"){
    const targetId=typeof body.user_id==="string"?body.user_id:"";
    if(!targetId||targetId===userId)return Response.json({error:"Invalid target admin"},{status:400,headers:corsHeaders});
    const {data:target,error:targetError}=await admin.from("admin_profiles").select("user_id,is_owner").eq("user_id",targetId).maybeSingle();
    if(targetError||!target||target.is_owner)return Response.json({error:"Admin not found or protected owner"},{status:404,headers:corsHeaders});
    const {error:deleteProfileError}=await admin.from("admin_profiles").delete().eq("user_id",targetId);
    if(deleteProfileError)return Response.json({error:"Could not remove admin profile"},{status:500,headers:corsHeaders});
    const {error:authDeleteError}=await admin.auth.admin.deleteUser(targetId);
    if(authDeleteError) return Response.json({error:"Admin profile was removed, but the auth account could not be deleted. Ask the owner to review Auth users."},{status:500,headers:corsHeaders});
    await admin.from("admin_activity_logs").insert({actor_user_id:userId,action:"remove_admin",entity_type:"admin_profile",entity_id:targetId,details:{}});
    return Response.json({ok:true},{headers:corsHeaders});
  }
  return Response.json({error:"Unsupported action"},{status:400,headers:corsHeaders});
}));