import type { DemographicOptions } from "./ModelDemographics";
export const UGC_FRAMEWORKS = ["Creator story", "Unboxing", "Problem / solution", "3 reasons why", "Before & after", "Aesthetic routine"];
export interface AdScript { angle: string; hook: string; body: string; cta: string; caption: string }
export interface StudioDraft {
  productName: string; productUrl: string; audience: string; benefit: string; offer: string; cta: string;
  productImages: string[]; scripts: AdScript[]; hooks: string[]; selectedScript: number;
  demographics: DemographicOptions; setting: string; tone: string; framework: string;
  aspectRatio: string; mediaType: "image" | "video"; imageStyle: string; customDirection: string;
}
export const createStudioDraft = (): StudioDraft => ({ productName: "", productUrl: "", audience: "", benefit: "", offer: "", cta: "Shop now", productImages: [], scripts: [], hooks: [], selectedScript: 0, demographics: { gender: "any", bodyBuild: "any", ageRange: "any", ethnicity: ["any"] }, setting: "Living room", tone: "Authentic", framework: "Creator story", aspectRatio: "9:16", mediaType: "video", imageStyle: "lifestyle", customDirection: "" });
export interface StudioMetadata { productName?: string; framework?: string; headline?: string; cta?: string; caption?: string; title?: string; draft?: StudioDraft; campaignName?: string; performanceNotes?: string; error?: string; pipelineStage?: string; [key: string]: unknown }
export interface StudioAd { id: string; user_id: string; email: string; product_image_url: string; generated_image_url: string | null; generated_video_url: string | null; ad_copy: StudioMetadata | null; aspect_ratio: string | null; style_template: string; status: string; created_at: string; completed_at: string | null; deleted_at: string | null; video_status: string | null; video_progress: number | null; video_duration: number | null; prompt_used: string | null }
export const scriptText = (s?: AdScript) => s ? [s.hook, s.body, s.cta].filter(Boolean).join("\n\n") : "";
export function duplicateDraft(ad: StudioAd): StudioDraft | null { if (!ad.ad_copy?.draft) return null; const draft = structuredClone(ad.ad_copy.draft); draft.selectedScript = 0; draft.scripts = draft.scripts.map((s, i) => i === 0 ? { ...s, hook: "" } : s); return draft; }
export function isHistorical(ad: StudioAd) { return !ad.ad_copy?.draft && (ad.prompt_used?.startsWith("SongDoe music video") || ["kinetic", "minimal", "neon", "cinematic", "waveform", "karaoke"].includes(ad.style_template)); }