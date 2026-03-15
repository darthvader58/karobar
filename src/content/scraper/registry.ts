import { PlatformScraper } from "../../shared/types";

// Platform scrapers register themselves here in Task 4 by importing this array and pushing into it.
// Starts empty to avoid circular imports.
export const PLATFORM_REGISTRY: PlatformScraper[] = [];

/**
 * Returns the first PlatformScraper whose hostPattern matches the given URL,
 * or null if no match is found (or on any error).
 */
export function getScraper(url: string): PlatformScraper | null {
  try {
    return PLATFORM_REGISTRY.find((s) => s.hostPattern.test(url)) ?? null;
  } catch {
    return null;
  }
}
