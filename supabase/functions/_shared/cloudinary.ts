// Cloudinary helpers shared by the audio slicer and render pipeline.
// We treat audio as a `video` resource (Cloudinary's convention for audio).

import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

export interface CloudinaryEnv {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function readCloudinaryEnv(): CloudinaryEnv | null {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

// Cloudinary signs requests with SHA1(`<sorted_params_string><api_secret>`)
async function sign(params: Record<string, string>, apiSecret: string): Promise<string> {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const buf = new TextEncoder().encode(sorted + apiSecret);
  const hash = await stdCrypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface UploadedAudio {
  publicId: string;
  durationSec: number;
  secureUrl: string;
  bytes: number;
  format: string;
}

/**
 * Upload an audio file to Cloudinary by URL (Cloudinary fetches the remote
 * source itself — no need to stream bytes through the edge function).
 * Returns the canonical public_id and duration we need for slicing.
 */
export async function uploadAudioByUrl(
  env: CloudinaryEnv,
  sourceUrl: string,
  folder: string,
): Promise<UploadedAudio> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    folder,
    resource_type: "video", // audio is a 'video' resource in Cloudinary
    timestamp,
    unique_filename: "true",
    use_filename: "false",
  };
  const signature = await sign(params, env.apiSecret);

  const form = new FormData();
  form.append("file", sourceUrl);
  form.append("api_key", env.apiKey);
  form.append("signature", signature);
  for (const [k, v] of Object.entries(params)) form.append(k, v);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.cloudName}/video/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  return {
    publicId: String(json.public_id),
    durationSec: Number(json.duration ?? 0),
    secureUrl: String(json.secure_url),
    bytes: Number(json.bytes ?? 0),
    format: String(json.format ?? "mp3"),
  };
}

/**
 * Build a virtual transform URL for a windowed audio slice. Cloudinary
 * renders these on-demand (no extra API call). `so_X,du_Y` = start offset
 * in seconds + duration in seconds.
 */
export function sliceUrl(
  env: CloudinaryEnv,
  publicId: string,
  startSec: number,
  durationSec: number,
  format = "mp3",
): string {
  const start = Math.max(0, Math.round(startSec * 100) / 100);
  const dur = Math.max(0.1, Math.min(15, Math.round(durationSec * 100) / 100));
  return `https://res.cloudinary.com/${env.cloudName}/video/upload/so_${start},du_${dur}/${publicId}.${format}`;
}
