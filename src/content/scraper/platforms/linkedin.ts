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
  parseJsonLdJobPosting,
  queryFirstText,
} from "../utils";

function getCriteriaText(labelKeywords: string[]): string {
  const selectors = [
    {
      item: "[class*='job-criteria__item'], .description__job-criteria-item",
      label: "[class*='job-criteria__subheader'], .description__job-criteria-subheader",
      value: "[class*='job-criteria__text'], .description__job-criteria-text",
    },
    {
      item: ".job-details-fit-level-preferences li, .job-details-preferences-and-skills__pill",
      label: "h3, strong, span",
      value: "span, p",
    },
  ];

  for (const selector of selectors) {
    const items = document.querySelectorAll(selector.item);
    for (const item of Array.from(items)) {
      const label = item.querySelector(selector.label)?.textContent || item.textContent || "";
      if (!labelKeywords.some((keyword) => label.toLowerCase().includes(keyword.toLowerCase()))) {
        continue;
      }

      const value = item.querySelector(selector.value)?.textContent || item.textContent || "";
      if (value.trim()) return value;
    }
  }

  return "";
}

function scrape() {
  const jobPosting = parseJsonLdJobPosting(document);
  const jobTitle =
    queryFirstText(
      document,
      "h1.top-card-layout__title",
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__title",
      "h1"
    ) ||
    (typeof jobPosting?.title === "string" ? jobPosting.title : "") ||
    getMetaContent(document, "property", "og:title");
  const companyName =
    queryFirstText(
      document,
      "a.topcard__org-name-link",
      ".job-details-jobs-unified-top-card__company-name",
      ".job-details-jobs-unified-top-card__primary-description-container a",
      "[class*='company-name']"
    ) ||
    (jobPosting?.hiringOrganization &&
    typeof jobPosting.hiringOrganization === "object" &&
    typeof (jobPosting.hiringOrganization as Record<string, unknown>).name === "string"
      ? ((jobPosting.hiringOrganization as Record<string, unknown>).name as string)
      : "") ||
    getMetaContent(document, "property", "og:site_name");
  const primaryDescription = queryFirstText(
    document,
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    "[class*='topcard__flavor--bullet']"
  );
  const locationText =
    queryFirstText(
      document,
      ".job-details-jobs-unified-top-card__tertiary-description-container",
      "[class*='topcard__flavor--bullet']",
      ".job-search-card__location"
    ) || primaryDescription;
  const workplaceText = queryFirstText(
    document,
    ".job-details-jobs-unified-top-card__workplace-type",
    ".job-details-jobs-unified-top-card__job-insight--highlight"
  );
  const criteriaEmployment = getCriteriaText(["employment type", "job type"]);
  const criteriaDepartment = getCriteriaText(["job function", "industries", "industry"]);
  const documentText = extractTextContent(document);

  return buildRecord({
    jobTitle,
    companyName,
    location: locationText,
    jobTerm: inferJobTerm([jobTitle, criteriaEmployment, documentText], new Date()),
    employmentType: inferEmploymentType(jobTitle, criteriaEmployment, documentText),
    department: criteriaDepartment,
    workArrangement: inferWorkArrangement(workplaceText, locationText, primaryDescription, documentText),
    jobUrl: getCanonicalJobUrl(document, location.href, [
      typeof jobPosting?.url === "string" ? jobPosting.url : "",
    ]),
  });
}

export const linkedinScraper: PlatformScraper = {
  platform: "linkedin",
  hostPattern: /linkedin\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(linkedinScraper);
