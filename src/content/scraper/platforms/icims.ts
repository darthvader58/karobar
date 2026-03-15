import type { JobRecord } from '../../../shared/types';
import type { PlatformScraper } from '../../../shared/types';
import { sanitize, EMPTY_JOB_RECORD } from '../../../shared/sanitize';
import { PLATFORM_REGISTRY } from '../registry';

/**
 * Returns the canonical URL for the current page.
 * Priority: og:url → link[rel="canonical"] → location.href
 */
function getCanonicalUrl(): string {
  try {
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) return (ogUrl as HTMLMetaElement).content || location.href;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) return (canonical as HTMLLinkElement).href || location.href;
  } catch {
    // fall through
  }
  return location.href;
}

/**
 * Safely queries a single element and returns its text content, or "".
 */
function queryText(selector: string): string {
  try {
    const el = document.querySelector(selector);
    if (!el) return '';
    if (el instanceof HTMLMetaElement) return el.content || '';
    return el.textContent || '';
  } catch {
    return '';
  }
}

/**
 * Tries multiple selectors in order, returning the first non-empty result.
 */
function queryFirstText(...selectors: string[]): string {
  for (const sel of selectors) {
    const val = queryText(sel);
    if (val.trim()) return val;
  }
  return '';
}

/**
 * Searches iCIMS job header fields for a keyword match and returns the text.
 */
function getHeaderFieldText(keyword: string): string {
  try {
    const fields = document.querySelectorAll('[class*="iCIMS_JobHeaderField"]');
    for (const field of Array.from(fields)) {
      const text = field.textContent || '';
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        return text;
      }
    }
  } catch {
    // fall through
  }
  return '';
}

/**
 * Detects work arrangement from iCIMS job header fields.
 */
function detectWorkArrangement(): string {
  try {
    const fields = document.querySelectorAll('[class*="iCIMS_JobHeaderField"]');
    for (const field of Array.from(fields)) {
      const text = field.textContent || '';
      if (/\bremote\b/i.test(text)) return 'Remote';
      if (/\bhybrid\b/i.test(text)) return 'Hybrid';
      if (/\bon-site\b/i.test(text)) return 'On-site';
    }
  } catch {
    // fall through
  }
  return '';
}

/**
 * Extracts company name from page title or og:site_name.
 */
function extractCompanyName(): string {
  try {
    const siteName = queryText('meta[property="og:site_name"]');
    if (siteName.trim()) return siteName;
    const title = document.title || '';
    const match = title.match(/\bat\s+(.+)$/i);
    if (match) return match[1].trim();
  } catch {
    // fall through
  }
  return '';
}

function scrape(): JobRecord {
  try {
    let jobTitle = '';
    try {
      jobTitle = sanitize(queryFirstText(
        'h1[class*="iCIMS_Header"]',
        'h1[class*="job-title"]',
        'h1',
        '[class*="iCIMS_JobTitle"]'
      ));
    } catch { jobTitle = ''; }

    let companyName = '';
    try {
      companyName = sanitize(
        queryFirstText('[class*="iCIMS_CompanyName"]') ||
        extractCompanyName()
      );
    } catch { companyName = ''; }

    let location = '';
    try {
      location = sanitize(
        getHeaderFieldText('location') ||
        queryFirstText('[class*="location"]')
      );
    } catch { location = ''; }

    let jobTerm = '';
    try {
      jobTerm = sanitize(getHeaderFieldText('job type') || getHeaderFieldText('employment'));
    } catch { jobTerm = ''; }

    let employmentType = '';
    try {
      employmentType = sanitize(getHeaderFieldText('job type') || getHeaderFieldText('employment'));
    } catch { employmentType = ''; }

    let department = '';
    try {
      department = sanitize(getHeaderFieldText('department') || getHeaderFieldText('category'));
    } catch { department = ''; }

    let workArrangement = '';
    try {
      workArrangement = sanitize(detectWorkArrangement());
    } catch { workArrangement = ''; }

    const jobUrl = getCanonicalUrl();

    return { jobTitle, companyName, location, jobTerm, jobUrl, employmentType, department, workArrangement };
  } catch {
    return { ...EMPTY_JOB_RECORD, jobUrl: location.href };
  }
}

export const icimsScraper: PlatformScraper = {
  platform: 'icims',
  hostPattern: /\.icims\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(icimsScraper);
