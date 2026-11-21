import { withSupabase } from "npm:@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const validStatuses = ["pending", "processing", "packed", "shipped", "delivered", "cancelled"];
const transitions: Record<string, string[]> = {
  pending: ["processing", "packed", "cancelled"],
  processing: ["packed", "shipped", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};
function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}
Deno.serve(withSupabase({ auth: "user" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const userId = ctx.userClaims?.sub;
  if (!userId) return reply({ error: "Sign in required" }, 401);
  const { data: profile, error: profileError } = await ctx.supabase
    .from("admin_profiles")
    .select("is_owner,can_view_orders,can_update_order_status,can_cancel_orders,can_view_customers")
    .eq("user_id", userId).maybeSingle();
  if (profileError || !profile) return reply({ error: "Administrator access required" }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON" }, 400); }
  const db = ctx.supabaseAdmin;
  const owner = profile.is_owner === true;
  const can = (key: "can_view_orders" | "can_update_order_status" | "can_cancel_orders") => owner || profile[key] === true;
  const action = body.action;
  const canViewCustomerDetails = owner || profile.can_view_customers === true;
  const protectCustomer = (order: Record<string, unknown>) => canViewCustomerDetails ? order : ({ ...order, customer_name: "Restricted", email: null, phone: null, postal_code: null, address: "Customer details restricted", delivery_notes: null });

  if (action === "list") {
    if (!can("can_view_orders") && !can("can_update_order_status") && !can("can_cancel_orders")) return reply({ error: "Order-view permission required" }, 403);
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));
    let query = db.from("orders")
      .select("id,order_number,customer_name,email,phone,country,region_name,city,postal_code,address,delivery_notes,currency,subtotal,shipping_total,total,payment_method,payment_status,order_status,created_at")
      .order("created_at", { ascending: false }).limit(limit);
    if (typeof body.status === "string" && validStatuses.includes(body.status)) query = query.eq("order_status", body.status);
    if (body.region === "pakistan") query = query.ilike("country", "Pakistan");
    if (body.region === "international") query = query.not("country", "ilike", "Pakistan");
    const { data: orders, error } = await query;
    if (error) return reply({ error: "Could not load orders" }, 500);
    const ids = (orders ?? []).map((o: { id: string }) => o.id);
    let items: Array<{ order_id: string }> = [];
    if (ids.length) {
      const { data, error: itemsError } = await db.from("order_items")
        .select("id,order_id,product_id,product_title,product_type,unit,quantity,unit_price,line_total")
        .in("order_id", ids);
      if (itemsError) return reply({ error: "Could not load order items" }, 500);
      items = (data ?? []) as Array<{ order_id: string }>;
    }
    const grouped = new Map<string, unknown[]>();
    for (const item of items) grouped.set(item.order_id, [...(grouped.get(item.order_id) ?? []), item]);
    return reply({ orders: (orders ?? []).map((order: { id: string; country: string }) => ({
      ...protectCustomer(order as unknown as Record<string, unknown>),
      region: order.country?.trim().toLowerCase() === "pakistan" ? "pakistan" : "international",
      items: grouped.get(order.id) ?? [],
    })) });
  }

  if (action === "get") {
    if (!can("can_view_orders")) return reply({ error: "Order-view permission required" }, 403);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return reply({ error: "Order ID required" }, 400);
    const { data: order, error } = await db.from("orders")
      .select("id,order_number,customer_name,email,phone,country,region_name,city,postal_code,address,delivery_notes,currency,subtotal,shipping_total,total,payment_method,payment_status,order_status,created_at")
      .eq("id", id).maybeSingle();
    if (error) return reply({ error: "Could not load order" }, 500);
    if (!order) return reply({ error: "Order not found" }, 404);
    const { data: items, error: itemsError } = await db.from("order_items")
      .select("id,order_id,product_id,product_title,product_type,unit,quantity,unit_price,line_total")
      .eq("order_id", id);
    if (itemsError) return reply({ error: "Could not load order items" }, 500);
    return reply({ order: { ...protectCustomer(order as unknown as Record<string, unknown>), region: order.country?.trim().toLowerCase() === "pakistan" ? "pakistan" : "international", items: items ?? [] } });
  }

  if (action === "set_status") {
    const id = typeof body.id === "string" ? body.id : "";
    const nextStatus = typeof body.status === "string" ? body.status : "";
    if (!id || !validStatuses.includes(nextStatus)) return reply({ error: "Valid order ID and status are required" }, 400);
    if (nextStatus === "cancelled") {
      if (!can("can_cancel_orders")) return reply({ error: "Order-cancellation permission required" }, 403);
    } else if (!can("can_update_order_status")) return reply({ error: "Order-status permission required" }, 403);

    const { data: current, error: currentError } = await db.from("orders")
      .select("id,order_number,order_status").eq("id", id).maybeSingle();
    if (currentError) return reply({ error: "Could not verify current order status" }, 500);
    if (!current) return reply({ error: "Order not found" }, 404);
    if (current.order_status === nextStatus) return reply({ ok: true, unchanged: true, status: nextStatus });
    if (!(transitions[current.order_status] ?? []).includes(nextStatus)) return reply({ error: "This order-status transition is not allowed" }, 409);

    const { data: updated, error: updateError } = await db.from("orders")
      .update({ order_status: nextStatus }).eq("id", id).eq("order_status", current.order_status)
      .select("id,order_number,order_status").maybeSingle();
    if (updateError) return reply({ error: "Could not update order status" }, 500);
    if (!updated) return reply({ error: "Order status changed elsewhere. Refresh and try again." }, 409);

    await db.from("admin_activity_logs").insert({
      actor_user_id: userId, action: "update_order_status", entity_type: "order", entity_id: id,
      details: { order_number: current.order_number, from: current.order_status, to: nextStatus },
    });
    return reply({ ok: true, order: updated });
  }
  return reply({ error: "Unsupported action" }, 400);
}));
