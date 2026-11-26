// fal.ai helpers for the UGC talking-creator video pipeline (Kokoro TTS -> OmniHuman).
export const KOKORO_MODEL = "fal-ai/kokoro/american-english";
export const OMNIHUMAN_MODEL = "fal-ai/bytedance/omnihuman/v1.5";
export function falKey(): string | null {
  const k = Deno.env.get("FAL_KEY")?.trim();
  return k && /^[^:\s]+:[^:\s]+$/.test(k) ? k : null;
}
export function redact(s: string): string {
  const k = Deno.env.get("FAL_KEY"); return k ? s.split(k).join("[FAL_KEY]") : s;
}
async function falFetch(url: string, init: RequestInit = {}) {
  const key = falKey(); if (!key) throw new Error("Video generation is not configured.");
  const res = await fetch(url, { ...init, headers: { Authorization: `Key ${key}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) { console.error("[fal]", res.status, redact(text).slice(0, 500)); const e = new Error(res.status === 403 || res.status === 402 ? "The video provider account has no balance. Top up fal.ai and try again." : `Video provider error (${res.status}).`); (e as any).providerStatus = res.status; throw e; }
  return text ? JSON.parse(text) : {};
}
export async function synthesizeVoice(text: string, voice = "af_heart"): Promise<string> {
  const out = await falFetch(`https://fal.run/${KOKORO_MODEL}`, { method: "POST", body: JSON.stringify({ prompt: text.slice(0, 3000), voice, speed: 1 }) });
  const url = out?.audio?.url; if (typeof url !== "string") throw new Error("Voiceover came back empty.");
  return url;
}
export async function submitTalkingVideo(imageUrl: string, audioUrl: string) {
  const out = await falFetch(`https://queue.fal.run/${OMNIHUMAN_MODEL}`, { method: "POST", body: JSON.stringify({ image_url: imageUrl, audio_url: audioUrl, resolution: "720p" }) });
  if (!out?.request_id) throw new Error("Video provider did not accept the job.");
  return { requestId: out.request_id as string, statusUrl: out.status_url as string, responseUrl: out.response_url as string };
}
export async function checkTalkingVideo(statusUrl: string, responseUrl: string) {
  const s = await falFetch(statusUrl);
  if (s.status === "COMPLETED") {
    const r = await falFetch(responseUrl);
    if (r?.video?.url) return { state: "done" as const, videoUrl: r.video.url as string, duration: typeof r.duration === "number" ? r.duration : null };
    return { state: "failed" as const, error: r?.detail ? redact(JSON.stringify(r.detail)).slice(0, 300) : "Video render returned no file." };
  }
  return { state: "running" as const, queuePosition: s.queue_position ?? null, status: s.status as string };
}
export const FLUX_MODEL = "fal-ai/flux-pro/kontext/max/multi";
// FLUX Kontext keeps the product from reference photos; safety_tolerance 6 is the most permissive level fal allows.
export async function generateFluxImage(prompt: string, imageUrls: string[], aspectRatio: string): Promise<string> {
  const out = await falFetch(`https://fal.run/${FLUX_MODEL}`, { method: "POST", body: JSON.stringify({ prompt: prompt.slice(0, 4000), image_urls: imageUrls.slice(0, 6), aspect_ratio: aspectRatio, num_images: 1, output_format: "jpeg", safety_tolerance: "6", enable_safety_checker: false }) });
  const url = out?.images?.[0]?.url; if (typeof url !== "string") throw new Error("FLUX returned no image.");
  return url;
}
