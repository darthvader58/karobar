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
  normalizeCompanyName,
  parseJsonLdJobPosting,
  queryFirstText,
} from "../utils";

function extractCompanyFromUrl(): string {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[0] ? normalizeCompanyName(parts[0]) : "";
}

function extractPostingCategories(): string {
  return queryFirstText(
    document,
    ".posting-categories",
    ".posting-categories-wrapper",
    "[data-qa='posting-categories']"
  );
}

function scrape() {
  const jobPosting = parseJsonLdJobPosting(document);
  const titleText = document.title || "";
  const postingCategories = extractPostingCategories();
  const locationText =
    queryFirstText(
      document,
      "[data-qa='posting-location']",
      ".location",
      ".posting-categories .location",
      ".sort-by-time-posting-category.location"
    ) ||
    getMetaContent(document, "property", "og:description");
  const commitmentText =
    queryFirstText(
      document,
      "[data-qa='posting-commitment']",
      ".commitment",
      ".posting-categories .commitment",
      ".sort-by-time-posting-category.commitment"
    ) || postingCategories;

  const documentText = extractTextContent(document);

  return buildRecord({
    jobTitle:
      queryFirstText(
        document,
        "h2[data-qa='posting-name']",
        ".posting-headline h2",
        ".posting-headline h1",
        "h1"
      ) ||
      (typeof jobPosting?.title === "string" ? jobPosting.title : "") ||
      getMetaContent(document, "property", "og:title"),
    companyName:
      queryFirstText(
        document,
        ".main-header-logo img[alt]",
        ".posting-page .main-header-logo img[alt]"
      ) ||
      extractCompanyFromApplicationTitle(titleText) ||
      (jobPosting?.hiringOrganization &&
      typeof jobPosting.hiringOrganization === "object" &&
      typeof (jobPosting.hiringOrganization as Record<string, unknown>).name === "string"
        ? ((jobPosting.hiringOrganization as Record<string, unknown>).name as string)
        : "") ||
      extractCompanyFromUrl(),
    location: locationText,
    jobTerm: inferJobTerm([titleText, commitmentText, postingCategories, documentText], new Date()),
    employmentType: inferEmploymentType(commitmentText, postingCategories, titleText, documentText),
    department:
      queryFirstText(
        document,
        "[data-qa='posting-team']",
        ".team",
        ".department",
        ".posting-categories .team"
      ) || "",
    workArrangement: inferWorkArrangement(locationText, postingCategories, documentText),
    jobUrl: getCanonicalJobUrl(document, location.href, [
      typeof jobPosting?.url === "string" ? jobPosting.url : "",
    ]),
  });
}

export const leverScraper: PlatformScraper = {
  platform: "lever",
  hostPattern: /jobs\.lever\.co/i,
  scrape,
};

PLATFORM_REGISTRY.push(leverScraper);
