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
  parseScriptJsonAssignment,
  parseScriptString,
  queryFirstText,
} from "../utils";

interface IcimsState {
  companyName?: string;
  job?: {
    location?: string;
    title?: string;
    jobUrls?: Array<{ url?: string }>;
  };
}

function buildLocationFromJsonLd(jobPosting: Record<string, unknown> | null): string {
  if (!jobPosting) return "";

  const rawLocation = jobPosting.jobLocation;
  const locations = Array.isArray(rawLocation) ? rawLocation : [rawLocation];
  const parts = locations.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const address = (entry as Record<string, unknown>).address;
    if (!address || typeof address !== "object") return [];
    const value = [address.addressLocality, address.addressRegion, address.addressCountry]
      .filter((item) => typeof item === "string" && item.trim() && item !== "UNAVAILABLE")
      .map((item) => (item as string).trim())
      .join(", ");
    return value ? [value] : [];
  });

  return parts.join(" | ");
}

function getActiveDocument(): Document {
  const iframe = document.querySelector<HTMLIFrameElement>(
    "iframe#icims_content_iframe, iframe#noscript_icims_content_iframe, iframe[src*='in_iframe=1']"
  );

  try {
    if (iframe?.contentDocument?.body?.textContent?.trim()) {
      return iframe.contentDocument;
    }
  } catch {
    return document;
  }

  return document;
}

function getIframeUrl(): string {
  const iframe = document.querySelector<HTMLIFrameElement>(
    "iframe#icims_content_iframe, iframe#noscript_icims_content_iframe, iframe[src*='in_iframe=1']"
  );
  if (iframe?.src) return iframe.src.replace(/[?&]in_iframe=1\b/, "").replace(/[?&]$/, "");

  const scriptUrl = parseScriptString(document, /icimsFrame\.src\s*=\s*'([^']+)'/);
  return scriptUrl
    ? scriptUrl.replace(/\\\//g, "/").replace(/[?&]in_iframe=1\b/, "").replace(/[?&]$/, "")
    : "";
}

function scrape() {
  const activeDocument = getActiveDocument();
  const state = parseScriptJsonAssignment<IcimsState>(
    activeDocument,
    /var\s+icimsSD\s*=\s*(\{.*?\});/s
  );
  const jobPosting = parseJsonLdJobPosting(activeDocument);
  const documentText = extractTextContent(activeDocument);
  const titleText = activeDocument.title || document.title;
  const locationText =
    state?.job?.location ||
    queryFirstText(activeDocument, "[class*='iCIMS_JobHeaderField']", "[class*='location']", ".iCIMS_JobHeader") ||
    buildLocationFromJsonLd(jobPosting);

  return buildRecord({
    jobTitle:
      state?.job?.title ||
      queryFirstText(
        activeDocument,
        "h1[class*='iCIMS_Header']",
        "h1[class*='iCIMS_JobTitle']",
        "h1"
      ) ||
      (typeof jobPosting?.title === "string" ? jobPosting.title : "") ||
      getMetaContent(activeDocument, "property", "og:title"),
    companyName:
      state?.companyName ||
      extractCompanyFromApplicationTitle(titleText) ||
      getMetaContent(activeDocument, "property", "og:site_name") ||
      "iCIMS",
    location: locationText,
    jobTerm: inferJobTerm([titleText, documentText], new Date()),
    employmentType: inferEmploymentType(titleText, documentText),
    department:
      queryFirstText(
        activeDocument,
        "[class*='iCIMS_JobHeaderGroup'] [class*='department']",
        "[class*='department']",
        "[class*='category']"
      ) || "",
    workArrangement: inferWorkArrangement(locationText, documentText),
    jobUrl: getCanonicalJobUrl(activeDocument, location.href, [
      getIframeUrl(),
      state?.job?.jobUrls?.[0]?.url || "",
    ]),
  });
}

export const icimsScraper: PlatformScraper = {
  platform: "icims",
  hostPattern: /\.icims\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(icimsScraper);
