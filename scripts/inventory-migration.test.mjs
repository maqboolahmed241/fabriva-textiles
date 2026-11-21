import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../docs/inventory-unit-migration.sql", import.meta.url), "utf8");
const adminCatalog = await readFile(new URL("../supabase/functions/admin-catalog/index.ts", import.meta.url), "utf8");

test("migration is clearly staging-only and stops on legacy meter products", () => {
  assert.match(sql, /Do not apply to the shared Production Supabase project/i);
  assert.match(sql, /WHERE unit = 'meter' OR product_type = 'fabric_by_meter'/);
  assert.match(sql, /Migration blocked: review and explicitly remove or reclassify legacy meter/i);
});

test("migration does not silently delete or rewrite legacy product records", () => {
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.products/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\.products\s+SET\s+unit/i);
  assert.match(sql, /fractional product stock or low-stock thresholds require owner review/i);
});

test("whole-unit constraints cover products and historical order items", () => {
  assert.match(sql, /stock_qty\s*=\s*trunc\(stock_qty\)/i);
  assert.match(sql, /low_stock_threshold\s*=\s*trunc\(low_stock_threshold\)/i);
  assert.match(sql, /quantity\s*=\s*trunc\(quantity\)/i);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS order_items_unit_check/i);
  assert.match(sql, /unit = ANY \(ARRAY\['piece', 'suit', 'roll', 'pack'\]/i);
});

test("checkout RPC rejects fractional and unsupported quantities and keeps service role only", () => {
  assert.match(sql, /v_qty<>trunc\(v_qty\)/i);
  assert.match(sql, /v_product\.unit not in \('piece','suit','roll','pack'\)/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.place_fabriva_order\(jsonb\) FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.place_fabriva_order\(jsonb\) TO service_role/i);
});

test("push subscriptions remain server-only", () => {
  assert.match(sql, /REVOKE ALL ON TABLE public\.customer_push_subscriptions FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.customer_push_subscriptions TO service_role/i);
});

test("admin catalog server validation matches the inventory policy", () => {
  assert.match(adminCatalog, /const units=\["piece","suit","roll","pack"\]/);
  assert.doesNotMatch(adminCatalog, /const units=\[[^\]]*"meter"/);
  assert.match(adminCatalog, /!Number\.isInteger\(Number\(x\.stock_qty\)\)/);
  assert.match(adminCatalog, /!Number\.isInteger\(threshold\)/);
  assert.match(adminCatalog, /\["stock_qty","low_stock_threshold"\]\.includes\(k\)&&!Number\.isInteger/);
  assert.match(adminCatalog, /withSupabase\(\{auth:"user"\}/);
});
