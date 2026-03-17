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
  parseJsonLdJobPosting,
  queryFirstText,
} from "../utils";

function buildLocationFromJsonLd(jobPosting: Record<string, unknown> | null): string {
  if (!jobPosting) return "";

  const rawLocation = jobPosting.jobLocation;
  const locations = Array.isArray(rawLocation) ? rawLocation : [rawLocation];
  const parts = locations.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const address = (entry as Record<string, unknown>).address;
    if (typeof address === "string") return [address];
    if (!address || typeof address !== "object") return [];
    const value = [address.addressLocality, address.addressRegion, address.addressCountry]
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => (item as string).trim())
      .join(", ");
    return value ? [value] : [];
  });

  return parts.join(" | ");
}

function scrape() {
  const jobPosting = parseJsonLdJobPosting(document);
  const titleText = document.title || "";
  const documentText = extractTextContent(document);
  const locationText =
    queryFirstText(
      document,
      "[itemprop='jobLocation']",
      "[class*='location']",
      "[data-testid*='location']",
      ".job-details .location"
    ) || buildLocationFromJsonLd(jobPosting);
  const employmentSource =
    queryFirstText(
      document,
      "[itemprop='employmentType']",
      "[class*='employment']",
      "[data-testid*='employment']",
      ".job-details [class*='job-detail']"
    ) ||
    (typeof jobPosting?.employmentType === "string" ? jobPosting.employmentType : "");

  return buildRecord({
    jobTitle:
      queryFirstText(
        document,
        "h1[class*='job-title']",
        "h1[itemprop='title']",
        "[data-testid='job-title']",
        "h1"
      ) ||
      (typeof jobPosting?.title === "string" ? jobPosting.title : "") ||
      getMetaContent(document, "property", "og:title"),
    companyName:
      queryFirstText(
        document,
        "[class*='company-name']",
        "[itemprop='hiringOrganization']",
        "[data-testid='company-name']"
      ) ||
      extractCompanyFromApplicationTitle(titleText) ||
      (jobPosting?.hiringOrganization &&
      typeof jobPosting.hiringOrganization === "object" &&
      typeof (jobPosting.hiringOrganization as Record<string, unknown>).name === "string"
        ? ((jobPosting.hiringOrganization as Record<string, unknown>).name as string)
        : "") ||
      getMetaContent(document, "property", "og:site_name"),
    location: locationText,
    jobTerm: inferJobTerm([titleText, employmentSource, documentText], new Date()),
    employmentType: inferEmploymentType(employmentSource, titleText, documentText),
    department:
      queryFirstText(
        document,
        "[class*='department']",
        "[itemprop='occupationalCategory']",
        "[data-testid='department']"
      ) ||
      (typeof jobPosting?.department === "string" ? jobPosting.department : "") ||
      (typeof jobPosting?.occupationalCategory === "string"
        ? jobPosting.occupationalCategory
        : ""),
    workArrangement: inferWorkArrangement(locationText, documentText),
    jobUrl: getCanonicalJobUrl(document, location.href, [
      typeof jobPosting?.url === "string" ? jobPosting.url : "",
    ]),
  });
}

export const smartrecruitersScraper: PlatformScraper = {
  platform: "smartrecruiters",
  hostPattern: /jobs\.smartrecruiters\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(smartrecruitersScraper);
