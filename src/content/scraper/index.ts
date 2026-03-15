import type { JobRecord } from "../../shared/types";
import { getScraper } from "./registry";
import { scrapeGeneric } from "./generic";
import { EMPTY_JOB_RECORD } from "../../shared/sanitize";

// Side-effect imports — trigger self-registration into PLATFORM_REGISTRY
import './platforms/linkedin';
import './platforms/greenhouse';
import './platforms/icims';
import './platforms/workday';
import './platforms/ripplematch';
import './platforms/lever';
import './platforms/smartrecruiters';

/**
 * Dispatches to the appropriate scraper for the current page.
 *
 * @param platform - The platform string from DetectionResult (e.g. "linkedin",
 *   "custom", or null). Passed for context only; actual dispatch uses
 *   getScraper(location.href) for accuracy.
 *
 * Logic:
 *   1. Try to find a platform scraper via getScraper(location.href).
 *   2. If found, call its scrape() method.
 *   3. Otherwise (no match or platform is null), call scrapeGeneric().
 *   4. On any error, return { ...EMPTY_JOB_RECORD, jobUrl: location.href }.
 *   5. Ensure jobUrl is never empty — fall back to location.href if it is.
 */
export function scrape(_platform: string | null): JobRecord {
  try {
    const platformScraper = getScraper(location.href);
    const record = platformScraper ? platformScraper.scrape() : scrapeGeneric();

    if (!record.jobUrl) {
      record.jobUrl = location.href;
    }

    return record;
  } catch {
    return { ...EMPTY_JOB_RECORD, jobUrl: location.href };
  }
}
