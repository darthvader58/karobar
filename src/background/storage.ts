import { SyncStorage, LocalStorage, StoredRecord } from "../shared/types";

const DEFAULT_GMAIL_SYNC_CONFIG = Object.freeze({
  enabled: false,
  extractionEndpoint: "",
  gmailQuery:
    '(interview OR recruiter OR "online assessment" OR "coding challenge" OR "technical screen" OR "application update") newer_than:30d',
});

// --- chrome.storage.sync wrappers ---

export async function getSync<K extends keyof SyncStorage>(
  key: K
): Promise<SyncStorage[K] | undefined> {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const value = result[key] as SyncStorage[K] | undefined;
          if (key === "gmailSyncConfig") {
            resolve(
              { ...DEFAULT_GMAIL_SYNC_CONFIG, ...(value as object | undefined) } as SyncStorage[K]
            );
            return;
          }
          resolve(value);
        }
      });
    });
  } catch (err) {
    throw err;
  }
}

export async function setSync<K extends keyof SyncStorage>(
  key: K,
  value: SyncStorage[K]
): Promise<void> {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    throw err;
  }
}

// --- chrome.storage.local wrappers ---

export async function getLocal<K extends keyof LocalStorage>(
  key: K
): Promise<LocalStorage[K] | undefined> {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const value = result[key] as LocalStorage[K] | undefined;
          if (key === "processedGmailMessageIds") {
            resolve(((value as string[] | undefined) ?? []) as LocalStorage[K]);
            return;
          }
          if (key === "lastGmailSyncAt") {
            resolve(((value as string | undefined) ?? "") as LocalStorage[K]);
            return;
          }
          resolve(value);
        }
      });
    });
  } catch (err) {
    throw err;
  }
}

export async function setLocal<K extends keyof LocalStorage>(
  key: K,
  value: LocalStorage[K]
): Promise<void> {
  try {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    throw err;
  }
}

// --- Higher-level helpers ---

const MAX_RECENT_RECORDS = 5;

/**
 * Prepend a StoredRecord to recentRecords, keeping only the last 5 (FIFO).
 */
export async function addRecentRecord(record: StoredRecord): Promise<void> {
  try {
    const current = (await getLocal("recentRecords")) ?? [];
    const updated = [record, ...current].slice(0, MAX_RECENT_RECORDS);
    await setLocal("recentRecords", updated);
  } catch (err) {
    throw err;
  }
}

/**
 * Get recentRecords, defaulting to [].
 */
export async function getRecentRecords(): Promise<StoredRecord[]> {
  try {
    return (await getLocal("recentRecords")) ?? [];
  } catch (err) {
    throw err;
  }
}

export { DEFAULT_GMAIL_SYNC_CONFIG };
