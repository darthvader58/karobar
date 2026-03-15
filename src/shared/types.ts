// JobRecord — all fields are strings, never null/undefined/NaN
export interface JobRecord {
  jobTitle: string;
  companyName: string;
  location: string;
  jobTerm: string;
  jobUrl: string;
  employmentType: string;
  department: string;
  workArrangement: string;
}

// StoredRecord — persisted version with metadata
export interface StoredRecord extends JobRecord {
  dateApplied: string; // YYYY-MM-DD
  id: string; // crypto.randomUUID()
  sheetRowUrl?: string;
}

// FailedRecord — for the failed write queue
export interface FailedRecord {
  record: StoredRecord;
  failedAt: string; // ISO timestamp
  lastError: string;
}

// DetectionResult — output of the Detector
export interface DetectionResult {
  isJobPage: boolean;
  platform: string | null;
  confidence: "high" | "medium" | "low";
  previewTitle: string;
  previewCompany: string;
}

// ValidationResult — output of sheet validation
export interface ValidationResult {
  valid: boolean;
  error?: "auth" | "permissions" | "not_found" | "unknown";
  message?: string;
}

// PlatformScraper — interface for platform-specific scrapers
export interface PlatformScraper {
  platform: string;
  hostPattern: RegExp;
  scrape(): JobRecord;
}

// Chrome storage layouts
export interface SyncStorage {
  sheetId: string;
  customPatterns: string[];
}

export interface LocalStorage {
  recentRecords: StoredRecord[];
  failedQueue: FailedRecord[];
  loggedUrls: string[];
}

// ExtensionMessage — typed discriminated union for all chrome.runtime messages
export type ExtensionMessage =
  | { type: "CHECK_DUPLICATE"; url: string }
  | { type: "USER_CONFIRMED" }
  | { type: "USER_DISMISSED" }
  | { type: "LOG_JOB_RECORD"; record: JobRecord }
  | { type: "GET_RECENT_RECORDS" }
  | { type: "SAVE_SHEET_CONFIG"; sheetId: string }
  | { type: "SIGN_OUT" }
  | { type: "GET_STATUS" }
  | { type: "ADD_CUSTOM_PATTERN"; pattern: string }
  | { type: "REMOVE_CUSTOM_PATTERN"; pattern: string }
  | { type: "DISMISS_PROMPT" };

// Message responses
export interface CheckDuplicateResponse {
  isDuplicate: boolean;
}

export interface StatusResponse {
  isAuthenticated: boolean;
  sheetId: string;
  sheetName?: string;
}

export interface LogJobRecordResponse {
  success: boolean;
  error?: string;
}
