import { ExtensionMessage, CheckDuplicateResponse } from "../shared/types";

/**
 * Typed wrapper around chrome.runtime.sendMessage.
 * Resolves with the response from the background worker,
 * or rejects if chrome.runtime.lastError is set or an exception is thrown.
 */
export function sendMessage<T>(msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (response: T) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Sends a CHECK_DUPLICATE message to the background worker.
 * Returns { isDuplicate: false } as a safe fallback on any error
 * so the detection flow is never blocked by a messaging failure.
 */
export async function checkDuplicate(url: string): Promise<CheckDuplicateResponse> {
  try {
    return await sendMessage<CheckDuplicateResponse>({ type: "CHECK_DUPLICATE", url });
  } catch {
    return { isDuplicate: false };
  }
}
