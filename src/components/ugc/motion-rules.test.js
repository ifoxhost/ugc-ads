import { describe, expect, test } from "bun:test";
import { buildMotionEdit, MOTION_CREDIT_COST, MOTION_SHOT_COUNT, motionCaptions, motionShotDirections, validateMotionScript } from "../../../supabase/functions/_shared/motion-ad.ts";

const script = { hook: "Meet the daily essential", body: "A simple addition to your routine", cta: "Shop now" };
const images = ["https://cdn.example.com/one.jpg", "https://cdn.example.com/two.jpg", "https://cdn.example.com/three.jpg"];

describe("Product Motion rules", () => {
  test("one motion ad costs one plan credit", () => expect(MOTION_CREDIT_COST).toBe(1));
  test("three FLUX shots fill a 30 second timeline without gaps", () => {
    const edit = buildMotionEdit(images, motionCaptions(script), null, "9:16", 30);
    expect(MOTION_SHOT_COUNT).toBe(3);
    expect(edit.timeline.tracks[1].clips.map(clip => clip.start)).toEqual([0, 10, 20]);
    expect(edit.timeline.tracks[1].clips.reduce((sum, clip) => sum + clip.length, 0)).toBe(30);
    expect(edit.timeline.tracks[1].clips.map(clip => clip.effect)).toEqual(["zoomInSlow", "zoomOutSlow", "slideRightSlow"]);
  });
  test("voiceover is omitted when the user turns it off", () => {
    const edit = buildMotionEdit(images, motionCaptions(script), null, "9:16", 15);
    expect(edit.timeline.soundtrack).toBeUndefined();
    expect(edit.timeline.tracks[1].clips[2].start + edit.timeline.tracks[1].clips[2].length).toBe(15);
  });
  test("Kokoro audio becomes the only soundtrack when enabled", () => {
    const edit = buildMotionEdit(images, motionCaptions(script), "https://cdn.example.com/voice.mp3", "16:9", 30);
    expect(edit.timeline.soundtrack).toEqual({ src: "https://cdn.example.com/voice.mp3", effect: "fadeInFadeOut", volume: 1 });
  });
  test("the CTA and verified offer appear only on the final shot", () => {
    const captions = motionCaptions(script, "Free shipping");
    expect(captions[2]).toBe("Shop now · Free shipping");
    expect(captions.slice(0, 2)).not.toContain("Shop now · Free shipping");
  });
  test("each generated FLUX image receives a distinct shot direction", () => {
    const directions = motionShotDirections(script);
    expect(directions).toHaveLength(3);
    expect(new Set(directions).size).toBe(3);
    expect(directions[2]).toContain("Shop now");
  });
  test("an incomplete or oversized script is rejected before paid generation", () => {
    expect(validateMotionScript({ ...script, body: "" })).toMatch("complete hook");
    expect(validateMotionScript({ ...script, body: "x".repeat(2001) })).toMatch("2,000");
    expect(validateMotionScript(script)).toBeNull();
  });
});
