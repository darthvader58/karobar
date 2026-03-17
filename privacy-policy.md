# Privacy Policy for Karobar

**Last updated:** March 16, 2026

Karobar is a Chrome extension that helps you track job applications by logging job details to your personal Google Sheet. This privacy policy explains what data Karobar collects, how it's used, and how it's protected.

---

## What Data We Collect

Karobar collects and processes the following data:

1. **Job page content** — When you visit a job application page and choose to log it, or manually click **Scrape Current Page** from the extension UI, Karobar reads the page content to extract job details (title, company, location, employment type, etc.)

2. **Google account information** — When you sign in, Karobar receives your Google account authentication token to access the Google Sheets API on your behalf

3. **User preferences** — Your configured Google Sheet ID, custom URL patterns, and recent application records are stored locally in Chrome's storage

---

## How We Use Your Data

- **Job page scraping** — Extracted job details are sent directly to your Google Sheet via the Google Sheets API. No data is sent to any other server or third party.

- **Authentication** — Your Google OAuth token is used solely to authenticate API requests to Google Sheets. It is managed by Chrome's identity API and never leaves your browser.

- **Local storage** — Your sheet configuration, custom patterns, recent records, and failed write queue are stored locally in Chrome's sync and local storage. This data is never transmitted to any external server operated by Karobar.

---

## Data Sharing and Third Parties

Karobar does not:
- Sell, rent, or share your data with any third parties
- Collect analytics or telemetry
- Send data to any server other than Google's Sheets API (which you explicitly authorize)
- Use your data for advertising or marketing purposes

The only external service Karobar communicates with is the **Google Sheets API**, and only when you explicitly choose to log a job application, either from the page overlay or by using **Scrape Current Page** in the extension UI.

---

## Data Storage and Security

- All user preferences and recent records are stored locally in your browser using Chrome's storage API
- Your Google OAuth token is managed securely by Chrome's identity API
- Karobar does not operate any backend servers or databases
- All data remains under your control — you can clear it at any time by uninstalling the extension or clearing Chrome's extension data

---

## Permissions Explained

Karobar requests the following Chrome permissions:

- **`activeTab`** — To read the content of the current tab when you confirm you want to log a job application
- **`tabs`** — To detect URL changes and dismiss the prompt when you navigate away from a job page
- **`identity`** — To authenticate you with Google via OAuth 2.0 so the extension can write to your Google Sheet
- **`storage`** — To save your sheet configuration, custom URL patterns, and recent application records locally
- **`<all_urls>` (host permissions)** — To run the job page detector on any website, since job applications appear across many different domains

---

## Your Rights

You have full control over your data:

- **Access** — All data is stored locally in your browser and can be viewed in Chrome's extension storage inspector
- **Deletion** — Uninstall the extension or clear Chrome's extension data to delete all stored information
- **Revoke access** — Sign out from the extension popup or revoke access from your [Google Account permissions page](https://myaccount.google.com/permissions)

---

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be posted on this page with an updated "Last updated" date. Continued use of Karobar after changes constitutes acceptance of the updated policy.

---

## Contact

If you have questions or concerns about this privacy policy, please contact:

**Email:** rajayshashwat@gmail.com  
**GitHub:** [https://github.com/darthvader58/karobar](https://github.com/darthvader58/karobar)

---

## Compliance

Karobar complies with:
- Chrome Web Store Developer Program Policies
- Google API Services User Data Policy
- General Data Protection Regulation (GDPR) principles of data minimization and user control
