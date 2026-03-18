import { recordToRow, SHEET_COLUMNS } from "../src/shared/sanitize";

describe("sheet schema", () => {
  it("serializes base application rows with empty Gmail tracking columns", () => {
    const row = recordToRow(
      {
        jobTitle: "Software Engineer",
        companyName: "OpenAI",
        location: "San Francisco, CA",
        jobTerm: "",
        jobUrl: "https://example.com/jobs/1",
        employmentType: "Full-time",
        department: "Engineering",
        workArrangement: "Hybrid",
      },
      "2026-03-18"
    );

    expect(row).toHaveLength(SHEET_COLUMNS.length);
    expect(row[0]).toBe("2026-03-18");
    expect(row[1]).toBe("Software Engineer");
    expect(row[8]).toBe("https://example.com/jobs/1");
    expect(row[9]).toBe("");
    expect(row[row.length - 1]).toBe("");
  });
});
