import { greenhouseScraper } from "../src/content/scraper/platforms/greenhouse";
import { icimsScraper } from "../src/content/scraper/platforms/icims";
import { ripplematchScraper } from "../src/content/scraper/platforms/ripplematch";
import { workdayScraper } from "../src/content/scraper/platforms/workday";
import { matchKnownPlatform } from "../src/content/detector/platforms";
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
});
