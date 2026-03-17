# Karobar

A Chrome extension that automatically detects job application pages and logs them to a Google Sheet — so you never lose track of where you applied.

---

## What it does

When you land on a job application page, Karobar pops up and asks if you want to log it. One click and it scrapes the job details and appends a row to your Google Sheet with:

- Job title
- Company name
- Location
- Job term (e.g. Summer 2026)
- Link to the job application
- Employment type (full-time / internship)
- Department
- Work arrangement (remote / hybrid / in-person)
- Date applied 

It works on named platforms (LinkedIn, Greenhouse, iCIMS, Workday, RippleMatch, Lever, SmartRecruiters) with dedicated scrapers, and falls back to a best-effort generic scraper for any other job page. Fields that can't be scraped are left blank for you to fill in manually.

---

## Usage

Navigate to any job application page. If Karobar detects it as a job page, an overlay will appear:

- **Add to Sheet** — scrapes the page and logs the job to your sheet
- **Dismiss** — closes the overlay without logging

The overlay also shows a warning if you've already logged that URL before.

If automatic detection misses a page, you can still open the extension UI and click **Scrape Current Page** to force a scrape on the active tab and log it manually.

### Custom URL patterns

For job pages on company-specific sites that aren't in the built-in platform list, you can add custom URL patterns in the popup:

```
https://*.mycompany.com/careers/*
https://jobs.example.com/*
```

These follow [Chrome match pattern syntax](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns).

---

## How detection works

Karobar uses a three-signal priority pipeline to identify job pages with low false-positive rate:

1. **Known platform URL match** — checks hostname + path against a registry of known job platforms and any custom patterns you've added. Highest confidence, lowest latency.
2. **Structured data** — looks for `JobPosting` JSON-LD or Open Graph job meta tags on the page.
3. **Application surface heuristic** — checks for real applicant fields, submit controls, resume upload, and job identity cues in the URL/title/page copy. This is what lets Karobar catch custom employer-hosted application pages beyond the named ATS platforms.

Pages that only contain job-related keywords (without structural signals) are intentionally not detected, to avoid false positives on job listing pages.

---

If you liked the project, don't forget to leave a star and consider <a href="https://github.com/sponsors/darthvader58">sponsoring</a> as your way of showing love to this extension.

Made with &lt;3 by Shashwat Raj. 
