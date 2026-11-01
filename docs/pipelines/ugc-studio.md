# UGC Ads Studio

The active UGC flow uses `ugc-studio` for authenticated script and product-reference image generation. New requests do not use the archived music components or music edge functions.

## Existing billing
Stripe products, checkout, webhook fulfillment, prices, and charges were not changed. Current fulfillment remains Starter 20, Pro 100, Studio 400 monthly credits. Scripts and direct image generation require an active plan (or the existing admin bypass), without adding a new charge to these previously uncharged operations. The legacy UGC video submission charge remains one credit; the unavailable video branch never submits or consumes a credit.

## Input and output
Product photos upload to the existing `product-images` bucket under the authenticated user's folder. The draft contains product facts, editable scripts, creator direction, and aspect ratio. `generated_ads.ad_copy` stores the draft, social caption, product name, framework, and status. Image results use `ugc-generated`; Library notes preserve unrelated metadata.

AI scripts return three script variants and five hooks. When replacing an existing script, only the selected variant changes. The server validates counts before returning a result. No fabricated success or automatic billing retry is used.

## Video integration blocker
The old UGC automation URL returned an instance-level 404 during a non-mutating check. Its exact-script, creator, caption, duration, resolution, idempotency, and signed-callback contracts are unavailable. The new studio returns `UGC_VIDEO_UNAVAILABLE`, preserves the draft, and charges nothing. A live UGC automation endpoint and its request/callback contract are required before enabling video submission. Do not reuse the legacy callback's caller-controlled signature bypass.

Product-page automatic import, burned-in captions, SRT alignment, 1080p guarantees, and 60-second output are not offered as verified capabilities. Product page URLs are stored for reference and clearly require manual details and photos.

## Verification
Run `bun test src/components/ugc/studio-rules.test.ts`. The signed-in real flow has been checked: photo upload → three AI scripts/five hooks → image generation → Library readback → saved campaign notes → new-hook duplication. No mock provider responses are used. Legacy music frontend files are archived under `docs/archive`; historical records and pending-job edge functions remain intact.