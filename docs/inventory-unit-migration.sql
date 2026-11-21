-- FABRIVA TEXTILES — inventory unit migration proposal
-- REVIEW ONLY. Do not apply to the shared Production Supabase project.
-- Apply only to an isolated staging database after explicitly resolving legacy rows.
-- This script intentionally aborts if legacy meter/fabric_by_meter rows or fractional
-- quantities exist; it never silently rewrites historical products or order items.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE unit = 'meter' OR product_type = 'fabric_by_meter'
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: review and explicitly remove or reclassify legacy meter/fabric_by_meter products first.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE stock_qty <> trunc(stock_qty)
       OR low_stock_threshold <> trunc(low_stock_threshold)
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: fractional product stock or low-stock thresholds require owner review.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_items
    WHERE quantity <> trunc(quantity)
       OR unit NOT IN ('piece', 'suit', 'roll', 'pack')
  ) THEN
    RAISE EXCEPTION
      'Migration blocked: historical order item quantities or units require owner review.';
  END IF;
END $$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unit_check,
  ADD CONSTRAINT products_unit_check
    CHECK (unit = ANY (ARRAY['piece', 'suit', 'roll', 'pack']::text[])),
  DROP CONSTRAINT IF EXISTS products_stock_qty_check,
  ADD CONSTRAINT products_stock_qty_check
    CHECK (stock_qty >= 0 AND stock_qty = trunc(stock_qty)),
  DROP CONSTRAINT IF EXISTS products_low_stock_threshold_check,
  ADD CONSTRAINT products_low_stock_threshold_check
    CHECK (low_stock_threshold >= 0 AND low_stock_threshold = trunc(low_stock_threshold)),
  DROP CONSTRAINT IF EXISTS products_product_type_check,
  ADD CONSTRAINT products_product_type_check
    CHECK (product_type = ANY (ARRAY[
      'one_piece_suit', 'two_piece_suit', 'three_piece_suit', 'full_suit',
      'ready_made', 'tshirt', 'jeans', 'trousers', 'pants', 'other'
    ]::text[]));

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_quantity_check,
  DROP CONSTRAINT IF EXISTS order_items_unit_check,
  ADD CONSTRAINT order_items_quantity_check
    CHECK (quantity > 0 AND quantity = trunc(quantity)),
  ADD CONSTRAINT order_items_unit_check
    CHECK (unit = ANY (ARRAY['piece', 'suit', 'roll', 'pack']::text[]));


-- Replace the checkout RPC in the same isolated-staging migration.
-- The only business-rule change from the currently deployed function is that
-- every supported inventory unit is whole-number only, and unknown/legacy units
-- are rejected. The transaction and row-locking logic remain intact.

CREATE OR REPLACE FUNCTION public.place_fabriva_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_name text := nullif(btrim(p_order->>'customer_name'),'');
  v_phone text := nullif(btrim(p_order->>'phone'),'');
  v_email text := nullif(btrim(p_order->>'email'),'');
  v_country text := nullif(btrim(p_order->>'country'),'');
  v_country_code text := upper(nullif(btrim(p_order->>'country_code'),''));
  v_region text := nullif(btrim(p_order->>'region_name'),'');
  v_city text := nullif(btrim(p_order->>'city'),'');
  v_postal text := nullif(btrim(p_order->>'postal_code'),'');
  v_address text := nullif(btrim(p_order->>'address'),'');
  v_notes text := nullif(btrim(p_order->>'delivery_notes'),'');
  v_method text := lower(coalesce(p_order->>'payment_method',''));
  v_order_id uuid;
  v_order_number text;
  v_currency text := 'PKR';
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item jsonb;
  v_product record;
  v_qty numeric(12,3);
  v_price numeric(12,2);
  v_count integer := 0;
  v_rate record;
begin
  if v_name is null or length(v_name)>150 or v_phone is null or length(v_phone)>40
     or v_country is null or length(v_country)>100 or v_country_code is null or length(v_country_code)<>2
     or v_city is null or length(v_city)>100 or v_address is null or length(v_address)>500 then
    raise exception 'Please provide valid customer and delivery details' using errcode='22023';
  end if;
  if (upper(v_country)='PAKISTAN') <> (v_country_code='PK') then
    raise exception 'Country name and country code do not match' using errcode='22023';
  end if;
  if v_email is not null and (length(v_email)>254 or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$') then
    raise exception 'Invalid email address' using errcode='22023';
  end if;
  if v_method not in ('cod','bank_transfer') then raise exception 'This payment method is not enabled yet' using errcode='22023'; end if;
  if v_method='cod' and v_country_code<>'PK' then raise exception 'Cash on delivery is currently available only in Pakistan' using errcode='22023'; end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items')<1 or jsonb_array_length(p_order->'items')>30 then
    raise exception 'Cart must contain between 1 and 30 products' using errcode='22023';
  end if;

  v_order_number := 'FAB-' || to_char(clock_timestamp(),'YYMMDD') || '-' || lpad(nextval('public.fabriva_order_number_seq')::text,6,'0');
  insert into public.orders(order_number,customer_name,email,phone,country,city,postal_code,address,delivery_notes,currency,subtotal,shipping_total,total,payment_method,payment_status,order_status)
  values(v_order_number,v_name,v_email,v_phone,v_country,v_city,v_postal,v_address,v_notes,v_currency,0,0,0,v_method,'unpaid','pending')
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_order->'items') loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid product in cart' using errcode='22023';
    end if;
    begin v_qty := (v_item->>'quantity')::numeric;
    exception when others then raise exception 'Invalid product quantity' using errcode='22023'; end;
    if v_qty is null or v_qty<=0 or v_qty>10000 or v_qty<>trunc(v_qty) then
      raise exception 'Quantity must be a whole number greater than zero' using errcode='22023';
    end if;
    select id,title,product_type,unit,price,sale_price,stock_qty,currency,is_active
      into v_product from public.products where id=(v_item->>'product_id')::uuid for update;
    if not found or v_product.is_active is not true then raise exception 'A product is no longer available' using errcode='P0001'; end if;
    if v_product.currency <> 'PKR' then raise exception 'Product currency is not supported for checkout' using errcode='22023'; end if;
    if v_product.unit not in ('piece','suit','roll','pack') then
      raise exception 'This product uses an unsupported inventory unit' using errcode='22023';
    end if;
    if v_product.sale_price is not null and v_product.sale_price>v_product.price then raise exception 'Product sale price needs correction' using errcode='22023'; end if;
    if v_product.stock_qty < v_qty then raise exception 'Insufficient stock for a product in your cart' using errcode='P0001'; end if;
    v_price := coalesce(v_product.sale_price,v_product.price);
    update public.products set stock_qty=stock_qty-v_qty,updated_at=now() where id=v_product.id;
    insert into public.order_items(order_id,product_id,product_title,product_type,unit,quantity,unit_price,line_total)
    values(v_order_id,v_product.id,coalesce(v_product.title->>'en',v_product.title->>'ur','Product'),v_product.product_type,v_product.unit,v_qty,v_price,round(v_qty*v_price,2));
    v_subtotal := v_subtotal + round(v_qty*v_price,2);
    v_count := v_count+1;
  end loop;

  if v_count=0 then raise exception 'Cart is empty' using errcode='22023'; end if;
  select id,amount,currency,free_over into v_rate
  from public.shipping_rates
  where is_active=true and upper(country_code)=v_country_code
    and (
      (city_name is not null and lower(city_name)=lower(v_city))
      or
      (city_name is null and (
        lower(region_name)='all regions'
        or (v_region is not null and lower(region_name)=lower(v_region))
      ))
    )
  order by (city_name is not null) desc,
           (lower(region_name)='all regions') asc
  limit 1;
  if not found then raise exception 'Delivery is not configured for this destination yet' using errcode='P0001'; end if;
  if v_rate.currency <> v_currency then raise exception 'Shipping currency does not match product currency' using errcode='22023'; end if;
  v_shipping := case when v_rate.free_over is not null and v_subtotal>=v_rate.free_over then 0 else v_rate.amount end;
  v_total := v_subtotal+v_shipping;
  update public.orders set subtotal=v_subtotal,shipping_total=v_shipping,total=v_total where id=v_order_id;
  return jsonb_build_object('ok',true,'order_id',v_order_id,'order_number',v_order_number,'currency',v_currency,'subtotal',v_subtotal,'shipping_total',v_shipping,'total',v_total,'order_status','pending');
end;
$function$;

-- The current RPC is executable only by service_role; preserve that boundary.
REVOKE ALL ON FUNCTION public.place_fabriva_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_fabriva_order(jsonb) TO service_role;


-- Push subscriptions are server-managed and contain private browser endpoints.
-- No direct browser policy is required while writes are handled by trusted server code.
REVOKE ALL ON TABLE public.customer_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_push_subscriptions TO service_role;
