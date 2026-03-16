import type { PlatformScraper } from "../../../shared/types";
import { PLATFORM_REGISTRY } from "../registry";
import {
  buildRecord,
  extractCompanyFromApplicationTitle,
  extractTextContent,
  getCanonicalJobUrl,
  getMetaContent,
  inferEmploymentType,
  inferJobTerm,
  inferWorkArrangement,
  queryFirstText,
} from "../utils";

function normalizeRippleMatchTitle(rawTitle: string): string {
  const cleaned = rawTitle
    .replace(/^Apply for a\s+/i, "")
    .replace(/\s+role at\s+.+$/i, "")
    .replace(/\s+via RippleMatch$/i, "")
    .trim();

  return cleaned;
}

function scrape() {
  const ogTitle = getMetaContent(document, "property", "og:title");
  const jobTitle =
    queryFirstText(document, "h1", "[class*='job-title']", "[class*='title']") ||
    normalizeRippleMatchTitle(ogTitle);
  const documentText = extractTextContent(document);
  const companyName =
    queryFirstText(document, "[class*='company']", "[class*='employer']") ||
    extractCompanyFromApplicationTitle(ogTitle) ||
    getMetaContent(document, "property", "og:site_name");
  const locationText = queryFirstText(document, "[class*='location']", "[class*='job-location']");

  return buildRecord({
    jobTitle,
    companyName,
    location: locationText,
    jobTerm: inferJobTerm([jobTitle, ogTitle, documentText], new Date()),
    employmentType: inferEmploymentType(jobTitle, ogTitle, documentText),
    department: queryFirstText(document, "[class*='department']", "[class*='team']"),
    workArrangement: inferWorkArrangement(locationText, documentText),
    jobUrl: getCanonicalJobUrl(document, location.href),
  });
}

export const ripplematchScraper: PlatformScraper = {
  platform: "ripplematch",
  hostPattern: /(?:^|\.)ripplematch\.com|app\.ripplematch\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(ripplematchScraper);
