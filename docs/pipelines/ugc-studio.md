# UGC Ads Studio

The active UGC flow uses `ugc-studio` for authenticated script and product-reference image generation. New requests do not use the archived music components or music edge functions.

## Existing billing
Stripe products, checkout, webhook fulfillment, prices, and charges were not changed. Current fulfillment remains Starter 20, Pro 100, Studio 400 monthly credits. Scripts and direct image generation require an active plan (or the existing admin bypass), without adding a new charge to these previously uncharged operations. The legacy UGC video submission charge remains one credit; the unavailable video branch never submits or consumes a credit.

## Input and output
Reusable characters are managed in Creator & setting through `ugc-studio` actions `characters-list`, `character-save`, and `character-delete`. Records in `ugc_characters` and files in the private `character-references` bucket are owner-scoped. Each character requires 1–3 PNG/JPEG/WEBP photos (10 MB maximum per photo). The selected `characterId` is resolved against the authenticated owner before generation; signed photo URLs are supplied after product references, with explicit identity-preservation instructions. Image generation and the video pipeline's initial creator frame both use these references. Saved jobs retain an identity snapshot in the draft without persisting signed URLs. Deleting a character leaves historical generated ads unchanged.

Character verification: `bun test src/components/ugc/character-rules.test.js`; signed-in three-photo upload, fourth-photo rejection, save/reload/reuse, rename, delete, mobile layout, and actual image-ad generation/readback in Library have been checked. Talking-video completion with a reusable character has not been separately verified.

Product photos upload to the existing `product-images` bucket under the authenticated user's folder. The draft contains product facts, editable scripts, creator direction, and aspect ratio. `generated_ads.ad_copy` stores the draft, social caption, product name, framework, and status. Image results use `ugc-generated`; Library notes preserve unrelated metadata.

AI scripts return three script variants and five hooks. When replacing an existing script, only the selected variant changes. The server validates counts before returning a result. No fabricated success or automatic billing retry is used.

## Video and Product Motion
Talking-creator ads use Gemini for the creator frame, Kokoro for the voiceover, and fal.ai OmniHuman for lip-sync. Product Motion is a separate lower-cost route: three distinct FLUX Kontext frames, Shotstack zoom/pan/fade finishing, timed hook/body/CTA text, and optional Kokoro narration without a talking face. Users choose 15 seconds (5 seconds per shot) or 30 seconds (10 seconds per shot). Product Motion never invokes OmniHuman or a music-generation function.

Product Motion requires `FAL_KEY` and `SHOTSTACK_API_KEY`. FLUX failures, incomplete images, and Shotstack submission failures preserve the draft and consume no plan credit. One plan credit is consumed atomically after Shotstack accepts the render; administrator bypass remains unchanged. `generated_ads.ad_copy.motion` preserves the render ID, source-frame URLs, captions, requested duration, and voiceover URL. The authenticated `video-status` action polls either Shotstack or OmniHuman according to the saved job, downloads the MP4 into `ugc-generated`, and creates the completion notification.

Product-page automatic import, word-level SRT alignment, and 60-second Product Motion output are not offered as verified capabilities. Product page URLs are stored for reference and clearly require manual details and photos.

## Verification
Run `bun test src/components/ugc/studio-rules.test.js src/components/ugc/character-rules.test.js src/components/ugc/motion-rules.test.js`. The signed-in real flow has been checked: photo upload → three AI scripts/five hooks → image generation → Library readback → saved campaign notes → new-hook duplication, plus Trash undo and the unavailable-video error. Product Motion checks cover exact 15/30-second timing, three distinct shot directions, optional voiceover, CTA/offer placement, input rejection, and one-credit enforcement. Signed-in checks confirmed the motion controls, 15-second/voiceover-off persistence across reload, enabled generation action, and no horizontal overflow at 911px. A real motion submission reached FLUX and stopped on the provider's empty balance before any frame or render was accepted; completed Product Motion playback/export remains unverified. No mock provider responses are used. Legacy music frontend files are archived under `docs/archive`; historical records and pending-job edge functions remain intact.