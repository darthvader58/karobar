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
  parseScriptJsonAssignment,
  queryFirstText,
} from "../utils";

interface AshbyLocation {
  locationName?: string;
  locationExternalName?: string | null;
}

interface AshbyPosting extends AshbyLocation {
  id?: string;
  title?: string;
  departmentName?: string | null;
  departmentExternalName?: string | null;
  teamName?: string | null;
  teamExternalName?: string | null;
  workplaceType?: string | null;
  employmentType?: string | null;
  compensationTierSummary?: string | null;
  secondaryLocations?: Array<AshbyLocation>;
}

interface AshbyJobBoard {
  name?: string;
  postings?: AshbyPosting[];
}

interface AshbyAppData {
  organization?: {
    name?: string;
    hostedJobsPageSlug?: string;
  } | null;
  posting?: AshbyPosting | null;
  jobBoard?: AshbyJobBoard | null;
}

function getRuntimeAppData(): AshbyAppData | null {
  const data = (window as unknown as { __appData?: AshbyAppData }).__appData;
  return data ?? null;
}

function getScriptAppData(): AshbyAppData | null {
  return parseScriptJsonAssignment<AshbyAppData>(
    document,
    /window\.__appData\s*=\s*(\{.*?\});/s
  );
}

function getAppData(): AshbyAppData | null {
  return getRuntimeAppData() || getScriptAppData();
}

function getPostingFromAppData(appData: AshbyAppData | null): AshbyPosting | null {
  if (!appData) return null;
  if (appData.posting) return appData.posting;

  const pathParts = location.pathname.split("/").filter(Boolean);
  const postingId = pathParts[1];
  if (!postingId || !appData.jobBoard?.postings?.length) return null;

  return appData.jobBoard.postings.find((posting) => posting.id === postingId) || null;
}

function getLocation(posting: AshbyPosting | null): string {
  if (!posting) return "";

  const primary =
    posting.locationExternalName ||
    posting.locationName ||
    "";
  const secondary = (posting.secondaryLocations || [])
    .map((location) => location.locationExternalName || location.locationName || "")
    .filter(Boolean);

  return [primary, ...secondary].filter(Boolean).join(" | ");
}

function getCompanyName(appData: AshbyAppData | null): string {
  if (appData?.organization?.name) return appData.organization.name;
  if (appData?.jobBoard?.name) {
    return appData.jobBoard.name.replace(/\s+Jobs$/i, "");
  }
  return normalizeCompanyName(location.pathname.split("/").filter(Boolean)[0] || "");
}

function scrape() {
  const appData = getAppData();
  const posting = getPostingFromAppData(appData);
  const titleText = document.title || "";
  const locationText =
    getLocation(posting) ||
    queryFirstText(
      document,
      "[data-testid='job-posting-location']",
      "[class*='location']",
      "[class*='jobPostingLocation']"
    ) ||
    getMetaContent(document, "property", "og:description");
  const employmentSource =
    posting?.employmentType ||
    queryFirstText(
      document,
      "[data-testid='job-posting-employment-type']",
      "[class*='employmentType']",
      "[class*='employment-type']"
    );
  const departmentText =
    posting?.teamExternalName ||
    posting?.teamName ||
    posting?.departmentExternalName ||
    posting?.departmentName ||
    queryFirstText(
      document,
      "[data-testid='job-posting-team']",
      "[data-testid='job-posting-department']",
      "[class*='department']",
      "[class*='team']"
    );
  const compensationText =
    posting?.compensationTierSummary ||
    queryFirstText(document, "[data-testid='job-posting-compensation']", "[class*='compensation']");
  const documentText = extractTextContent(document);

  return buildRecord({
    jobTitle:
      posting?.title ||
      queryFirstText(
        document,
        "h1[data-testid='job-posting-title']",
        "[data-testid='job-posting-title']",
        "h1"
      ) ||
      getMetaContent(document, "property", "og:title"),
    companyName: getCompanyName(appData),
    location: locationText,
    jobTerm: inferJobTerm([titleText, employmentSource, compensationText, documentText], new Date()),
    employmentType: inferEmploymentType(employmentSource, titleText, compensationText, documentText),
    department: departmentText,
    workArrangement: inferWorkArrangement(posting?.workplaceType, locationText, documentText),
    jobUrl: getCanonicalJobUrl(document, location.href),
  });
}

export const ashbyScraper: PlatformScraper = {
  platform: "ashby",
  hostPattern: /jobs\.ashbyhq\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(ashbyScraper);
