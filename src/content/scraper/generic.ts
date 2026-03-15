import type { JobRecord } from "../../shared/types";
import { sanitize, EMPTY_JOB_RECORD } from "../../shared/sanitize";

/**
 * Returns the canonical URL for the current page.
 * Priority: og:url → link[rel="canonical"] → location.href
 */
function getCanonicalUrl(): string {
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) return (ogUrl as HTMLMetaElement).content || location.href;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) return (canonical as HTMLLinkElement).href || location.href;
  return location.href;
}

/**
 * Safely queries a single element and returns its text/content, or "".
 */
function queryText(selector: string): string {
  try {
    const el = document.querySelector(selector);
    if (!el) return "";
    if (el instanceof HTMLMetaElement) return el.content || "";
    return el.textContent || "";
  } catch {
    return "";
  }
}

/**
 * Tries multiple selectors in order, returning the first non-empty result.
 */
function queryFirstText(...selectors: string[]): string {
  for (const sel of selectors) {
    const val = queryText(sel);
    if (val.trim()) return val;
  }
  return "";
}

/**
 * Parses JSON-LD blocks and returns the first JobPosting data object, or null.
 */
function extractJsonLd(): Record<string, unknown> | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      try {
        const parsed = JSON.parse(script.textContent || "");
        // Direct JobPosting
        if (parsed["@type"] === "JobPosting") return parsed as Record<string, unknown>;
        // Check @graph array
        if (Array.isArray(parsed["@graph"])) {
          const found = (parsed["@graph"] as unknown[]).find(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              (item as Record<string, unknown>)["@type"] === "JobPosting"
          );
          if (found) return found as Record<string, unknown>;
        }
      } catch {
        // malformed JSON — skip
      }
    }
  } catch {
    // DOM query failed
  }
  return null;
}

/**
 * Builds a location string from a JSON-LD jobLocation address object.
 */
function buildLocationFromJsonLd(data: Record<string, unknown>): string {
  try {
    const jobLocation = data["jobLocation"] as Record<string, unknown> | undefined;
    if (!jobLocation) return "";
    const address = jobLocation["address"];
    if (typeof address === "string") return address;
    if (typeof address === "object" && address !== null) {
      const addr = address as Record<string, unknown>;
      const parts = [
        addr["addressLocality"],
        addr["addressRegion"],
        addr["addressCountry"],
      ]
        .filter((p) => typeof p === "string" && (p as string).trim() !== "")
        .map((p) => (p as string).trim());
      return parts.join(", ");
    }
  } catch {
    // fall through
  }
  return "";
}

/**
 * Resolves employmentType / jobTerm from JSON-LD data.
 * The field may be a string or an array of strings.
 */
function resolveEmploymentType(data: Record<string, unknown>): string {
  try {
    const et = data["employmentType"];
    if (Array.isArray(et)) return et.filter(Boolean).join(", ");
    if (typeof et === "string") return et;
  } catch {
    // fall through
  }
  return "";
}

/**
 * Resolves workArrangement from JSON-LD data.
 * Checks jobLocationType (e.g. "TELECOMMUTE") and workHours.
 */
function resolveWorkArrangementFromJsonLd(data: Record<string, unknown>): string {
  try {
    const locationType = data["jobLocationType"];
    if (typeof locationType === "string") {
      if (/telecommut/i.test(locationType)) return "Remote";
      return locationType;
    }
    const workHours = data["workHours"];
    if (typeof workHours === "string" && workHours.trim()) return workHours.trim();
  } catch {
    // fall through
  }
  return "";
}

/**
 * Looks for a work-arrangement keyword in text content of matching elements.
 */
function detectWorkArrangementFromHtml(): string {
  try {
    const selectors = ['[class*="location"]', '[class*="workplace"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el.textContent || "";
        if (/\bremote\b/i.test(text)) return "Remote";
        if (/\bhybrid\b/i.test(text)) return "Hybrid";
        if (/\bin-person\b/i.test(text)) return "In-person";
        if (/\bon-site\b/i.test(text)) return "On-site";
      }
    }
  } catch {
    // fall through
  }
  return "";
}

/**
 * Looks for an employment-type keyword in text content of matching elements.
 */
function detectEmploymentTypeFromHtml(): string {
  try {
    const selectors = ['[class*="job-type"]', '[class*="employment"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el.textContent || "";
        if (/\bfull[- ]?time\b/i.test(text)) return "Full-time";
        if (/\bpart[- ]?time\b/i.test(text)) return "Part-time";
        if (/\binternship\b/i.test(text)) return "Internship";
        if (/\bcontract\b/i.test(text)) return "Contract";
      }
    }
  } catch {
    // fall through
  }
  return "";
}

/**
 * Best-effort fallback scraper for Generic_Pages.
 *
 * Extraction priority per field:
 *   1. JSON-LD (script[type="application/ld+json"] with @type "JobPosting")
 *   2. Open Graph meta tags
 *   3. Common HTML patterns
 *
 * All extracted values are passed through sanitize().
 * Every DOM query is wrapped in try/catch — exceptions fall back to "".
 * If the entire function throws, returns { ...EMPTY_JOB_RECORD, jobUrl: location.href }.
 */
export function scrapeGeneric(): JobRecord {
  try {
    const record: JobRecord = { ...EMPTY_JOB_RECORD };

    // ── Step 1: JSON-LD ──────────────────────────────────────────────────────
    const ld = extractJsonLd();
    if (ld) {
      // jobTitle
      record.jobTitle = sanitize(
        (ld["title"] as string | undefined) || (ld["name"] as string | undefined) || ""
      );

      // companyName
      try {
        const org = ld["hiringOrganization"] as Record<string, unknown> | undefined;
        record.companyName = sanitize((org?.["name"] as string | undefined) || "");
      } catch {
        record.companyName = "";
      }

      // location
      record.location = sanitize(buildLocationFromJsonLd(ld));

      // jobTerm (employment type as term/duration)
      record.jobTerm = sanitize(resolveEmploymentType(ld));

      // employmentType (full-time / internship classification)
      record.employmentType = sanitize(resolveEmploymentType(ld));

      // department
      record.department = sanitize(
        (ld["occupationalCategory"] as string | undefined) ||
          (ld["department"] as string | undefined) ||
          ""
      );

      // workArrangement
      record.workArrangement = sanitize(resolveWorkArrangementFromJsonLd(ld));

      // jobUrl
      record.jobUrl = sanitize((ld["url"] as string | undefined) || getCanonicalUrl());
    }

    // ── Step 2: Open Graph ───────────────────────────────────────────────────
    if (!record.jobTitle) {
      record.jobTitle = sanitize(queryText('meta[property="og:title"]'));
    }
    if (!record.companyName) {
      record.companyName = sanitize(queryText('meta[property="og:site_name"]'));
    }
    if (!record.jobUrl) {
      record.jobUrl = sanitize(queryText('meta[property="og:url"]'));
    }

    // ── Step 3: HTML patterns ────────────────────────────────────────────────
    if (!record.jobTitle) {
      record.jobTitle = sanitize(
        queryFirstText(
          "h1",
          '[class*="job-title"]',
          '[id*="job-title"]',
          '[itemprop="title"]'
        )
      );
    }
    if (!record.companyName) {
      record.companyName = sanitize(
        queryFirstText(
          '[class*="company-name"]',
          '[itemprop="name"]',
          '[class*="employer"]'
        )
      );
    }
    if (!record.location) {
      record.location = sanitize(
        queryFirstText('[class*="location"]', '[itemprop="addressLocality"]')
      );
    }
    if (!record.workArrangement) {
      record.workArrangement = sanitize(detectWorkArrangementFromHtml());
    }
    if (!record.employmentType) {
      record.employmentType = sanitize(detectEmploymentTypeFromHtml());
    }

    // ── Final: ensure jobUrl is always set ───────────────────────────────────
    if (!record.jobUrl) {
      record.jobUrl = getCanonicalUrl();
    }

    return record;
  } catch {
    return { ...EMPTY_JOB_RECORD, jobUrl: location.href };
  }
}
