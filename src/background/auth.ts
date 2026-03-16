/**
 * OAuth token management via chrome.identity.
 * Requirements: 4.1, 4.2, 6.3
 */

const REVOKE_ENDPOINT = "https://accounts.google.com/o/oauth2/revoke";

interface ChromeRuntimeErrorLike {
  message?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string" &&
    (err as { message: string }).message
  ) {
    return (err as { message: string }).message;
  }
  return "Authentication failed.";
}

function serializeAuthError(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function toAuthError(err: unknown): Error {
  const message = getErrorMessage(err);
  const authError = new Error(message);
  authError.name = "AuthError";
  return authError;
}

export function normalizeAuthError(err: unknown): Error {
  const message = getErrorMessage(err);

  if (message.includes("OAuth2 request failed") || message.includes("invalid_client")) {
    return new Error(
      "Google sign-in is not configured correctly for this extension build. Check the OAuth client ID and authorized extension ID."
    );
  }

  if (
    message.includes("The user did not approve access") ||
    message.includes("Authorization page could not be loaded")
  ) {
    return new Error("Google sign-in was cancelled or blocked.");
  }

  return new Error(message);
}

export function describeAuthError(err: unknown): string {
  const normalized = normalizeAuthError(err).message;
  const raw = serializeAuthError(err);
  return raw && raw !== normalized ? `${normalized}\nRaw error: ${raw}` : normalized;
}

/**
 * Get an OAuth token. interactive=true shows the sign-in UI if needed.
 * Rejects with chrome.runtime.lastError if it fails.
 * If interactive=false and no token is cached, this will reject.
 */
export async function getToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(toAuthError(chrome.runtime.lastError as ChromeRuntimeErrorLike));
      } else if (!token) {
        reject(toAuthError("No OAuth token was returned."));
      } else {
        resolve(token);
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
