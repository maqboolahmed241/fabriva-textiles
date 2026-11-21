import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../docs/inventory-unit-migration.sql", import.meta.url), "utf8");
const adminCatalog = await readFile(new URL("../supabase/functions/admin-catalog/index.ts", import.meta.url), "utf8");
const adminOrders = await readFile(new URL("../supabase/functions/admin-orders/index.ts", import.meta.url), "utf8");
const publicCatalog = await readFile(new URL("../supabase/functions/public-catalog/index.ts", import.meta.url), "utf8");
const ownerManagement = await readFile(new URL("../supabase/functions/owner-admin-management/index.ts", import.meta.url), "utf8");
const currencyRates = await readFile(new URL("../supabase/functions/currency-rates/index.ts", import.meta.url), "utf8");
const shippingPage = await readFile(new URL("../shipping.js", import.meta.url), "utf8");
const publicCatalogSource = publicCatalog;
const storefrontSource = await readFile(new URL("../shop.js", import.meta.url), "utf8");
const homePage = await readFile(new URL("../index.html", import.meta.url), "utf8");
const translations = await readFile(new URL("../store.js", import.meta.url), "utf8");

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

test("admin orders requires an authenticated admin profile", () => {
  assert.match(adminOrders, /withSupabase\(\{ auth: "user" \}/);
  assert.match(adminOrders, /if \(!userId\).*Sign in required/s);
  assert.match(adminOrders, /if \(profileError \|\| !profile\).*Administrator access required/s);
});

test("customer private fields are masked without customer-view permission", () => {
  assert.match(adminOrders, /const canViewCustomerDetails = owner \|\| profile\.can_view_customers === true/);
  assert.match(adminOrders, /customer_name: "Restricted", email: null, phone: null/);
  assert.match(adminOrders, /address: "Customer details restricted", delivery_notes: null/);
});

test("order status changes are permission-gated and compare-and-set protected", () => {
  assert.match(adminOrders, /if \(nextStatus === "cancelled"\).*can\("can_cancel_orders"\)/s);
  assert.match(adminOrders, /can\("can_update_order_status"\)/);
  assert.match(adminOrders, /\.eq\("order_status", current\.order_status\)/);
  assert.match(adminOrders, /if \(!updated\).*Order status changed elsewhere/s);
  assert.match(adminOrders, /This order-status transition is not allowed/);
});

test("public catalogue does not disclose private stock thresholds or storage paths", () => {
  assert.doesNotMatch(publicCatalog, /low_stock_threshold/);
  assert.match(publicCatalog, /const \{image_paths:privateImagePaths,\.\.\.publicProduct\}=p/);
  assert.match(publicCatalog, /return \{\.\.\.publicProduct,images:images\.filter\(Boolean\)\}/);
});

test("storefront inventory language matches supported piece and roll units", () => {
  assert.doesNotMatch(homePage, /Fabrics by the Meter|fabric by the meter/i);
  assert.doesNotMatch(translations, /fabric by the meter|Fabrics by the Meter|میٹر کے حساب سے کپڑا|أقمشة بالمتر|Tissus au mètre|Stoffe nach Meter|Telas por metro/i);
  assert.match(homePage, /Fabric Collections/);
});

test("administrator management is owner-only and protects the owner account", () => {
  assert.match(ownerManagement, /owner\.is_owner!==true/);
  assert.match(ownerManagement, /Maximum is one owner plus three additional admins/);
  assert.match(ownerManagement, /target\.is_owner\)return Response\.json\(\{error:"Admin not found or protected owner"\}/);
  assert.match(ownerManagement, /admin\.auth\.admin\.deleteUser\(targetId\)/);
});

test("currency rate writes require a verified settings administrator", () => {
  assert.match(currencyRates, /authDb\.auth\.getUser\(token\)/);
  assert.match(currencyRates, /profile\.is_owner\|\|profile\.can_manage_settings/);
  assert.match(currencyRates, /!Number\.isFinite\(rate\)/);
  assert.match(currencyRates, /rate>10000000/);
});

test("shipping form uses shared strict validation before database writes", () => {
  assert.match(shippingPage, /import \{validateShippingRate\} from "\.\/shipping-validation\.js"/);
  assert.match(shippingPage, /validated=validateShippingRate\(/);
  assert.match(shippingPage, /\.insert\(payload\)/);
});

test("public catalogue never publishes demo or zero-stock products", () => {
  assert.match(publicCatalogSource, /Number\(p\.stock_qty\)>0&&!String\(p\.sku\?\?""\)\.startsWith\("DEMO-"\)/);
});

test("storefront sanitizes saved cart quantities against current stock", () => {
  assert.match(storefrontSource, /import \{sanitizeCart\} from "\.\/cart-validation\.js"/);
  assert.match(storefrontSource, /cart=sanitizeCart\(cart,products\)/);
});

test("checkout requires a delivery region for shipping-rate matching", () => {
  assert.match(homePage, /State \/ province \/ region<input name="region_name" required/);
  assert.match(storefrontSource, /payload\.region_name=String\(payload\.region_name\|\|""\)\.trim\(\)/);
});
