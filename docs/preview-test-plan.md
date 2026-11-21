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
