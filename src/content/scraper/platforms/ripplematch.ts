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

function detectWorkArrangement(): string {
  try {
    const selectors = ['[class*="location"]', '[class*="work-type"]'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of Array.from(els)) {
        const text = el.textContent || '';
        if (/\bremote\b/i.test(text)) return 'Remote';
        if (/\bhybrid\b/i.test(text)) return 'Hybrid';
        if (/\bon-site\b/i.test(text)) return 'On-site';
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
        'h1[class*="job-title"]',
        'h1[class*="title"]',
        'h1'
      ));
    } catch { jobTitle = ''; }

    let companyName = '';
    try {
      companyName = sanitize(
        queryFirstText('[class*="company-name"]', '[class*="employer-name"]') ||
        queryText('meta[property="og:site_name"]')
      );
    } catch { companyName = ''; }

    let location = '';
    try {
      location = sanitize(queryFirstText(
        '[class*="location"]',
        '[class*="job-location"]'
      ));
    } catch { location = ''; }

    let jobTerm = '';
    try {
      jobTerm = sanitize(queryFirstText(
        '[class*="job-type"]',
        '[class*="employment-type"]'
      ));
    } catch { jobTerm = ''; }

    let employmentType = '';
    try {
      employmentType = sanitize(queryFirstText(
        '[class*="job-type"]',
        '[class*="employment-type"]'
      ));
    } catch { employmentType = ''; }

    let department = '';
    try {
      department = sanitize(queryFirstText(
        '[class*="department"]',
        '[class*="team"]'
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

export const ripplematchScraper: PlatformScraper = {
  platform: 'ripplematch',
  hostPattern: /ripplematch\.com/i,
  scrape,
};

PLATFORM_REGISTRY.push(ripplematchScraper);
