import type { JobRecord } from "./types";

/**
 * Strips HTML tags and trims whitespace from a raw string.
 * Returns "" for null/undefined input. Never throws.
 */
export function sanitize(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw.replace(/<[^>]*>/g, "").trim();
}

/**
 * A JobRecord with all fields set to "".
 * Useful as a fallback when scraping fails entirely.
 */
export const EMPTY_JOB_RECORD: JobRecord = {
  jobTitle: "",
  companyName: "",
  location: "",
  jobTerm: "",
  jobUrl: "",
  employmentType: "",
  department: "",
  workArrangement: "",
};

/**
 * Column header names in sheet order.
 */
export const SHEET_COLUMNS = [
  "Date Applied",
  "Job Title",
  "Company Name",
  "Location",
  "Job Term",
  "Employment Type",
  "Department",
  "Work Arrangement",
  "Job URL",
] as const;

/**
 * Serializes a JobRecord + dateApplied into a 9-element string array
 * matching the SHEET_COLUMNS order. Each value is sanitized.
 */
export function recordToRow(record: JobRecord, dateApplied: string): string[] {
  return [
    sanitize(dateApplied),
    sanitize(record.jobTitle),
    sanitize(record.companyName),
    sanitize(record.location),
    sanitize(record.jobTerm),
    sanitize(record.employmentType),
    sanitize(record.department),
    sanitize(record.workArrangement),
    sanitize(record.jobUrl),
  ];
}

/**
 * Reconstructs a JobRecord from a row array (inverse of recordToRow).
 * Missing indices default to "". Each value is sanitized.
 */
export function rowToRecord(row: string[]): JobRecord {
  return {
    jobTitle: sanitize(row[1]),
    companyName: sanitize(row[2]),
    location: sanitize(row[3]),
    jobTerm: sanitize(row[4]),
    employmentType: sanitize(row[5]),
    department: sanitize(row[6]),
    workArrangement: sanitize(row[7]),
    jobUrl: sanitize(row[8]),
  };
}
