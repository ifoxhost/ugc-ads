import type { AdScript } from "./studio-types";
export const SCRIPT_VARIANT_COUNT = 3;
export const HOOK_VARIANT_COUNT = 5;
export function applyScriptRegeneration(existing: AdScript[], incoming: AdScript[], selected: number): AdScript[] {
  if (incoming.length !== SCRIPT_VARIANT_COUNT) throw new Error("Expected three script variants");
  if (existing.length !== SCRIPT_VARIANT_COUNT) return incoming;
  return existing.map((script, index) => index === selected ? incoming[selected] : script);
}
export function canGenerate(subscription: { status: string; renew_date: string; credits: number; credits_used: number } | null, isAdmin: boolean, now = Date.now()) {
  return isAdmin || !!subscription && subscription.status === "active" && new Date(subscription.renew_date).getTime() > now && subscription.credits > subscription.credits_used;
}