import { DetectionResult } from "../../shared/types";
import {
  KNOWN_PLATFORM_PATTERNS,
  matchKnownPlatform,
  KnownPlatformPattern,
} from "./platforms";
import { signalJsonLd, signalOpenGraph, signalUrlAndForm } from "./signals";

/**
 * Converts a Chrome match pattern string (e.g. "https://*.example.com/jobs/*")
 * into a KnownPlatformPattern with platform: "custom".
 *
 * Returns null if the pattern cannot be parsed.
 */
export function chromePatternToKnownPlatform(
  pattern: string
): KnownPlatformPattern | null {
  try {
    // Chrome match pattern format: scheme://host/path
    // We support http, https, and * schemes
    const schemeMatch = pattern.match(/^(\*|https?):\/\/(.+?)(\/.*)$/);
    if (!schemeMatch) return null;

    const hostPart = schemeMatch[2];
    const pathPart = schemeMatch[3];

    if (!hostPart || !pathPart) return null;

    // Build hostname regex: escape dots, replace * with .*
    const escapedHost = hostPart
      .replace(/\./g, "\\.")   // escape literal dots
      .replace(/\*/g, ".*");   // wildcards become .*
    const hostnameRegex = new RegExp(`^${escapedHost}$`, "i");

    // Build path regex: escape special chars except *, then replace * with .*
    const escapedPath = pathPart
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape regex specials (not *)
      .replace(/\*/g, ".*");                   // wildcards become .*
    const pathRegex = new RegExp(`^${escapedPath}`, "i");

    return {
      platform: "custom",
      hostname: hostnameRegex,
      pathPattern: pathRegex,
    };
  } catch {
    return null;
  }
}

/**
 * Main Detector orchestrator.
 *
 * Applies the three-signal priority pipeline with short-circuit logic:
 *   Signal 1 — Known_Platform URL match (custom patterns first, then built-ins)
 *   Signal 2 — JSON-LD JobPosting or Open Graph job meta tags
 *   Signal 3 — URL path heuristic + form presence
 *
 * Requirements: 1.1, 1.4, 1.5, 1.6, 7.2
 */
export async function detect(): Promise<DetectionResult> {
  const notFound: DetectionResult = {
    isJobPage: false,
    platform: null,
    confidence: "low",
    previewTitle: "",
    previewCompany: "",
  };

  try {
    // --- Load custom patterns from chrome.storage.sync ---
    let customPatterns: KnownPlatformPattern[] = [];
    try {
      const result = await new Promise<{ customPatterns?: string[] }>(
        (resolve) => {
          chrome.storage.sync.get("customPatterns", (data) => {
            resolve(data as { customPatterns?: string[] });
          });
        }
      );
      const rawPatterns: string[] = result.customPatterns ?? [];
      for (const raw of rawPatterns) {
        const converted = chromePatternToKnownPlatform(raw);
        if (converted) customPatterns.push(converted);
      }
    } catch {
      // Storage read failed — proceed with no custom patterns
      customPatterns = [];
    }

    // --- Signal 1: Known_Platform URL match ---
    // Check custom patterns first
    const href = location.href;
    try {
      const parsedUrl = new URL(href);
      for (const entry of customPatterns) {
        if (
          entry.hostname.test(parsedUrl.hostname) &&
          entry.pathPattern.test(parsedUrl.pathname)
        ) {
          return {
            isJobPage: true,
            platform: "custom",
            confidence: "high",
            previewTitle: "",
            previewCompany: "",
          };
        }
      }
    } catch {
      // URL parse failed — skip custom pattern check
    }

    // Check built-in platform patterns
    const platformMatch = matchKnownPlatform(href);
    if (platformMatch) {
      return {
        isJobPage: true,
        platform: platformMatch.platform,
        confidence: "high",
        previewTitle: "",
        previewCompany: "",
      };
    }

    // --- Signal 2: Structured data (JSON-LD or Open Graph) ---
    if (signalJsonLd() || signalOpenGraph()) {
      return {
        isJobPage: true,
        platform: null,
        confidence: "high",
        previewTitle: "",
        previewCompany: "",
      };
    }

    // --- Signal 3: URL path + form heuristic ---
    if (signalUrlAndForm()) {
      return {
        isJobPage: true,
        platform: null,
        confidence: "medium",
        previewTitle: "",
        previewCompany: "",
      };
    }

    // --- No match ---
    return notFound;
  } catch {
    // Unexpected error — safe fallback
    return notFound;
  }
}
