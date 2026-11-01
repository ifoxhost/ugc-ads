# Project conventions
- UGC ad creation lives in focused modules under `src/components/ugc`; pages compose those modules rather than embedding music pipeline logic, keeping ad workflows independent of retired music features.
- Store UGC drafts and campaign metadata in `generated_ads.ad_copy` and preserve unrelated keys during updates so historical assets remain readable.
- Existing music edge functions remain for in-flight historical jobs; new UGC requests must not invoke music-generation entry points.
- Provider calls and entitlement checks stay in authenticated edge functions; never trust client-supplied user IDs or paid-plan claims.
- Force the local demo flag off in Vite so auth, storage, and generation always use the real client without modifying the managed client file.
- Shared ad cards and details live in `AdOutputGallery` and are used by the studio and Library, preventing divergent metadata, export, and note behavior.