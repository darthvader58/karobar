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

export interface ApplicationStageFields {
  currentStage: string;
  oaDeadline: string;
  round1Date: string;
  round1Deadline: string;
  round2Date: string;
  round2Deadline: string;
  finalRoundDate: string;
  finalRoundDeadline: string;
  outcome: string;
  gmailThreadId: string;
  lastGmailSync: string;
}

export interface GmailSyncConfig {
  enabled: boolean;
  extractionEndpoint: string;
  gmailQuery: string;
}

export interface GmailMessageRecord {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  bodyText: string;
}

export interface GmailStageExtraction extends Partial<ApplicationStageFields> {
  companyName?: string;
  jobTitle?: string;
  jobUrl?: string;
  confidence?: number;
  shouldUpdate: boolean;
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
  gmailSyncConfig: GmailSyncConfig;
}

export interface LocalStorage {
  recentRecords: StoredRecord[];
  failedQueue: FailedRecord[];
  loggedUrls: string[];
  processedGmailMessageIds: string[];
  lastGmailSyncAt: string;
}

// ExtensionMessage — typed discriminated union for all chrome.runtime messages
export type ExtensionMessage =
  | { type: "CHECK_DUPLICATE"; url: string }
  | { type: "USER_CONFIRMED" }
  | { type: "USER_DISMISSED" }
  | { type: "SCRAPE_PAGE" }
  | { type: "LOG_JOB_RECORD"; record: JobRecord }
  | { type: "GET_RECENT_RECORDS" }
  | { type: "SAVE_SHEET_CONFIG"; sheetId: string }
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" }
  | { type: "GET_STATUS" }
  | { type: "SAVE_GMAIL_CONFIG"; config: GmailSyncConfig }
  | { type: "RUN_GMAIL_SYNC" }
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
  gmailSyncConfig: GmailSyncConfig;
  lastGmailSyncAt: string;
}

export interface LogJobRecordResponse {
  success: boolean;
  error?: string;
}

export interface GmailSyncResponse {
  success: boolean;
  processedCount: number;
  updatedCount: number;
  error?: string;
}
