import { describe, expect, test } from "bun:test";
import { validateCharacterPaths, characterDirection } from "../../../supabase/functions/_shared/ugc-characters.ts";

describe("reusable character references", () => {
  test("accepts three angles but rejects a fourth", () => {
    expect(validateCharacterPaths(["user/front.png", "user/side.png", "user/back.png"], "user")).toBeNull();
    expect(validateCharacterPaths(["user/front.png", "user/side.png", "user/back.png", "user/extra.png"], "user")).toContain("Maximum 3");
  });
  test("requires at least one photo", () => expect(validateCharacterPaths([], "user")).not.toBeNull());
  test("references belong to the signed-in owner", () => {
    expect(validateCharacterPaths(["other/front.png"], "user")).not.toBeNull();
    expect(validateCharacterPaths(["user/../other.png"], "user")).not.toBeNull();
  });
  test("product and character references remain distinct", () => {
    const direction = characterDirection("Maya", 2, 3);
    expect(direction).toContain("first 2 reference images show the PRODUCT");
    expect(direction).toContain("next 3 images");
    expect(direction).toContain("SAME person");
  });
});