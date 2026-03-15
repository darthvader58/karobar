/**
 * OAuth token management via chrome.identity.
 * Requirements: 4.1, 4.2, 6.3
 */

const REVOKE_ENDPOINT = "https://accounts.google.com/o/oauth2/revoke";

/**
 * Get an OAuth token. interactive=true shows the sign-in UI if needed.
 * Rejects with chrome.runtime.lastError if it fails.
 * If interactive=false and no token is cached, this will reject.
 */
export async function getToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token!);
      }
    });
  });
}

/**
 * Sign out: remove cached token and revoke it with Google.
 * Logs errors but never throws.
 */
export async function signOut(): Promise<void> {
  try {
    let token: string;
    try {
      token = await getToken(false);
    } catch {
      // No cached token — nothing to do
      return;
    }

    // Remove from Chrome's cache
    await new Promise<void>((resolve, reject) => {
      chrome.identity.removeCachedAuthToken({ token }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // Revoke with Google — fire and forget
    fetch(`${REVOKE_ENDPOINT}?token=${token}`).catch(() => {
      // Ignore revocation errors
    });
  } catch (err) {
    console.error("[auth] signOut error:", err);
  }
}

/**
 * Check if the user is currently authenticated (non-interactive token check).
 * Never throws.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const token = await getToken(false);
    return typeof token === "string" && token.length > 0;
  } catch {
    return false;
  }
}
