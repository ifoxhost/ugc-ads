export const MOTION_SHOT_COUNT = 3;
export const MOTION_CREDIT_COST = 1;
export const MOTION_DURATIONS = [15, 30] as const;

export type MotionDuration = typeof MOTION_DURATIONS[number];
export type MotionAspectRatio = "9:16" | "1:1" | "16:9" | "4:5";

export interface MotionScript {
  hook: string;
  body: string;
  cta: string;
}

export function validateMotionScript(script: MotionScript): string | null {
  const sections = [script.hook, script.body, script.cta];
  if (sections.some(section => !section.trim())) return "Add a complete hook, body, and CTA before creating Product Motion.";
  if (sections.some(section => section.length > 800) || sections.join(" ").length > 2000) {
    return "Shorten the selected script to 2,000 characters or less before creating Product Motion.";
  }
  return null;
}

export function motionCaptions(script: MotionScript, offer = ""): string[] {
  return [script.hook.trim(), script.body.trim(), [script.cta.trim(), offer.trim()].filter(Boolean).join(" · ")];
}

export function motionShotDirections(script: MotionScript): string[] {
  return [
    `SHOT 1 — HOOK: an immediate scroll-stopping hero composition for this exact product. Visualize this supplied hook without adding claims: ${script.hook}`,
    "SHOT 2 — PRODUCT STORY: a different camera angle and closer product-detail composition. Show the product in its real use context; do not invent results, labels, packaging, or transformations.",
    `SHOT 3 — CTA: a clean, premium final product composition with generous uncluttered space in the lower third for this supplied call to action: ${script.cta}`,
  ];
}

export function buildMotionEdit(
  imageUrls: string[],
  captions: string[],
  audioUrl: string | null,
  aspectRatio: MotionAspectRatio,
  durationSec: MotionDuration,
) {
  if (imageUrls.length !== MOTION_SHOT_COUNT || imageUrls.some(url => !/^https:\/\//.test(url))) {
    throw new Error("Product Motion needs exactly three publicly readable FLUX images.");
  }
  if (captions.length !== MOTION_SHOT_COUNT || captions.some(text => !text.trim())) {
    throw new Error("Product Motion needs hook, body, and CTA text for all three shots.");
  }
  if (!MOTION_DURATIONS.includes(durationSec)) throw new Error("Choose a 15 or 30 second Product Motion video.");

  const shotLength = durationSec / MOTION_SHOT_COUNT;
  const effects = ["zoomInSlow", "zoomOutSlow", "slideRightSlow"];
  const vertical = aspectRatio === "9:16" || aspectRatio === "4:5";
  const square = aspectRatio === "1:1";
  const textWidth = vertical ? 600 : square ? 880 : 1080;
  const textHeight = vertical ? 330 : 220;

  const imageClips = imageUrls.map((src, index) => ({
    asset: { type: "image", src },
    start: index * shotLength,
    length: shotLength,
    fit: "crop",
    effect: effects[index],
    transition: { in: "fade", out: "fade" },
  }));
  const textClips = captions.map((text, index) => ({
    asset: {
      type: "text",
      text,
      width: textWidth,
      height: textHeight,
      font: { family: "Montserrat", size: vertical ? 48 : 44, color: "#ffffff", weight: 700, lineHeight: 1.15 },
      alignment: { horizontal: "center", vertical: "center" },
      stroke: { width: 2, color: "#000000" },
      background: { color: "#000000", opacity: 0.42, padding: 22, borderRadius: 12 },
    },
    start: index * shotLength,
    length: shotLength,
    position: "bottom",
    offset: { x: 0, y: vertical ? -0.09 : -0.06 },
    transition: { in: "fade", out: "fade" },
  }));

  return {
    timeline: {
      background: "#000000",
      ...(audioUrl ? { soundtrack: { src: audioUrl, effect: "fadeInFadeOut", volume: 1 } } : {}),
      tracks: [{ clips: textClips }, { clips: imageClips }],
      cache: false,
    },
    output: { format: "mp4", resolution: "hd", aspectRatio, fps: 25 },
  };
}

function safeProviderError(status: number, body: string, apiKey: string): Error {
  const safe = body.split(apiKey).join("[REDACTED]").slice(0, 500);
  console.error("Product Motion renderer error", { status, body: safe });
  if ([401, 402, 403].includes(status)) return new Error("The motion renderer is unavailable or out of credits. Check Shotstack and try again; no plan credit was charged.");
  return new Error(`The motion renderer could not finish this ad (${status}). No plan credit was charged.`);
}

export async function submitMotionRender(apiKey: string, edit: unknown): Promise<{ renderId: string }> {
  const response = await fetch("https://api.shotstack.io/edit/v1/render", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(edit),
  });
  const text = await response.text();
  if (!response.ok) throw safeProviderError(response.status, text, apiKey);
  const payload = text ? JSON.parse(text) : {};
  const renderId = payload?.response?.id;
  if (typeof renderId !== "string" || !renderId) throw new Error("The motion renderer did not return a job. No plan credit was charged.");
  return { renderId };
}

export async function checkMotionRender(apiKey: string, renderId: string, expectedDurationSec: number) {
  const response = await fetch(`https://api.shotstack.io/edit/v1/render/${encodeURIComponent(renderId)}?data=false`, {
    headers: { "x-api-key": apiKey },
  });
  const text = await response.text();
  if (!response.ok) throw safeProviderError(response.status, text, apiKey);
  const payload = text ? JSON.parse(text) : {};
  const result = payload?.response ?? payload;
  const status = String(result?.status ?? "").toLowerCase();
  if (status === "done") {
    if (typeof result?.url !== "string" || !result.url) return { state: "failed" as const, error: "The motion renderer finished without a video file." };
    const measured = Number(result?.duration);
    return { state: "done" as const, videoUrl: result.url as string, duration: Number.isFinite(measured) && measured > 0 ? measured : expectedDurationSec };
  }
  if (["failed", "error"].includes(status)) return { state: "failed" as const, error: "The motion renderer failed. Edit the script or images and try again." };
  return { state: "running" as const, status: status || "queued", queuePosition: null };
}
