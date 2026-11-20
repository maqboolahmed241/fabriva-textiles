# FABRIVA TEXTILES

Private development repository for the FABRIVA TEXTILES international fabric and clothing store.

## Project boundaries
- This project is separate from LIBAAS E RAAHAT and all other projects.
- Do not publish or enable a public storefront until the owner explicitly approves.
- Never commit passwords, Supabase service-role keys, payment secrets, or customer personal data.

## Brand and experience
- Modern International Luxury visual direction: ivory/cream, charcoal, champagne gold.
- Languages planned: English, Urdu, Arabic, French, German, Spanish.
- Urdu and Arabic layouts must support right-to-left direction; other languages use left-to-right.
- Responsive mobile-first experience.

## Catalog scope
- Ladies: one-piece, two-piece, three-piece suits; fabric by meter; ready-made clothing.
- Gents: one-piece, two-piece, full suits; fabric by meter; ready-made clothing including T-shirts, jeans, trousers and pants.
- Product units: piece, meter, suit, roll, pack.
- No tailoring or stitching services.

## Backend
Supabase project: `fabriva-textiles-private` (Mumbai region).
Database and private product-image storage groundwork have been provisioned. Authentication, owner bootstrap, admin permissions, secure order placement, and notification delivery still require end-to-end testing before production use.

## Development safety
- Use Supabase publishable key only in browser code, protected by Row Level Security.
- Keep privileged operations server-side.
- Validate prices and totals on the server; never trust browser-submitted totals.
- Collect customer notification consent and provide opt-out/preferences.
- Do not activate real payment collection until merchant/gateway credentials and validation are complete.

## Private admin development
- `login.html`: Supabase email/password sign-in; no public sign-up.
- `admin.html`: role-aware private dashboard shell.
- `products.html`: private product catalogue form and inventory list.
- `admin-catalog` Edge Function: server-side product list/create/update/delete permission checks.
- Product table browser grants are read-only; writes go through the permission-checking Edge Function.
- Product-image bucket remains private. The product image upload UI is not yet connected.

## Current stage
Private foundation and admin/catalogue scaffold. Owner bootstrap and real-account end-to-end tests are still pending. Not a live store.