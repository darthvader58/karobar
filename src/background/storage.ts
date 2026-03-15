import { SyncStorage, LocalStorage, StoredRecord } from "../shared/types";

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
          resolve(result[key] as SyncStorage[K] | undefined);
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
          resolve(result[key] as LocalStorage[K] | undefined);
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
