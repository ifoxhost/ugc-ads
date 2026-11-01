# UGC Ads Studio revamp

## Confirmed direction
- Rename the product **UGC Ads Studio** and replace music-video creation with product-focused UGC ad creation.
- **Keep current billing:** preserve Stripe products, plan prices, allowances, subscriptions, and existing credit charges. Update the wording, not the paid entitlements.
- Preserve user accounts, saved assets, notifications, and trash. Do not delete historical projects or their stored media during cleanup.

## 1. Replace the creation experience
Rebuild `/create` as four stages using the existing UGC upload, creator, format, and gallery controls:

1. **Product & Offer:** product images, product link, name, audience, main benefit, offer, and CTA. Retain multiple product angles and support transparent PNG inputs. A product page link must be imported successfully or clearly marked for manual completion—not treated as an image URL.
2. **Script & Hooks:** generate three editable hook/body/CTA script variants and five hook alternatives using supplied product facts. Regenerate or choose a variant without discarding edits to the other variants. Avoid invented discounts, testimonials, or product claims.
3. **Creator & Setting:** gender, age, ethnicity/look, tone, background setting, ad framework, and aspect ratio; default to 9:16. Include image-ad and video-ad paths without mixing their settings.
4. **Generation & Preview:** submit real generation requests, display actual status changes, preview returned media, and download the video, script, and caption. Clearly distinguish a draft preview from a completed render.

Keep generation buttons usable for unsubscribed users, opening the existing plan dialog rather than bypassing subscription checks.

## 2. Make the UGC generation path reliable
- Reconcile the new product/script/creator fields with the existing UGC request and callback contracts.
- Verify the existing external video workflow before presenting duration, resolution, voice, or caption options as supported.
- Persist ad metadata and actual output status with the owning user's job. Ensure the Library can read back a completed job, not just display a submission confirmation.
- Check ownership, input validation, credit enforcement, duplicate submissions, provider failures, callback handling, and retry behavior without changing current charges.
- Use current image-generation capabilities for product reference imagery, passing the actual product photos rather than generating an unrelated product from text.
- Implement caption alignment and subtitle export where supported; do not claim burned-in captions, SRT, 1080p, or 60-second output until those capabilities are implemented and verified.
- Keep standalone audio-generation features removed.

## 3. Rebrand the public pages and navigation
- Replace the homepage's music carousel with product-focused vertical ad imagery, a prominent UGC Ads Studio heading, and **Create UGC Ad** / **View Ad Examples** actions.
- Showcase creator story, unboxing, problem/solution, listicle, before/after, and aesthetic routine frameworks.
- Reuse existing UGC visual assets; label illustrative examples appropriately. Remove fabricated customer counts, ratings, testimonials, and performance claims. Add real testimonials only when supplied.
- Update the header, sidebar, footer, dashboard, help/about copy, pricing descriptions, FAQ, and page metadata. Remove obsolete social links and links to nonexistent pages.
- Answer commercial-use questions accurately: user-provided assets, provider terms, and ad-platform policies still apply. Do not promise unconditional rights or guaranteed ROAS.

## 4. Align Library and Dashboard with ads
- Show product name, framework/angle, aspect ratio, creation date, actual video duration, generation status, and export actions.
- Preserve existing selection, batch export, trash, undo, and expiry behavior.
- Add **Duplicate with new hook**, reopening an editable product/script draft; generation occurs only after the user confirms.
- Add editable campaign and performance notes saved with the ad.
- Remove music-only tabs, lyric players, Suno re-slicing controls, and music regeneration actions from the active UGC experience. Keep historical assets accessible without silently converting them into UGC projects.

## 5. Retire the legacy music workflow safely
- Remove active imports and routes to music creation first.
- Archive or remove obsolete lyric/Suno/BPM frontend modules after checking all callers.
- Leave legacy stored records and functions needed to finish already-running jobs intact; do not remove shared callbacks or storage used by UGC ads.
- Consolidate ad draft, script, preview, and request handling into focused reusable UGC modules; record structural conventions in project rules.

## Technical approach
- Keep React + Vite, existing design-system controls, Lovable Cloud, and Stripe.
- Store new ad metadata in the existing `generated_ads.ad_copy` structure where appropriate, preserving unrelated metadata when saving notes or edits.
- Keep provider credentials and AI script generation server-side. Validate authenticated ownership in every new generation or mutation handler.
- Prefer realtime job subscriptions with cleanup and reconnection; show real stages rather than simulated progress or guaranteed completion times.
- Use semantic design tokens, the existing dark/coral identity, and consistent compact controls; remove decorative purple gradients and music imagery from the redesigned pages.

## Acceptance checks
- Signed-in user completes product → script → creator → generation → Library readback with real input and a real provider result.
- Test concrete rules: default 9:16, three script variants, five hook alternatives, unchanged billing, ownership isolation, and draft duplication without an automatic generation charge.
- Verify multi-image inputs, script edits, downloads, campaign-note persistence, batch actions, and unsubscribed plan dialogs.
- Check public pages and the authenticated studio at desktop and mobile sizes for overflow, missing imagery, and navigation errors.
- Run targeted tests and inspect preview errors before calling the revamp complete.

## External dependencies
The existing UGC video path calls an external automation workflow whose generation limits and output capabilities are not established by the repository. If it is unavailable or lacks required capabilities, report the specific gap rather than displaying a fake successful render. Real testimonials and marketing performance figures require supplied evidence.