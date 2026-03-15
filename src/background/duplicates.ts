import { getLocal, setLocal } from "./storage";

/**
 * Returns true if the URL has already been logged.
 * On any error, returns false (safe fallback — never block the flow).
 */
export async function checkDuplicate(url: string): Promise<boolean> {
  try {
    const loggedUrls = (await getLocal("loggedUrls")) ?? [];
    return new Set(loggedUrls).has(url);
  } catch {
    return false;
  }
}

/**
 * Appends a URL to the loggedUrls list (called after successful log).
 * Re-throws on error so the caller knows it failed.
 */
export async function recordUrl(url: string): Promise<void> {
  const loggedUrls = (await getLocal("loggedUrls")) ?? [];
  if (new Set(loggedUrls).has(url)) {
    return;
  }
  await setLocal("loggedUrls", [...loggedUrls, url]);
}
