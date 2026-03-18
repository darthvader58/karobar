/**
 * Karobar — Background Service Worker entry point
 * Message router for all ExtensionMessage types.
 * Requirements: 4.2, 4.5, 4.6, 5.1, 5.2, 5.5, 6.2, 6.3, 7.1, 7.3
 */

import {
  ExtensionMessage,
  StoredRecord,
  StatusResponse,
  LogJobRecordResponse,
  CheckDuplicateResponse,
  GmailSyncResponse,
} from "../shared/types";
import { getToken, signOut, isAuthenticated, describeAuthError } from "./auth";
import { sheetsClient } from "./sheetsClient";
import { DEFAULT_GMAIL_SYNC_CONFIG, getSync, setSync, getLocal } from "./storage";
import { addRecentRecord } from "./storage";
import { checkDuplicate, recordUrl } from "./duplicates";
import { enqueue, getQueue } from "./failedQueue";
import { runGmailSync } from "./gmailSync";

const GMAIL_SYNC_ALARM = "gmail-sync";
const GMAIL_SYNC_PERIOD_MINUTES = 15;

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message, sendResponse);
    return true; // keep channel open for async response
  }
);

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case "CHECK_DUPLICATE": {
        const isDuplicate = await checkDuplicate(message.url);
        sendResponse({ isDuplicate } satisfies CheckDuplicateResponse);
        break;
      }

      case "LOG_JOB_RECORD": {
        // Auth guard
        let token: string;
        try {
          token = await getToken(true);
        } catch {
          sendResponse({
            success: false,
            error: "Not authenticated",
          } satisfies LogJobRecordResponse);
          return;
        }
        void token; // used implicitly by sheetsClient

        // Sheet config guard
        const sheetId = await getSync("sheetId");
        if (!sheetId) {
          sendResponse({
            success: false,
            error: "No sheet configured",
          } satisfies LogJobRecordResponse);
          return;
        }

        // Build stored record
        const storedRecord: StoredRecord = {
          ...message.record,
          dateApplied: new Date().toISOString().split("T")[0],
          id: crypto.randomUUID(),
        };

        try {
          await sheetsClient.appendRow(sheetId, message.record);
          await addRecentRecord(storedRecord);
          await recordUrl(message.record.jobUrl);
          sendResponse({ success: true } satisfies LogJobRecordResponse);
        } catch (err) {
          await enqueue(storedRecord, (err as Error).message);
          sendResponse({
            success: false,
            error: (err as Error).message,
          } satisfies LogJobRecordResponse);
        }
        break;
      }

      case "SAVE_SHEET_CONFIG": {
        const result = await sheetsClient.validateSheet(message.sheetId);
        if (result.valid) {
          await setSync("sheetId", message.sheetId);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: result.message });
        }
        break;
      }

      case "SIGN_IN": {
        try {
          await getToken(true);
          sendResponse({ success: true });
        } catch (err) {
          const error = describeAuthError(err);
          console.error("[auth] SIGN_IN failed:", err);
          sendResponse({ success: false, error });
        }
        break;
      }

      case "SIGN_OUT": {
        await signOut();
        sendResponse({ success: true });
        break;
      }

      case "GET_STATUS": {
        const authenticated = await isAuthenticated();
        const sheetId = (await getSync("sheetId")) ?? "";
        const gmailSyncConfig = (await getSync("gmailSyncConfig")) ?? DEFAULT_GMAIL_SYNC_CONFIG;
        const lastGmailSyncAt = (await getLocal("lastGmailSyncAt")) ?? "";
        sendResponse({
          isAuthenticated: authenticated,
          sheetId,
          gmailSyncConfig,
          lastGmailSyncAt,
        } satisfies StatusResponse);
        break;
      }

      case "SAVE_GMAIL_CONFIG": {
        await setSync("gmailSyncConfig", message.config);
        sendResponse({ success: true });
        break;
      }

      case "RUN_GMAIL_SYNC": {
        try {
          const result = await runGmailSync();
          sendResponse(result satisfies GmailSyncResponse);
        } catch (err) {
          sendResponse({
            success: false,
            processedCount: 0,
            updatedCount: 0,
            error: err instanceof Error ? err.message : "Gmail sync failed.",
          } satisfies GmailSyncResponse);
        }
        break;
      }

      case "GET_RECENT_RECORDS": {
        const recentRecords = (await getLocal("recentRecords")) ?? [];
        const failedQueue = await getQueue();
        sendResponse({ recentRecords, failedQueue });
        break;
      }

      case "ADD_CUSTOM_PATTERN": {
        const patterns = (await getSync("customPatterns")) ?? [];
        if (!patterns.includes(message.pattern)) {
          await setSync("customPatterns", [...patterns, message.pattern]);
        }
        sendResponse({ success: true });
        break;
      }

      case "REMOVE_CUSTOM_PATTERN": {
        const patterns = (await getSync("customPatterns")) ?? [];
        await setSync(
          "customPatterns",
          patterns.filter((p) => p !== message.pattern)
        );
        sendResponse({ success: true });
        break;
      }

      case "USER_CONFIRMED":
      case "USER_DISMISSED":
      case "DISMISS_PROMPT": {
        // State tracking only — no background action needed
        sendResponse({});
        break;
      }

      default: {
        sendResponse({});
        break;
      }
    }
  } catch (err) {
    console.error("[background] Unexpected error in handleMessage:", err);
    sendResponse({ success: false, error: "Internal error" });
  }
}

// ---------------------------------------------------------------------------
// Navigation dismissal — notify content script on URL change
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    chrome.tabs
      .sendMessage(tabId, { type: "DISMISS_PROMPT" })
      .catch(() => {
        // Tab may not have content script — ignore
      });
  }
});

function scheduleGmailSyncAlarm(): void {
  chrome.alarms.create(GMAIL_SYNC_ALARM, {
    periodInMinutes: GMAIL_SYNC_PERIOD_MINUTES,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleGmailSyncAlarm();
});

chrome.runtime.onStartup?.addListener(() => {
  scheduleGmailSyncAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== GMAIL_SYNC_ALARM) return;
  void runGmailSync().catch((err) => {
    console.error("[gmail-sync] Alarm sync failed:", err);
  });
});
