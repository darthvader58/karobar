import type { PlatformScraper } from "../../../shared/types";
import { PLATFORM_REGISTRY } from "../registry";
import {
  buildRecord,
  extractTextContent,
  getCanonicalJobUrl,
  getMetaContent,
  inferEmploymentType,
  inferJobTerm,
  inferWorkArrangement,
  normalizeCompanyName,
  parseJsonLdJobPosting,
  parseScriptString,
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
    const values = [address.addressLocality, address.addressRegion, address.addressCountry]
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => (item as string).trim());
    const seen = new Set<string>();
    const value = values
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        if ([...seen].some((existing) => existing.includes(key) || key.includes(existing))) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .join(", ");
    return value ? [value] : [];
  });

  return parts.join(" | ");
}

function extractCompanyName(jobPosting: Record<string, unknown> | null): string {
  const org = jobPosting?.hiringOrganization;
  if (org && typeof org === "object") {
    const company = (org as Record<string, unknown>).name;
    if (typeof company === "string" && !/graphics|bengaluru/i.test(company)) {
      return company;
    }
  }

  const ogDescription = getMetaContent(document, "property", "og:description");
  const descriptionMatch = ogDescription.match(/^([A-Z][A-Z0-9& .'-]{1,40})\b/);
  if (descriptionMatch?.[1]) return descriptionMatch[1];

  const tenant = parseScriptString(document, /tenant:\s*"([^"]+)"/);
  if (tenant) return normalizeCompanyName(tenant);

  return normalizeCompanyName(location.hostname.split(".")[0] || "");
}

function scrape() {
  const jobPosting = parseJsonLdJobPosting(document);
  const jobTitle =
    queryFirstText(document, "[data-automation-id='jobPostingHeader']", "h1") ||
    (typeof jobPosting?.title === "string" ? jobPosting.title : "") ||
    getMetaContent(document, "property", "og:title");
  const locationText =
    queryFirstText(document, "[data-automation-id='locations']", "[data-automation-id='location']") ||
    buildLocationFromJsonLd(jobPosting);
  const employmentSource =
    queryFirstText(document, "[data-automation-id='jobPostingTimeType']", "[data-automation-id='time']") ||
    (typeof jobPosting?.employmentType === "string" ? jobPosting.employmentType : "");
  const documentText = extractTextContent(document);

  return buildRecord({
    jobTitle,
    companyName: extractCompanyName(jobPosting),
    location: locationText,
    jobTerm: inferJobTerm([jobTitle, employmentSource, documentText], new Date()),
    employmentType: inferEmploymentType(jobTitle, employmentSource, documentText),
    department: queryFirstText(
      document,
      "[data-automation-id='jobPostingCategory']",
      "[data-automation-id='department']",
      "[data-automation-id='jobPostingDepartment']"
    ),
    workArrangement: inferWorkArrangement(
      queryFirstText(document, "[data-automation-id='workspaceType']"),
      locationText,
      documentText
    ),
    jobUrl: getCanonicalJobUrl(document, location.href),
  });
}

export const workdayScraper: PlatformScraper = {
  platform: "workday",
  hostPattern: /(?:myworkdayjobs|workday)\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(workdayScraper);
