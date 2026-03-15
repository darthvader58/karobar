import type { JobRecord } from '../../../shared/types';
import type { PlatformScraper } from '../../../shared/types';
import { sanitize, EMPTY_JOB_RECORD } from '../../../shared/sanitize';
import { PLATFORM_REGISTRY } from '../registry';

function getCanonicalUrl(): string {
  try {
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) return (ogUrl as HTMLMetaElement).content || location.href;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) return (canonical as HTMLLinkElement).href || location.href;
  } catch { /* fall through */ }
  return location.href;
}

function queryText(selector: string): string {
  try {
    const el = document.querySelector(selector);
    if (!el) return '';
    if (el instanceof HTMLMetaElement) return el.content || '';
    return el.textContent || '';
  } catch { return ''; }
}

function queryFirstText(...selectors: string[]): string {
  for (const sel of selectors) {
    const val = queryText(sel);
    if (val.trim()) return val;
  }
  return '';
}

/**
 * Extracts company name from the URL path first segment.
 * e.g. jobs.lever.co/company/uuid → "company"
 */
function extractCompanyFromUrl(): string {
  try {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[0];
  } catch { /* fall through */ }
  return '';
}

/**
 * Extracts company name from the logo alt text or page title.
 */
function extractCompanyFromPage(): string {
  try {
    const logoEl = document.querySelector('[class*="main-header-logo"] img');
    if (logoEl) {
      const alt = (logoEl as HTMLImageElement).alt;
      if (alt && alt.trim()) return alt.trim();
    }
  } catch { /* fall through */ }
  try {
    const title = document.title || '';
    const match = title.match(/\bat\s+(.+)$/i);
    if (match) return match[1].trim();
  } catch { /* fall through */ }
  return '';
}

function detectWorkArrangement(): string {
  try {
    const selectors = ['[class*="location"]', '[data-qa="posting-location"]', '.location', '[data-qa="posting-commitment"]', '[class*="commitment"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent || '';
        if (/\bremote\b/i.test(text)) return 'Remote';
        if (/\bhybrid\b/i.test(text)) return 'Hybrid';
      }
    }
  } catch { /* fall through */ }
  return '';
}

function scrape(): JobRecord {
  try {
    let jobTitle = '';
    try {
      jobTitle = sanitize(queryFirstText(
        'h2[data-qa="posting-name"]',
        'h2[class*="posting-headline"]',
        'h2',
        'h1'
      ));
    } catch { jobTitle = ''; }

    let companyName = '';
    try {
      companyName = sanitize(extractCompanyFromPage() || extractCompanyFromUrl());
    } catch { companyName = ''; }

    let location = '';
    try {
      location = sanitize(queryFirstText(
        '[class*="location"]',
        '[data-qa="posting-location"]',
        '.location'
      ));
    } catch { location = ''; }

    let jobTerm = '';
    try {
      jobTerm = sanitize(queryFirstText(
        '[data-qa="posting-commitment"]',
        '[class*="commitment"]'
      ));
    } catch { jobTerm = ''; }

    let employmentType = '';
    try {
      employmentType = sanitize(queryFirstText(
        '[data-qa="posting-commitment"]',
        '[class*="commitment"]'
      ));
    } catch { employmentType = ''; }

    let department = '';
    try {
      department = sanitize(queryFirstText(
        '[data-qa="posting-team"]',
        '[class*="team"]',
        '[class*="department"]'
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

export const leverScraper: PlatformScraper = {
  platform: 'lever',
  hostPattern: /jobs\.lever\.co/i,
  scrape,
};

PLATFORM_REGISTRY.push(leverScraper);
