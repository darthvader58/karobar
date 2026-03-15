/**
 * Detection signals for the Karobar job page detector.
 * All functions are safe to call on any page — no exceptions propagate out.
 */

/**
 * Signal 2: JSON-LD structured data.
 * Returns true if any <script type="application/ld+json"> element contains
 * a JobPosting @type (directly or inside an @graph array).
 *
 * Requirements: 1.5
 */
export function signalJsonLd(): boolean {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      try {
        const data = JSON.parse(script.textContent ?? "");
        if (isJobPosting(data)) {
          return true;
        }
      } catch {
        // Malformed JSON — skip this element
      }
    }
  } catch {
    // DOM query failed — safe fallback
  }
  return false;
}

/** Checks whether a parsed JSON-LD object (or @graph array) contains a JobPosting. */
function isJobPosting(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  // Direct @type === "JobPosting"
  if (obj["@type"] === "JobPosting") return true;

  // @graph array containing a JobPosting
  if (Array.isArray(obj["@graph"])) {
    for (const node of obj["@graph"]) {
      if (
        node != null &&
        typeof node === "object" &&
        (node as Record<string, unknown>)["@type"] === "JobPosting"
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Signal 2b: Open Graph / Twitter meta tags.
 * Returns true if any of the following conditions hold:
 *  - og:type content is "job" or contains "job"
 *  - twitter:card content is "job"
 *  - og:title is present AND (job_title meta is present OR og:description contains
 *    a job-related term: engineer, developer, analyst, manager, designer, intern)
 *
 * Requirements: 1.5
 */
export function signalOpenGraph(): boolean {
  try {
    // Check og:type
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType) {
      const content = (ogType as HTMLMetaElement).content ?? "";
      if (content === "job" || content.toLowerCase().includes("job")) {
        return true;
      }
    }

    // Check twitter:card
    const twitterCard = document.querySelector('meta[name="twitter:card"]');
    if (twitterCard && (twitterCard as HTMLMetaElement).content === "job") {
      return true;
    }

    // Check og:title + job_title meta
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const jobTitleMeta = document.querySelector('meta[name="job_title"]');
      if (jobTitleMeta) {
        return true;
      }

      // Check og:description for job-related terms
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        const desc = (ogDesc as HTMLMetaElement).content ?? "";
        if (JOB_TERMS_PATTERN.test(desc)) {
          return true;
        }
      }
    }
  } catch {
    // DOM query failed — safe fallback
  }
  return false;
}

const JOB_TERMS_PATTERN = /\b(engineer|developer|analyst|manager|designer|intern)\b/i;

/**
 * Signal 3: URL path + form heuristic.
 * Returns true ONLY if BOTH conditions are met:
 *  1. location.pathname matches a job-related path segment
 *  2. A submission form is present on the page
 *
 * Keyword-only matching is explicitly excluded per Requirement 1.6.
 *
 * Requirements: 1.5, 1.6
 */
export function signalUrlAndForm(): boolean {
  try {
    const JOB_PATH = /\/(apply|jobs|careers|job|position|opening|opportunities|opportunity)\b/i;
    const hasJobPath = JOB_PATH.test(location.pathname);
    if (!hasJobPath) return false;

    const hasForm =
      document.querySelector("form[action]") !== null ||
      document.querySelector('form button[type="submit"]') !== null ||
      document.querySelector('button[type="submit"]') !== null;

    return hasForm;
  } catch {
    // location or DOM access failed — safe fallback
  }
  return false;
}
