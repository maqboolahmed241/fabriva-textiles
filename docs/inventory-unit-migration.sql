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
  ADD CONSTRAINT order_items_quantity_check
    CHECK (quantity > 0 AND quantity = trunc(quantity)),
  ADD CONSTRAINT order_items_unit_check
    CHECK (unit = ANY (ARRAY['piece', 'suit', 'roll', 'pack']::text[]));
