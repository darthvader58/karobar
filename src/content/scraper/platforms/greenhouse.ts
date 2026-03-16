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
  parseScriptJsonAssignment,
  queryFirstText,
} from "../utils";

interface GreenhouseAppState {
  props?: {
    pageProps?: {
      data?: {
        jobPost?: {
          title?: string;
          location?: { name?: string };
          offices?: Array<{ name?: string }>;
          metadata?: Array<{ name?: string; value?: string }>;
          questions?: Array<{
            label?: string;
            fields?: Array<{
              values?: Array<{ label?: string }>;
            }>;
          }>;
        };
      };
    };
  };
}

function scrape() {
  const appState = parseScriptJsonAssignment<GreenhouseAppState>(
    document,
    /window\.__appState\s*=\s*(\{.*\});/s
  );
  const jobPost = appState?.props?.pageProps?.data?.jobPost;
  const metadataText = (jobPost?.metadata || [])
    .map((item) => `${item.name || ""} ${item.value || ""}`.trim())
    .join(" ");
  const questionLabels = (jobPost?.questions || [])
    .flatMap((question) => [
      question.label || "",
      ...(question.fields || []).flatMap((field) =>
        (field.values || []).map((value) => value.label || "")
      ),
    ])
    .join(" ");

  const jobTitle =
    queryFirstText(document, "h1.app-title", "h1[class*='title']", "h1") ||
    jobPost?.title ||
    getMetaContent(document, "property", "og:title");
  const titleText = document.title || "";
  const companyName =
    queryFirstText(document, "[class*='company']", ".company-name") ||
    extractCompanyFromApplicationTitle(titleText) ||
    normalizeCompanyName(location.pathname.split("/").filter(Boolean)[0] || "");
  const locationText =
    queryFirstText(document, "[class*='location']", ".location", "[class*='offices']") ||
    jobPost?.location?.name ||
    (jobPost?.offices || []).map((office) => office.name || "").join(", ") ||
    getMetaContent(document, "property", "og:description");
  const documentText = extractTextContent(document);
  const employmentType = inferEmploymentType(jobTitle, metadataText, questionLabels, documentText);
  const jobTerm = inferJobTerm(
    [jobTitle, metadataText, questionLabels, titleText, documentText],
    new Date()
  );
  const workArrangement = inferWorkArrangement(locationText, metadataText, documentText);

  return buildRecord({
    jobTitle,
    companyName,
    location: locationText,
    jobTerm,
    employmentType,
    department: queryFirstText(document, "[class*='department']", ".department", "[class*='team']"),
    workArrangement,
    jobUrl: getCanonicalJobUrl(document, location.href),
  });
}

export const greenhouseScraper: PlatformScraper = {
  platform: "greenhouse",
  hostPattern: /greenhouse\.io/i,
  scrape,
};

PLATFORM_REGISTRY.push(greenhouseScraper);
