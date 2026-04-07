import { greenhouseScraper } from "../src/content/scraper/platforms/greenhouse";
import { ashbyScraper } from "../src/content/scraper/platforms/ashby";
import { icimsScraper } from "../src/content/scraper/platforms/icims";
import { linkedinScraper } from "../src/content/scraper/platforms/linkedin";
import { leverScraper } from "../src/content/scraper/platforms/lever";
import { ripplematchScraper } from "../src/content/scraper/platforms/ripplematch";
import { smartrecruitersScraper } from "../src/content/scraper/platforms/smartrecruiters";
import { workdayScraper } from "../src/content/scraper/platforms/workday";
import { matchKnownPlatform } from "../src/content/detector/platforms";
import { signalUrlAndForm } from "../src/content/detector/signals";
import { inferJobTerm } from "../src/content/scraper/utils";

function setPage(url: string, html: string): void {
  vi.stubGlobal("location", new URL(url) as unknown as Location);
  document.documentElement.innerHTML = html;
}

describe("ATS scraper regressions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("infers the current year for seasonal greenhouse internship terms", () => {
    expect(
      inferJobTerm(["Intern, Computer Vision (Spring/Summer)"], new Date("2026-03-16T00:00:00Z"))
    ).toBe("Spring/Summer 2026");
  });

  it("scrapes greenhouse title, term, and employment type from the application page", () => {
    setPage(
      "https://job-boards.greenhouse.io/samsungresearchamericainternship/jobs/8216250002",
      `<!doctype html>
      <html>
        <head>
          <title>Job Application for 2026 Intern, Computer Vision (Spring/Summer) at Samsung Research America Internship</title>
          <meta property="og:title" content="2026 Intern, Computer Vision (Spring/Summer)">
          <meta property="og:description" content="665 Clyde Avenue, Mountain View, CA, USA">
          <meta property="og:url" content="https://job-boards.greenhouse.io/samsungresearchamericainternship/jobs/8216250002">
        </head>
        <body>
          <h1>2026 Intern, Computer Vision (Spring/Summer)</h1>
          <div class="location">665 Clyde Avenue, Mountain View, CA, USA</div>
          <script>
            window.__appState = {"props":{"pageProps":{"data":{"jobPost":{"title":"2026 Intern, Computer Vision (Spring/Summer)","location":{"name":"665 Clyde Avenue, Mountain View, CA, USA"},"questions":[{"label":"Please identify your target internship dates.","fields":[{"values":[{"label":"Internship - Spring (January to April) 2026"},{"label":"Internship - Summer (May to August) 2026"}]}]}]}}}}};
          </script>
        </body>
      </html>`
    );

    const record = greenhouseScraper.scrape();

    expect(record.jobTitle).toBe("2026 Intern, Computer Vision (Spring/Summer)");
    expect(record.companyName).toBe("Samsung Research America Internship");
    expect(record.location).toBe("665 Clyde Avenue, Mountain View, CA, USA");
    expect(record.jobTerm).toBe("Spring/Summer 2026");
    expect(record.employmentType).toBe("Internship");
    expect(record.jobUrl).toBe(
      "https://job-boards.greenhouse.io/samsungresearchamericainternship/jobs/8216250002"
    );
  });

  it("scrapes Ashby postings from runtime app data", () => {
    setPage(
      "https://jobs.ashbyhq.com/openai/c9861998-2746-4453-b642-c126a24b6f5d",
      `<!doctype html>
      <html>
        <head>
          <title>Forward Deployed Engineer, API</title>
          <meta property="og:title" content="Forward Deployed Engineer, API">
        </head>
        <body></body>
      </html>`
    );
    (window as unknown as { __appData?: unknown }).__appData = {
      organization: { name: "OpenAI", hostedJobsPageSlug: "openai" },
      posting: {
        id: "c9861998-2746-4453-b642-c126a24b6f5d",
        title: "Forward Deployed Engineer, API",
        departmentName: "Engineering",
        teamName: "API",
        locationName: "San Francisco",
        workplaceType: "Hybrid",
        employmentType: "FullTime",
        compensationTierSummary: "$220K – $300K • Offers Equity",
      },
      jobBoard: { name: "OpenAI Jobs" },
    };

    const record = ashbyScraper.scrape();

    expect(record.jobTitle).toBe("Forward Deployed Engineer, API");
    expect(record.companyName).toBe("OpenAI");
    expect(record.location).toBe("San Francisco");
    expect(record.employmentType).toBe("Full-time");
    expect(record.department).toBe("API");
    expect(record.workArrangement).toBe("Hybrid");
    expect(record.jobUrl).toBe("https://jobs.ashbyhq.com/openai/c9861998-2746-4453-b642-c126a24b6f5d");
  });

  it("scrapes Ashby application pages by matching the posting id in the job board payload", () => {
    setPage(
      "https://jobs.ashbyhq.com/openai/c9861998-2746-4453-b642-c126a24b6f5d/application",
      `<!doctype html>
      <html>
        <head>
          <title>Apply for Forward Deployed Engineer, API</title>
        </head>
        <body>
          <h1 data-testid="job-posting-title">Forward Deployed Engineer, API</h1>
        </body>
      </html>`
    );
    (window as unknown as { __appData?: unknown }).__appData = {
      organization: { name: "OpenAI", hostedJobsPageSlug: "openai" },
      posting: null,
      jobBoard: {
        name: "OpenAI Jobs",
        postings: [
          {
            id: "c9861998-2746-4453-b642-c126a24b6f5d",
            title: "Forward Deployed Engineer, API",
            departmentName: "Engineering",
            teamName: "API",
            locationName: "San Francisco",
            workplaceType: "Hybrid",
            employmentType: "FullTime",
            compensationTierSummary: "$220K – $300K • Offers Equity",
          },
        ],
      },
    };

    expect(matchKnownPlatform(window.location.href)).toEqual({ platform: "ashby" });

    const record = ashbyScraper.scrape();

    expect(record.jobTitle).toBe("Forward Deployed Engineer, API");
    expect(record.companyName).toBe("OpenAI");
    expect(record.location).toBe("San Francisco");
    expect(record.employmentType).toBe("Full-time");
    expect(record.department).toBe("API");
    expect(record.workArrangement).toBe("Hybrid");
    expect(record.jobUrl).toBe(
      "https://jobs.ashbyhq.com/openai/c9861998-2746-4453-b642-c126a24b6f5d/application"
    );
  });

  it("scrapes workday fields from JSON-LD instead of noisy DOM text", () => {
    setPage(
      "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/details/Manager--Site-Reliability-Engineer---DGX-Cloud_JR2010800-1",
      `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/Manager--Site-Reliability-Engineer---DGX-Cloud_JR2010800-1">
          <meta property="og:title" content="Manager, Site Reliability Engineer - DGX Cloud">
          <meta property="og:description" content="NVIDIA has been transforming computer graphics.">
          <meta property="og:url" content="https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/details/Manager--Site-Reliability-Engineer---DGX-Cloud_JR2010800-1">
          <script type="application/ld+json">
            {"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"India","addressLocality":"India, Remote"}},"hiringOrganization":{"name":"IN01 NVIDIA Graphics Bengaluru","@type":"Organization"},"employmentType":"FULL_TIME","title":"Manager, Site Reliability Engineer - DGX Cloud","@context":"http://schema.org","@type":"JobPosting"}
          </script>
        </head>
        <body></body>
      </html>`
    );

    const record = workdayScraper.scrape();

    expect(record.jobTitle).toBe("Manager, Site Reliability Engineer - DGX Cloud");
    expect(record.companyName).toBe("NVIDIA");
    expect(record.location).toBe("India, Remote");
    expect(record.employmentType).toBe("Full-time");
    expect(record.workArrangement).toBe("Remote");
    expect(record.jobUrl).toBe(
      "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/details/Manager--Site-Reliability-Engineer---DGX-Cloud_JR2010800-1"
    );
  });

  it("scrapes LinkedIn job postings across current unified job layouts", () => {
    setPage(
      "https://www.linkedin.com/jobs/view/4232161209",
      `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="Software Engineer">
          <link rel="canonical" href="https://www.linkedin.com/jobs/view/4232161209">
        </head>
        <body>
          <div class="job-details-jobs-unified-top-card__job-title">
            <h1>Software Engineer</h1>
          </div>
          <a class="job-details-jobs-unified-top-card__company-name">OpenAI</a>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            OpenAI · San Francisco, California, United States
          </div>
          <div class="job-details-jobs-unified-top-card__tertiary-description-container">
            San Francisco, California, United States
          </div>
          <div class="job-details-jobs-unified-top-card__workplace-type">Hybrid</div>
          <ul>
            <li class="description__job-criteria-item">
              <h3 class="description__job-criteria-subheader">Employment type</h3>
              <span class="description__job-criteria-text">Full-time</span>
            </li>
            <li class="description__job-criteria-item">
              <h3 class="description__job-criteria-subheader">Job function</h3>
              <span class="description__job-criteria-text">Engineering</span>
            </li>
          </ul>
        </body>
      </html>`
    );

    const record = linkedinScraper.scrape();

    expect(record.jobTitle).toBe("Software Engineer");
    expect(record.companyName).toBe("OpenAI");
    expect(record.location).toContain("San Francisco");
    expect(record.employmentType).toBe("Full-time");
    expect(record.department).toContain("Engineering");
    expect(record.workArrangement).toBe("Hybrid");
    expect(record.jobUrl).toBe("https://www.linkedin.com/jobs/view/4232161209");
  });

  it("scrapes Lever postings with modern category blocks", () => {
    setPage(
      "https://jobs.lever.co/openai/abc123",
      `<!doctype html>
      <html>
        <head>
          <title>Research Engineer at OpenAI</title>
          <meta property="og:title" content="Research Engineer">
          <link rel="canonical" href="https://jobs.lever.co/openai/abc123">
        </head>
        <body>
          <div class="main-header-logo"><img alt="OpenAI"></div>
          <div class="posting-headline"><h2 data-qa="posting-name">Research Engineer</h2></div>
          <div class="posting-categories">
            <span class="sort-by-time-posting-category team">Applied AI</span>
            <span class="sort-by-time-posting-category location">San Francisco, CA</span>
            <span class="sort-by-time-posting-category commitment">Full-time</span>
          </div>
        </body>
      </html>`
    );

    const record = leverScraper.scrape();

    expect(record.jobTitle).toBe("Research Engineer");
    expect(record.companyName).toBe("OpenAI");
    expect(record.location).toContain("San Francisco");
    expect(record.employmentType).toBe("Full-time");
    expect(record.department).toBe("Applied AI");
    expect(record.jobUrl).toBe("https://jobs.lever.co/openai/abc123");
  });

  it("scrapes SmartRecruiters postings with structured data fallbacks", () => {
    setPage(
      "https://jobs.smartrecruiters.com/ExampleCo/744000082260485-customer-success-manager",
      `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="Customer Success Manager">
          <link rel="canonical" href="https://jobs.smartrecruiters.com/ExampleCo/744000082260485-customer-success-manager">
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"JobPosting","title":"Customer Success Manager","employmentType":"FULL_TIME","department":"Customer Success","jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"New York","addressRegion":"NY","addressCountry":"US"}},"hiringOrganization":{"@type":"Organization","name":"ExampleCo"},"url":"https://jobs.smartrecruiters.com/ExampleCo/744000082260485-customer-success-manager"}
          </script>
        </head>
        <body>
          <h1 class="job-title">Customer Success Manager</h1>
        </body>
      </html>`
    );

    const record = smartrecruitersScraper.scrape();

    expect(record.jobTitle).toBe("Customer Success Manager");
    expect(record.companyName).toBe("ExampleCo");
    expect(record.location).toContain("New York");
    expect(record.employmentType).toBe("Full-time");
    expect(record.department).toBe("Customer Success");
    expect(record.jobUrl).toBe(
      "https://jobs.smartrecruiters.com/ExampleCo/744000082260485-customer-success-manager"
    );
  });

  it("scrapes iCIMS job pages without falling back to the employer careers homepage", () => {
    setPage(
      "https://careers-gtsx.icims.com/jobs/1588/quantitative-trading-intern---summer-2027-internship/job",
      `<!doctype html>
      <html>
        <head>
          <title>Careers | GTS | Quantitative Trading Intern - Summer 2027 Internship in New York, New York | Careers at GTS</title>
          <meta property="og:title" content="Quantitative Trading Intern - Summer 2027 Internship in New York, New York | Careers at GTS">
          <meta property="og:site_name" content="GTS">
          <link rel="canonical" href="https://careers-gtsx.icims.com/jobs/1588/quantitative-trading-intern---summer-2027-internship/job">
          <script>
            var icimsSD = {"companyName":"GTS","job":{"location":"New York, New York, United States","title":"Quantitative Trading Intern - Summer 2027 Internship","jobUrls":[{"url":"https://careers-gtsx.icims.com/jobs/1588/quantitative-trading-intern---summer-2027-internship/job"}]}};
          </script>
          <script type="application/ld+json">
            {"hiringOrganization":{"@type":"Organization","name":"GTS"},"jobLocation":[{"address":{"addressCountry":"United States","addressLocality":"New York, New York"}}],"employmentType":"TEMPORARY","title":"Quantitative Trading Intern - Summer 2027 Internship","@type":"JobPosting"}
          </script>
        </head>
        <body>
          <a class="iCIMS_ApplyOnlineButton" href="https://careers-gtsx.icims.com/jobs/1588/quantitative-trading-intern---summer-2027-internship/job?mode=apply&apply=yes">Apply</a>
        </body>
      </html>`
    );

    const record = icimsScraper.scrape();

    expect(record.jobTitle).toBe("Quantitative Trading Intern - Summer 2027 Internship");
    expect(record.companyName).toBe("GTS");
    expect(record.location).toBe("New York, New York, United States");
    expect(record.jobTerm).toBe("Summer 2027");
    expect(record.employmentType).toBe("Internship");
    expect(record.jobUrl).toBe(
      "https://careers-gtsx.icims.com/jobs/1588/quantitative-trading-intern---summer-2027-internship/job"
    );
  });

  it("detects and scrapes RippleMatch public job pages", () => {
    setPage(
      "https://app.ripplematch.com/v2/public/job/e649f006",
      `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="Apply for a 2026 - Summer Analyst Internship - Global Markets : Equity Research role at BNP Paribas via RippleMatch">
          <meta property="og:site_name" content="RippleMatch">
          <meta property="og:url" content="https://ripplematch.com/v2/public/job/e649f006">
          <link rel="canonical" href="https://ripplematch.com/v2/public/job/e649f006">
        </head>
        <body></body>
      </html>`
    );

    expect(matchKnownPlatform(window.location.href)).toEqual({ platform: "ripplematch" });

    const record = ripplematchScraper.scrape();

    expect(record.jobTitle).toBe("2026 - Summer Analyst Internship - Global Markets : Equity Research");
    expect(record.companyName).toBe("BNP Paribas");
    expect(record.jobTerm).toBe("Summer 2026");
    expect(record.employmentType).toBe("Internship");
    expect(record.jobUrl).toBe("https://app.ripplematch.com/v2/public/job/e649f006");
  });

  it("detects Tesla careers job URLs", () => {
    expect(
      matchKnownPlatform("https://www.tesla.com/careers/search/job/service-assistant-261564")
    ).toEqual({ platform: "tesla" });
  });

  it("detects custom application pages that are not tied to a known ATS vendor", () => {
    setPage(
      "https://www.citadel.com/careers/details/software-engineer-intern/",
      `<!doctype html>
      <html>
        <head>
          <title>Job Application for Software Engineer Intern</title>
          <meta property="og:title" content="Software Engineer Intern">
        </head>
        <body>
          <main>
            <h1>Software Engineer Intern</h1>
            <p>Apply for this job</p>
            <form action="/apply">
              <input name="first_name" autocomplete="given-name">
              <input name="last_name" autocomplete="family-name">
              <input name="email" type="email" autocomplete="email">
              <input type="file" name="resume">
              <button type="submit">Submit application</button>
            </form>
          </main>
        </body>
      </html>`
    );

    expect(signalUrlAndForm()).toBe(true);
  });

  it("does not flag generic contact forms as job applications", () => {
    setPage(
      "https://www.example.com/contact",
      `<!doctype html>
      <html>
        <head>
          <title>Contact Us</title>
        </head>
        <body>
          <main>
            <h1>Contact Us</h1>
            <form action="/contact">
              <input name="first_name">
              <input name="last_name">
              <input name="email" type="email">
              <button type="submit">Submit</button>
            </form>
          </main>
        </body>
      </html>`
    );

    expect(signalUrlAndForm()).toBe(false);
  });
});
