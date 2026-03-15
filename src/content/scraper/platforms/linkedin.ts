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
 * Searches job criteria items for a label match and returns the adjacent value text.
 */
function getJobCriteriaText(labelKeyword: string): string {
  try {
    const items = document.querySelectorAll('[class*="job-criteria__item"]');
    for (const item of Array.from(items)) {
      const label = item.querySelector('[class*="job-criteria__subheader"]');
      if (label && label.textContent && label.textContent.toLowerCase().includes(labelKeyword.toLowerCase())) {
        const value = item.querySelector('[class*="job-criteria__text"]');
        if (value) return value.textContent || '';
      }
    }
  } catch {
    // fall through
  }
  return '';
}

/**
 * Detects work arrangement from location text or workplace-type element.
 */
function detectWorkArrangement(): string {
  try {
    const workplaceEl = document.querySelector('[class*="workplace-type"]');
    if (workplaceEl) {
      const text = workplaceEl.textContent || '';
      if (/\bremote\b/i.test(text)) return 'Remote';
      if (/\bhybrid\b/i.test(text)) return 'Hybrid';
      if (/\bon-site\b/i.test(text)) return 'On-site';
    }
  } catch {
    // fall through
  }
  try {
    const locationEl = document.querySelector('[class*="topcard__flavor--bullet"]');
    if (locationEl) {
      const text = locationEl.textContent || '';
      if (/\bremote\b/i.test(text)) return 'Remote';
      if (/\bhybrid\b/i.test(text)) return 'Hybrid';
      if (/\bon-site\b/i.test(text)) return 'On-site';
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
        'h1.top-card-layout__title',
        'h1[class*="job-title"]',
        'h1'
      ));
    } catch { jobTitle = ''; }

    let companyName = '';
    try {
      companyName = sanitize(queryFirstText(
        'a.topcard__org-name-link',
        '[class*="company-name"]',
        '[class*="topcard__flavor--black-link"]'
      ));
    } catch { companyName = ''; }

    let location = '';
    try {
      location = sanitize(queryFirstText(
        '[class*="topcard__flavor--bullet"]',
        '[class*="job-criteria__text"]'
      ));
    } catch { location = ''; }

    let jobTerm = '';
    try {
      jobTerm = sanitize(getJobCriteriaText('employment type') || getJobCriteriaText('job type'));
    } catch { jobTerm = ''; }

    let employmentType = '';
    try {
      employmentType = sanitize(getJobCriteriaText('employment type') || getJobCriteriaText('job type'));
    } catch { employmentType = ''; }

    let department = '';
    try {
      department = sanitize(getJobCriteriaText('job function') || getJobCriteriaText('industries'));
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

export const linkedinScraper: PlatformScraper = {
  platform: 'linkedin',
  hostPattern: /linkedin\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(linkedinScraper);
