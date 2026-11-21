# FABRIVA TEXTILES Preview QA checklist

Use this checklist only on the Cloudflare Pages Preview deployment for `feature/admin-orders-team`. Do not test against Production.

## Access and admin safety
- [ ] Preview access gate accepts only the authorized test account.
- [ ] Signed-out visitors are redirected to login before admin content is shown.
- [ ] Non-admin account cannot open admin pages or invoke admin actions.
- [ ] Owner and delegated admin see only the tools permitted by their profile.
- [ ] Sign-out clears the session and returns to login.

## Delivery settings
- [ ] Existing delivery-rate rows load and display the correct country, region, city, currency and amount.
- [ ] Inactive rates remain inactive until explicitly enabled.
- [ ] Add, activate and deactivate actions report errors without silently succeeding.
- [ ] Do not insert real delivery charges until the owner confirms them.

## Currency rates
- [ ] Currency page handles missing/unavailable currency table gracefully.
- [ ] Public rate read exposes only active rates and no private data.
- [ ] Manual rate requires a supported currency and positive finite value.
- [ ] Manual override is retained during automatic refresh.
- [ ] Switching a currency back to automatic succeeds only if the provider supplies a fresh quote; otherwise the manual rate remains.
- [ ] Provider failure preserves last successful rates and reports stale data.
- [ ] Daily refresh schedule is configured and verified in the isolated staging backend.

## Shop and checkout
- [ ] Pakistan displays PKR and Pakistan checkout retains existing behavior.
- [ ] Foreign-country selection maps to the intended local currency.
- [ ] Product prices, cart subtotal, shipping, and final total use one consistent currency.
- [ ] Server recomputes all prices, FX rates, stock, and shipping; browser totals are ignored.
- [ ] Order stores currency and rate snapshot for later audit.
- [ ] No real order is placed during QA; use a dedicated staging database and disposable test products.

## Release gate
- [ ] No console errors on mobile or desktop.
- [ ] No horizontal overflow at common mobile widths.
- [ ] All critical buttons tested.
- [ ] Preview build and backend integration both pass.
- [ ] Owner explicitly approves before Production deployment.

## Current known blockers
- Supabase is currently shared with Production; do not apply the currency migration or deploy new functions there.
- A separate staging Supabase project/database is required for end-to-end checkout testing.
- Cloudflare Preview URL must be copied from the latest Pages deployment for this branch; do not guess or construct it.

## Automated checks
- [x] GitHub Actions JavaScript syntax check passed for all root-level browser JavaScript files on commit `64ca0c9c92705b35ca44aaada86b6b9612316ac1`.
- [x] GitHub Actions local HTML script and stylesheet reference check passed on the same commit.
- [ ] These static checks do not prove that Supabase authentication, database writes, checkout, stock updates, or mobile browser behavior work end-to-end.


## Inventory unit consistency — pending isolated database migration
- [x] Product editor no longer offers fabric-by-meter as a product type.
- [x] Product editor offers only piece, suit, roll and pack units.
- [x] Inventory and low-stock inputs use whole-number steps in the browser.
- [x] Demo catalogue uses piece-based quantities; its cart remains local and checkout is disabled.
- [ ] Database still permits the legacy `meter` unit and fractional numeric quantities. Do not claim the meter workflow is fully removed until a reviewed migration removes `meter` from the unit constraint and a safe policy for existing rows is applied.
- [ ] Review existing products and order_items for legacy meter units before applying any schema constraint change. Do not silently rewrite historical order records.
- [ ] Apply and verify the inventory-unit migration only in an isolated free test database; do not alter the shared Production Supabase project.
- [ ] Test create/edit/list/cart/order quantity validation with whole-number piece, suit, roll and pack units.


## Inventory validation follow-up — feature branch
- [x] Browser inventory payload now rejects unsupported units (`meter`) and accepts only piece, suit, roll and pack.
- [x] Browser inventory payload rejects fractional or negative stock and low-stock thresholds before any upload or API write.
- [ ] Mirror these checks in the `admin-catalog` Edge Function and database constraints before enabling writes; the currently deployed shared Supabase function still accepts `meter` and fractional stock.
- [ ] Mirror whole-unit validation in `place_fabriva_order`; its current database function still permits fractional quantities for `roll` and `pack` (it only checks piece, suit and pack in the inspected definition).
- [ ] Do not deploy either backend change or apply migrations to the shared Production Supabase project. Verify only in an isolated staging database.


## Backend source and schema migration — feature branch only
- [x] Captured the currently deployed public-catalog, admin-catalog, place-order, admin-orders and owner-admin-management Edge Function source under `supabase/functions/` for version control.
- [x] Feature-branch `admin-catalog` source rejects the legacy meter unit, fractional stock and fractional low-stock thresholds; it also removes the retired fabric_by_meter product type.
- [x] The current `place-order` Edge Function wrapper is now version-controlled; it delegates order creation to the database RPC.
- [ ] The guarded database migration adds whole-number and supported-unit constraints to `order_items`, so fractional roll/pack quantities and legacy meter order items are rejected at the database layer.
- [ ] These Edge Function source changes are not deployed to the shared Supabase project. Deploy only after isolated staging tests.
- [ ] Database migration is intentionally held outside `supabase/migrations/` until the owner decides how to handle existing Demo products that use `meter` / `fabric_by_meter`.
- [ ] Current shared database has three zero-stock Demo fabric products with `unit=meter` and `product_type=fabric_by_meter`; migration preflight must stop rather than silently convert or delete them.


## Cancellation and push-subscription security review
- [x] Verified the live `restore_fabriva_stock_on_cancel` trigger is enabled on `orders` and its SECURITY DEFINER function restores each linked product's quantity only when an order transitions into `cancelled`. No test orders existed, so the trigger has not been exercised with a real order.
- [x] Confirmed `customer_push_subscriptions` currently has zero rows and RLS enabled with no policies, so direct browser access is denied by RLS.
- [x] Found broad table grants for `anon` and `authenticated` despite the no-policy RLS barrier. The staging migration proposal now explicitly revokes those grants and keeps access to `service_role` only.
- [ ] Verify push subscription insert/read/delete flows through a trusted Edge Function before enabling customer notifications.
- [ ] Run cancellation restoration tests against isolated staging products and orders; never create test orders in the shared Production database.
