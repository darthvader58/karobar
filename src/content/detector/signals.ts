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
const JOB_PATH_PATTERN =
  /\/(apply|application|jobs?|careers?|job|position|opening|opportunit(?:y|ies)|public\/job)\b/i;
const APPLICATION_COPY_PATTERN =
  /\b(job application|apply for this job|apply for this role|submit application|start your application)\b/i;

/**
 * Signal 3: URL path + form heuristic.
 * Returns true when a page looks like a real job application surface:
 *  1. It has applicant fields / upload / submit controls
 *  2. It also has job identity cues in the URL, title, or page copy
 *
 * Requirements: 1.5, 1.6
 */
export function signalUrlAndForm(): boolean {
  try {
    const hasJobPath = JOB_PATH_PATTERN.test(location.pathname);
    const pageText = [
      document.title,
      getMetaContent("property", "og:title"),
      getMetaContent("property", "og:description"),
      queryText("h1"),
      queryText("main"),
      queryText("form"),
    ]
      .filter(Boolean)
      .join(" ");

    const applicantFieldCount = countApplicantFields();
    const hasSubmitControl =
      document.querySelector('form button[type="submit"]') !== null ||
      document.querySelector('button[type="submit"]') !== null ||
      document.querySelector('input[type="submit"]') !== null;
    const hasResumeUpload =
      document.querySelector('input[type="file"]') !== null ||
      /resume|cv|cover letter/i.test(pageText);
    const hasApplicationCopy = APPLICATION_COPY_PATTERN.test(pageText);
    const hasJobIdentity =
      hasJobPath ||
      /job application for/i.test(document.title) ||
      JOB_TERMS_PATTERN.test(pageText);

    const hasApplicationSurface =
      hasSubmitControl && (applicantFieldCount >= 2 || hasResumeUpload || hasApplicationCopy);

    return hasApplicationSurface && hasJobIdentity;
  } catch {
    // location or DOM access failed — safe fallback
  }
  return false;
}

function countApplicantFields(): number {
  let count = 0;

  if (
    document.querySelector('[autocomplete="given-name"]') ||
    document.querySelector('input[name*="first" i]') ||
    document.querySelector('input[id*="first" i]')
  ) {
    count += 1;
  }

  if (
    document.querySelector('[autocomplete="family-name"]') ||
    document.querySelector('input[name*="last" i]') ||
    document.querySelector('input[id*="last" i]')
  ) {
    count += 1;
  }

  if (
    document.querySelector('[autocomplete="email"]') ||
    document.querySelector('input[type="email"]') ||
    document.querySelector('input[name*="email" i]')
  ) {
    count += 1;
  }

  if (
    document.querySelector('[autocomplete="tel"]') ||
    document.querySelector('input[type="tel"]') ||
    document.querySelector('input[name*="phone" i]')
  ) {
    count += 1;
  }

  return count;
}

function getMetaContent(attribute: "property" | "name", key: string): string {
  try {
    const el = document.querySelector(`meta[${attribute}="${key}"]`);
    return el instanceof HTMLMetaElement ? el.content || "" : "";
  } catch {
    return "";
  }
}

function queryText(selector: string): string {
  try {
    return document.querySelector(selector)?.textContent || "";
  } catch {
    return "";
  }
}
