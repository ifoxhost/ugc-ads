import { describe, expect, test } from "bun:test";
import { createStudioDraft, duplicateDraft } from "./studio-types";
import { applyScriptRegeneration, canGenerate, HOOK_VARIANT_COUNT, SCRIPT_VARIANT_COUNT } from "./studio-rules";
describe("UGC studio rules", () => {
  test("new ads default to 9:16", () => expect(createStudioDraft().aspectRatio).toBe("9:16"));
  test("script generation requires three variants", () => expect(SCRIPT_VARIANT_COUNT).toBe(3));
  test("hook generation requires five alternatives", () => expect(HOOK_VARIANT_COUNT).toBe(5));
  test("regenerating one variant preserves edits in others", () => {
    const original = [0,1,2].map(i => ({ angle: String(i), hook: `edited ${i}`, body: "body", cta: "Shop now", caption: "caption" }));
    const incoming = original.map(s => ({...s, hook: "new hook"}));
    const result = applyScriptRegeneration(original,incoming,1);
    expect(result.map(s=>s.hook)).toEqual(["edited 0","new hook","edited 2"]);
  });
  test("duplicate starts with a blank new hook without changing the saved ad", () => {
    const draft = createStudioDraft(); draft.scripts = [{angle:"A",hook:"Original",body:"Body",cta:"Shop",caption:"Caption"}];
    const ad = { ad_copy:{draft} };
    expect(duplicateDraft(ad)?.scripts[0].hook).toBe(""); expect(ad.ad_copy?.draft?.scripts[0].hook).toBe("Original");
  });
  test("expired subscriptions cannot generate",()=>expect(canGenerate({status:"active",renew_date:"2026-01-01",credits:20,credits_used:0},false,new Date("2026-11-01").getTime())).toBe(false));
  test("admin generation bypass survives stale subscription state",()=>expect(canGenerate(null,true)).toBe(true));
  test("exhausted credits cannot generate",()=>expect(canGenerate({status:"active",renew_date:"2027-01-01",credits:20,credits_used:20},false,new Date("2026-11-01").getTime())).toBe(false));
});