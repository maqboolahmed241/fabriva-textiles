# FABRIVA TEXTILES

Private development repository for the FABRIVA TEXTILES international fabric and clothing store.

## Project boundaries
- This project is separate from LIBAAS E RAAHAT and all other projects.
- Do not publish or enable a public storefront until critical QA is complete.
- Never commit passwords, Supabase service-role keys, payment secrets, or customer personal data.

## Brand and experience
- Modern international luxury direction: ivory/cream, charcoal, champagne gold.
- Languages: English, Urdu, Arabic, French, German, Spanish.
- Urdu and Arabic layouts support right-to-left direction; other languages use left-to-right.
- Responsive mobile-first experience.

## Catalog scope
- Ladies: one-piece, two-piece, three-piece suits; fabric by meter; ready-made clothing.
- Gents: one-piece, two-piece, full suits; fabric by meter; ready-made clothing including T-shirts, jeans, trousers and pants.
- Product units: piece, meter, suit, roll, pack.
- No tailoring or stitching services.

## Backend
Supabase project: `fabriva-textiles-private` (Mumbai region).
- Private product-image bucket with restricted admin upload and signed public-catalogue image URLs.
- Owner profile and role-based admin permissions are provisioned.
- Admin catalogue, order-management and owner-team Edge Functions are active.
- Public catalogue returns active products with stock available.
- `place-order` Edge Function accepts checkout requests; server-side database transaction validates products and shipping, calculates totals, writes order items and immediately deducts stock.
- Order cancellation restores the deducted stock through a protected database trigger.
- Checkout is limited to PKR totals and COD (Pakistan) or manual bank transfer; no online card/payment gateway is connected.
- Checkout has a private hashed-IP attempt limiter and a honeypot field.

## Development safety
- Use the Supabase publishable key only in browser code.
- Keep privileged operations server-side and protect customer personal data.
- Validate prices, stock and totals on the server; never trust browser-submitted totals.
- Do not activate real payment collection until merchant/gateway credentials and validation are complete.
- Keep preview and production access restricted until security and functional tests pass.

## Private admin development
- `login.html`: Supabase email/password sign-in; no public sign-up.
- `admin.html`: role-aware private dashboard.
- `products.html`: private product catalogue and inventory form, including private photo upload.
- `orders.html`: separate Pakistan and international orders, permission-aware customer details and status changes.
- `team.html`: owner-only invitation and permission management.
- Product writes and order operations are performed server-side with permission checks.

## Current stage
Checkout and immediate stock deduction have been implemented in the private feature branch and Supabase backend. **End-to-end checkout is not yet verified.** Current database has no real products and no shipping rates, so a real checkout cannot succeed until the owner enters actual product details, images and destination-specific delivery rates. Payment instructions, international currency handling, cancellation/restock and order receipt messaging still require review and tests. The storefront remains private and is not launched.
