import type { JobRecord } from "../../shared/types";
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
} from "./utils";

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

export function scrapeGeneric(): JobRecord {
  const jobPosting = parseJsonLdJobPosting(document);
  const titleText = document.title || "";
  const jobTitle =
    (typeof jobPosting?.title === "string" ? jobPosting.title : "") ||
    (typeof jobPosting?.name === "string" ? jobPosting.name : "") ||
    getMetaContent(document, "property", "og:title") ||
    queryFirstText(document, "h1", "[class*='job-title']", "[itemprop='title']");
  const companyName =
    (jobPosting?.hiringOrganization &&
    typeof jobPosting.hiringOrganization === "object" &&
    typeof (jobPosting.hiringOrganization as Record<string, unknown>).name === "string"
      ? ((jobPosting.hiringOrganization as Record<string, unknown>).name as string)
      : "") ||
    extractCompanyFromApplicationTitle(titleText) ||
    getMetaContent(document, "property", "og:site_name") ||
    queryFirstText(document, "[class*='company-name']", "[class*='employer']", "[itemprop='name']");
  const locationText =
    buildLocationFromJsonLd(jobPosting) ||
    getMetaContent(document, "property", "og:description") ||
    queryFirstText(document, "[class*='location']", "[class*='workplace']", "[class*='office']");
  const employmentSource =
    (typeof jobPosting?.employmentType === "string" ? jobPosting.employmentType : "") ||
    queryFirstText(document, "[class*='job-type']", "[class*='employment']");
  const documentText = extractTextContent(document);

  return buildRecord({
    jobTitle,
    companyName,
    location: locationText,
    jobTerm: inferJobTerm([jobTitle, titleText, employmentSource, documentText], new Date()),
    employmentType: inferEmploymentType(jobTitle, employmentSource, documentText),
    department:
      (typeof jobPosting?.department === "string" ? jobPosting.department : "") ||
      (typeof jobPosting?.occupationalCategory === "string"
        ? jobPosting.occupationalCategory
        : "") ||
      queryFirstText(document, "[class*='department']", "[class*='team']"),
    workArrangement: inferWorkArrangement(
      typeof jobPosting?.jobLocationType === "string" ? jobPosting.jobLocationType : "",
      locationText,
      documentText
    ),
    jobUrl: getCanonicalJobUrl(document, location.href, [
      typeof jobPosting?.url === "string" ? jobPosting.url : "",
    ]),
  });
}
