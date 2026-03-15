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

/** Extracts company name from the first subdomain of the hostname. */
function extractCompanyFromHostname(): string {
  try {
    const parts = location.hostname.split('.');
    if (parts.length > 0) return parts[0];
  } catch { /* fall through */ }
  return '';
}

function detectWorkArrangement(): string {
  try {
    const wsEl = document.querySelector('[data-automation-id="workspaceType"]');
    if (wsEl) {
      const text = wsEl.textContent || '';
      if (/\bremote\b/i.test(text)) return 'Remote';
      if (/\bhybrid\b/i.test(text)) return 'Hybrid';
      if (/\bon-site\b/i.test(text)) return 'On-site';
      if (text.trim()) return text.trim();
    }
  } catch { /* fall through */ }
  try {
    const locEl = document.querySelector('[data-automation-id="locations"]') ||
                  document.querySelector('[data-automation-id="location"]');
    if (locEl) {
      const text = locEl.textContent || '';
      if (/\bremote\b/i.test(text)) return 'Remote';
      if (/\bhybrid\b/i.test(text)) return 'Hybrid';
    }
  } catch { /* fall through */ }
  return '';
}

function scrape(): JobRecord {
  try {
    let jobTitle = '';
    try {
      jobTitle = sanitize(queryFirstText(
        '[data-automation-id="jobPostingHeader"]',
        'h1[class*="css-"]',
        'h1'
      ));
    } catch { jobTitle = ''; }

    let companyName = '';
    try {
      companyName = sanitize(
        queryFirstText('[data-automation-id="company-name"]') ||
        queryText('meta[property="og:site_name"]') ||
        extractCompanyFromHostname()
      );
    } catch { companyName = ''; }

    let location = '';
    try {
      location = sanitize(queryFirstText(
        '[data-automation-id="locations"]',
        '[data-automation-id="location"]',
        '[class*="location"]'
      ));
    } catch { location = ''; }

    let jobTerm = '';
    try {
      jobTerm = sanitize(queryFirstText(
        '[data-automation-id="time"]',
        '[data-automation-id="jobPostingTimeType"]'
      ));
    } catch { jobTerm = ''; }

    let employmentType = '';
    try {
      employmentType = sanitize(queryFirstText(
        '[data-automation-id="time"]',
        '[data-automation-id="jobPostingTimeType"]'
      ));
    } catch { employmentType = ''; }

    let department = '';
    try {
      department = sanitize(queryFirstText(
        '[data-automation-id="department"]',
        '[data-automation-id="jobPostingDepartment"]'
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

export const workdayScraper: PlatformScraper = {
  platform: 'workday',
  hostPattern: /(?:myworkdayjobs|workday)\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(workdayScraper);
