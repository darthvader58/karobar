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
 * Extracts company name from the URL path (second segment after domain).
 * e.g. boards.greenhouse.io/company/jobs/123 → "company"
 */
function extractCompanyFromUrl(): string {
  try {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[0];
  } catch {
    // fall through
  }
  return '';
}

/**
 * Extracts company name from page title (often "Job Title at Company").
 */
function extractCompanyFromTitle(): string {
  try {
    const title = document.title || '';
    const match = title.match(/\bat\s+(.+)$/i);
    if (match) return match[1].trim();
  } catch {
    // fall through
  }
  return '';
}

/**
 * Detects work arrangement from location or metadata text.
 */
function detectWorkArrangement(): string {
  try {
    const selectors = ['[class*="location"]', '.location', '[class*="offices"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el.textContent || '';
        if (/\bremote\b/i.test(text)) return 'Remote';
        if (/\bhybrid\b/i.test(text)) return 'Hybrid';
        if (/\bon-site\b/i.test(text)) return 'On-site';
      }
    }
  } catch {
    // fall through
  }
  return '';
}

/**
 * Detects employment type from metadata elements.
 */
function detectEmploymentType(): string {
  try {
    const el = document.querySelector('[class*="employment-type"]');
    if (el) return el.textContent || '';
  } catch {
    // fall through
  }
  try {
    const selectors = ['[class*="metadata"]', '[class*="details"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el.textContent || '';
        if (/\bfull[- ]?time\b/i.test(text)) return 'Full-time';
        if (/\bpart[- ]?time\b/i.test(text)) return 'Part-time';
        if (/\binternship\b/i.test(text)) return 'Internship';
        if (/\bcontract\b/i.test(text)) return 'Contract';
      }
    }
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
        'h1.app-title',
        'h1[class*="title"]',
        'h1'
      ));
    } catch { jobTitle = ''; }

    let companyName = '';
    try {
      companyName = sanitize(
        queryFirstText('[class*="company"]') ||
        extractCompanyFromTitle() ||
        extractCompanyFromUrl()
      );
    } catch { companyName = ''; }

    let location = '';
    try {
      location = sanitize(queryFirstText(
        '[class*="location"]',
        '.location',
        '[class*="offices"]'
      ));
    } catch { location = ''; }

    let jobTerm = '';
    try {
      jobTerm = sanitize(detectEmploymentType());
    } catch { jobTerm = ''; }

    let employmentType = '';
    try {
      employmentType = sanitize(detectEmploymentType());
    } catch { employmentType = ''; }

    let department = '';
    try {
      department = sanitize(queryFirstText(
        '[class*="department"]',
        '.department'
      ));
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

export const greenhouseScraper: PlatformScraper = {
  platform: 'greenhouse',
  hostPattern: /greenhouse\.io/i,
  scrape,
};

PLATFORM_REGISTRY.push(greenhouseScraper);
