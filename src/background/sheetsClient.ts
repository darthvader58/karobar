/**
 * Google Sheets API client with retry logic.
 * Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 5.2, 5.3
 */

import type { JobRecord, ValidationResult } from "../shared/types";
import { recordToRow, SHEET_COLUMNS } from "../shared/sanitize";
import { getToken } from "./auth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

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
      )) as { values?: string[][] };

      const firstCell = data.values?.[0]?.[0];
      if (firstCell !== SHEET_COLUMNS[0]) {
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
        `${SHEETS_BASE}/${sheetId}/values/A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { values: [row] }
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
