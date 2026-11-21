# FABRIVA TEXTILES — Private Preview and Launch Readiness

Last reviewed: 2026-11-21  
Working branch: `feature/admin-orders-team`  
Production branch: `main` (do not modify or merge without explicit approval)

## Safety boundaries

- Keep this repository private.
- Do not publish GitHub Pages or another public storefront before the owner explicitly approves launch.
- Do not merge, rebase, force-push, or change `main`.
- Do not deploy migrations or Edge Functions to the shared Production Supabase project during development.
- Do not delete, rewrite, or convert existing Demo products.
- Use free resources only; do not create paid services, projects, or branches.

## Verified development status

- GitHub Actions static checks validate browser JavaScript syntax, automated Node tests, local JavaScript imports, and local HTML assets.
- These checks are not browser-based end-to-end tests and do not prove checkout, authentication, or mobile rendering works in a real browser.
- There is currently no private browser-preview deployment configured. The existing workflow runs static checks only; do not describe its URL as a live preview.
- The admin orders source expects `orders.region_name`. The staged SQL proposal adds this column and stores the checkout region. The proposal has not been applied to the shared database.
- The admin orders endpoint and its UI now include the delivery region, with customer detail masking retained.

## Read-only database snapshot (2026-11-21)

| Area | Current state |
| --- | --- |
| Products | 5 existing Demo records |
| Active products with positive stock | 0 |
| Shipping-rate records | 0 |
| Active shipping rates | 0 |
| Orders | 0 |

Do not alter the Demo records. Real products, stock quantities, and delivery rates are still needed before a genuine checkout test can be performed.

## Known admin-team recovery risks

- The current invitation cap is checked before the Auth invitation and profile insert. Two simultaneous owner invitations could race past the four-account limit. A database-transactional/serialized invitation operation is required before relying on the cap for production.
- If Auth user deletion fails after an administrator profile has been removed, the account can remain in Auth without an admin profile. The UI now refreshes team capacity after each invitation attempt, but the partial-removal case still requires owner-side Auth review.
- Do not attempt to simulate invitations or deletions against the shared Production Auth service during development.

## Required before a safe private preview

- [ ] Choose a preview method that keeps the repository and storefront private and does not require a paid plan.
- [ ] Confirm whether the preview can use an isolated backend; do not point it at shared Production for order/stock mutation tests.
- [ ] Verify all six language layouts in a real browser and at mobile widths.
- [ ] Test sign-in, admin role permissions, order listing, customer masking, shipping-rate matching, checkout, and cancellation/stock restoration.
- [ ] Verify all preview secrets and privileged keys remain server-side.

## Required before launch

- [ ] Review existing legacy `meter` / `fabric_by_meter` records and any fractional stock or order quantities; resolve explicitly rather than silently rewriting.
- [ ] Apply the guarded inventory and checkout migration only to a separately approved staging database first.
- [ ] Test atomic stock deduction and cancellation restoration in staging.
- [ ] Add real product descriptions, images, prices, supported units, and whole-number stock.
- [ ] Configure and verify delivery rates by country, region, and optional city, including free-delivery thresholds.
- [ ] Test Pakistan COD and international bank transfer flows.
- [ ] Verify admin-team invitation limits, permission changes, removal, and failure recovery.
- [ ] Obtain explicit owner approval before any Production migration, Edge Function deployment, merge to `main`, or public launch.

## Deployment dependency

The staged migration adds `orders.region_name`; deploy the matching `admin-orders` Edge Function only after that schema exists in the isolated test environment. Do not deploy the function alone against a database that lacks the column.
