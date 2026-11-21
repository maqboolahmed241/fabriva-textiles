# Currency conversion implementation notes

- Catalogue prices remain stored once in PKR.
- The exchange-rate cache stores `rate_to_pkr`: PKR value of one unit of a foreign currency. Convert PKR to local currency by dividing by this value.
- Frankfurter v2 is the proposed daily reference-rate source. PKR, AED, SAR, USD, GBP and EUR are included in its current multi-provider coverage; this must still be checked against live responses during staging tests.
- The Edge Function preserves manual overrides. Public GET requests are read-only; only an authenticated admin can trigger a refresh, preventing anonymous traffic from repeatedly triggering provider calls. A failed provider request must leave last successful rates untouched.
- Daily scheduled refresh is not configured yet. It must be added only in an isolated staging Supabase project using a protected server-side schedule/secret.
- These files are staged only in this private Git branch. The SQL migration and Edge Function have NOT been applied/deployed to the connected Supabase project because that backend is currently shared with Production.
- Frankfurter currently lists PKR as an active currency (1998–present); availability of each target quote is still checked per API response.
- Checkout still needs a separate transactional RPC revision to calculate local-currency product totals and local-currency shipping from trusted server-side data. Never accept browser-calculated totals or exchange rates.
- Do not enable checkout for a currency without a valid rate and an active destination shipping rate.
