import type { ApplicationStageFields, JobRecord } from "./types";

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

export const EMPTY_APPLICATION_STAGE_FIELDS: ApplicationStageFields = {
  currentStage: "",
  oaDeadline: "",
  round1Date: "",
  round1Deadline: "",
  round2Date: "",
  round2Deadline: "",
  finalRoundDate: "",
  finalRoundDeadline: "",
  outcome: "",
  gmailThreadId: "",
  lastGmailSync: "",
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
  "Current Stage",
  "OA Deadline",
  "Round 1 Date",
  "Round 1 Deadline",
  "Round 2 Date",
  "Round 2 Deadline",
  "Final Round Date",
  "Final Round Deadline",
  "Outcome",
  "Gmail Thread ID",
  "Last Gmail Sync",
] as const;

export const SHEET_COLUMN_INDEX = Object.freeze(
  SHEET_COLUMNS.reduce<Record<(typeof SHEET_COLUMNS)[number], number>>((acc, column, index) => {
    acc[column] = index;
    return acc;
  }, {} as Record<(typeof SHEET_COLUMNS)[number], number>)
);

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
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.currentStage),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.oaDeadline),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.round1Date),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.round1Deadline),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.round2Date),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.round2Deadline),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.finalRoundDate),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.finalRoundDeadline),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.outcome),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.gmailThreadId),
    sanitize(EMPTY_APPLICATION_STAGE_FIELDS.lastGmailSync),
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
