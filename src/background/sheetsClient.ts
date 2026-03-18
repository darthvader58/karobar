/**
 * Google Sheets API client with retry logic.
 * Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 5.3
 */

import type { GmailStageExtraction, JobRecord, ValidationResult } from "../shared/types";
import { recordToRow, sanitize, SHEET_COLUMNS, SHEET_COLUMN_INDEX } from "../shared/sanitize";
import { getToken } from "./auth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_RANGE = `A:${String.fromCharCode(64 + SHEET_COLUMNS.length)}`;

interface SheetValuesResponse {
  values?: string[][];
}

function normalize(value: string | undefined): string {
  return sanitize(value).toLowerCase();
}

function scoreRow(row: string[], extraction: GmailStageExtraction): number {
  let score = 0;
  const jobTitle = normalize(row[SHEET_COLUMN_INDEX["Job Title"]]);
  const companyName = normalize(row[SHEET_COLUMN_INDEX["Company Name"]]);
  const jobUrl = normalize(row[SHEET_COLUMN_INDEX["Job URL"]]);
  const gmailThreadId = normalize(row[SHEET_COLUMN_INDEX["Gmail Thread ID"]]);

  if (gmailThreadId && extraction.gmailThreadId && gmailThreadId === normalize(extraction.gmailThreadId)) {
    score += 100;
  }
  if (jobUrl && extraction.jobUrl && jobUrl === normalize(extraction.jobUrl)) {
    score += 80;
  }
  if (companyName && extraction.companyName && companyName === normalize(extraction.companyName)) {
    score += 40;
  }
  if (jobTitle && extraction.jobTitle && jobTitle === normalize(extraction.jobTitle)) {
    score += 30;
  }

  if (jobTitle && extraction.jobTitle) {
    const rowTokens = new Set(jobTitle.split(/[^a-z0-9]+/).filter(Boolean));
    const extractionTokens = normalize(extraction.jobTitle)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    let overlap = 0;
    for (const token of extractionTokens) {
      if (rowTokens.has(token)) overlap += 1;
    }
    score += Math.min(overlap * 4, 20);
  }

  return score;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

class SheetsApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "SheetsApiError";
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000, 4000];
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const status = (err as SheetsApiError).status;

      // Non-retryable: throw immediately
      if (status === 401 || status === 403 || status === 404) throw err;

      // Retryable: wait then retry (except on last attempt)
      if (attempt < 2) await sleep(delays[attempt]);
    }
  }

  throw lastError;
}

async function sheetsGet(token: string, url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new SheetsApiError(res.status, await res.text());
  return res.json();
}

async function sheetsPost(
  token: string,
  url: string,
  body: unknown,
  method = "POST"
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new SheetsApiError(res.status, await res.text());
  return res.json();
}

// ---------------------------------------------------------------------------
// SheetsClient
// ---------------------------------------------------------------------------

export class SheetsClient {
  /**
   * Reads A1 and inserts the header row if it is missing or mismatched.
   */
  async ensureHeader(sheetId: string): Promise<void> {
    const token = await getToken(false);

    await withRetry(async () => {
      const data = (await sheetsGet(
        token,
        `${SHEETS_BASE}/${sheetId}/values/A1`
      )) as SheetValuesResponse;

      const currentHeader = data.values?.[0] ?? [];
      const isHeaderMismatch =
        currentHeader.length !== SHEET_COLUMNS.length ||
        SHEET_COLUMNS.some((column, index) => currentHeader[index] !== column);

      if (isHeaderMismatch) {
        await sheetsPost(
          token,
          `${SHEETS_BASE}/${sheetId}/values/A1?valueInputOption=RAW`,
          { values: [Array.from(SHEET_COLUMNS)] },
          "PUT"
        );
      }
    });
  }

  /**
   * Ensures the header exists, then appends a new row for the given record.
   */
  async appendRow(sheetId: string, record: JobRecord): Promise<void> {
    const token = await getToken(false);

    await this.ensureHeader(sheetId);

    const row = recordToRow(record, new Date().toISOString().split("T")[0]);

    await withRetry(async () => {
      await sheetsPost(
        token,
        `${SHEETS_BASE}/${sheetId}/values/${SHEET_RANGE}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { values: [row] }
      );
    });
  }

  async findMatchingRow(
    sheetId: string,
    extraction: GmailStageExtraction
  ): Promise<{ rowIndex: number; row: string[] } | null> {
    const token = await getToken(false);
    await this.ensureHeader(sheetId);

    const data = (await withRetry(async () =>
      (await sheetsGet(token, `${SHEETS_BASE}/${sheetId}/values/${SHEET_RANGE}`)) as SheetValuesResponse
    )) as SheetValuesResponse;

    const rows = data.values ?? [];
    let bestMatch: { rowIndex: number; row: string[]; score: number } | null = null;

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      const score = scoreRow(row, extraction);
      if (score < 40) continue;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { rowIndex: index + 1, row, score };
      }
    }

    return bestMatch ? { rowIndex: bestMatch.rowIndex, row: bestMatch.row } : null;
  }

  async updateStageRow(
    sheetId: string,
    rowIndex: number,
    currentRow: string[],
    extraction: GmailStageExtraction
  ): Promise<void> {
    const token = await getToken(false);
    const nextRow = Array.from({ length: SHEET_COLUMNS.length }, (_, index) => sanitize(currentRow[index] ?? ""));

    const updateIfPresent = (column: keyof typeof SHEET_COLUMN_INDEX, value: string | undefined): void => {
      if (!value) return;
      nextRow[SHEET_COLUMN_INDEX[column]] = sanitize(value);
    };

    updateIfPresent("Current Stage", extraction.currentStage);
    updateIfPresent("OA Deadline", extraction.oaDeadline);
    updateIfPresent("Round 1 Date", extraction.round1Date);
    updateIfPresent("Round 1 Deadline", extraction.round1Deadline);
    updateIfPresent("Round 2 Date", extraction.round2Date);
    updateIfPresent("Round 2 Deadline", extraction.round2Deadline);
    updateIfPresent("Final Round Date", extraction.finalRoundDate);
    updateIfPresent("Final Round Deadline", extraction.finalRoundDeadline);
    updateIfPresent("Outcome", extraction.outcome);
    updateIfPresent("Gmail Thread ID", extraction.gmailThreadId);
    updateIfPresent("Last Gmail Sync", extraction.lastGmailSync);

    await withRetry(async () => {
      await sheetsPost(
        token,
        `${SHEETS_BASE}/${sheetId}/values/A${rowIndex}:${String.fromCharCode(
          64 + SHEET_COLUMNS.length
        )}${rowIndex}?valueInputOption=RAW`,
        { values: [nextRow] },
        "PUT"
      );
    });
  }

  /**
   * Validates that the sheet exists and is accessible.
   * Returns a descriptive ValidationResult — never throws.
   */
  async validateSheet(sheetId: string): Promise<ValidationResult> {
    let token: string;
    try {
      token = await getToken(false);
    } catch {
      return { valid: false, error: "auth", message: "Not authenticated" };
    }

    try {
      await sheetsGet(
        token,
        `${SHEETS_BASE}/${sheetId}?fields=properties.title`
      );
      return { valid: true };
    } catch (err) {
      const status = (err as SheetsApiError).status;
      if (status === 401) {
        return {
          valid: false,
          error: "auth",
          message: "Authentication failed. Please sign in again.",
        };
      }
      if (status === 403) {
        return {
          valid: false,
          error: "permissions",
          message:
            "Permission denied. Make sure the sheet is shared with your account.",
        };
      }
      if (status === 404) {
        return {
          valid: false,
          error: "not_found",
          message: "Sheet not found. Check that the spreadsheet ID is correct.",
        };
      }
      return {
        valid: false,
        error: "unknown",
        message: `Unexpected error: ${(err as Error).message}`,
      };
    }
  }
}

export const sheetsClient = new SheetsClient();
