export const MAX_CHARACTER_IMAGES = 3;

export function validateCharacterPaths(paths: string[], userId: string): string | null {
  if (paths.length < 1 || paths.length > MAX_CHARACTER_IMAGES) return "Add one to three character photos. Maximum 3 images per character.";
  if (new Set(paths).size !== paths.length) return "Choose different reference photos.";
  if (paths.some(path => !path.startsWith(`${userId}/`) || path.split("/").length !== 2 || path.includes(".."))) return "Character photos must belong to your account.";
  return null;
}

export function characterDirection(name: string, productCount: number, referenceCount: number): string {
  return `The first ${productCount} reference images show the PRODUCT only. The next ${referenceCount} images are a multi-angle character sheet of the SAME person, named ${JSON.stringify(name)}. Show this person visibly in the finished ad with their face clearly recognizable, interacting with the product. Preserve this person's facial identity, skin tone, hair, age, and distinguishing features across the generated creative. Do not blend different faces or replace this person with a generic creator. Character identity references override demographic appearance suggestions and product-only framing such as flatlay or handheld closeups. Produce one finished advertising frame, not a collage or character sheet.`;
}