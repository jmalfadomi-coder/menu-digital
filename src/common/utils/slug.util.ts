import slugify from 'slugify';

/**
 * Generates a URL-safe slug from a string.
 * "La Bella Pizza" → "la-bella-pizza"
 */
export function generateSlug(input: string): string {
  return slugify(input, {
    lower: true,
    strict: true,   // removes non-alphanumeric chars (except hyphens)
    trim: true,
  });
}

/**
 * Ensures uniqueness by appending a random 4-char suffix if the base slug
 * already exists. The check function should query the DB.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = generateSlug(base);
  let attempt = 0;

  while (await exists(candidate)) {
    attempt++;
    candidate = `${generateSlug(base)}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 10) {
      throw new Error(`Could not generate a unique slug for: ${base}`);
    }
  }

  return candidate;
}
