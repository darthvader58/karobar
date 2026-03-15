/**
 * Chrome match pattern validator.
 * Requirements: 7.4, 7.5
 *
 * Validates patterns per Chrome's match pattern syntax:
 * <scheme>://<host><path>
 * Scheme: *, http, https, file, ftp
 * Host: * | *.<domain> | <hostname>
 * Path: must start with /
 */

export interface PatternValidationResult {
  valid: boolean;
  error?: string;
}

const VALID_SCHEMES = new Set(["*", "http", "https", "file", "ftp"]);

export function validateChromePattern(pattern: string): PatternValidationResult {
  if (!pattern || typeof pattern !== "string") {
    return { valid: false, error: "Pattern must be a non-empty string" };
  }

  // Special case: <all_urls>
  if (pattern === "<all_urls>") {
    return { valid: true };
  }

  // Must contain ://
  const schemeEnd = pattern.indexOf("://");
  if (schemeEnd === -1) {
    return { valid: false, error: 'Pattern must contain "://"' };
  }

  const scheme = pattern.slice(0, schemeEnd);
  if (!VALID_SCHEMES.has(scheme)) {
    return {
      valid: false,
      error: `Invalid scheme "${scheme}". Must be one of: *, http, https, file, ftp`,
    };
  }

  const rest = pattern.slice(schemeEnd + 3); // after "://"

  // file:// has no host
  if (scheme === "file") {
    if (!rest.startsWith("/")) {
      return { valid: false, error: "file:// patterns must have a path starting with /" };
    }
    return { valid: true };
  }

  // Split host and path
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) {
    return { valid: false, error: "Pattern must include a path (e.g. /*)" };
  }

  const host = rest.slice(0, slashIdx);
  const path = rest.slice(slashIdx);

  // Validate host
  if (!host) {
    return { valid: false, error: "Host cannot be empty" };
  }

  if (host !== "*") {
    // Allow *.<domain> or plain hostname
    if (host.startsWith("*.")) {
      const domain = host.slice(2);
      if (!domain || domain.includes("*")) {
        return { valid: false, error: "Invalid wildcard host. Use *.<domain> format" };
      }
    } else if (host.includes("*")) {
      return {
        valid: false,
        error: 'Wildcard "*" in host must only appear as "*" or "*.<domain>"',
      };
    }
  }

  // Validate path
  if (!path.startsWith("/")) {
    return { valid: false, error: "Path must start with /" };
  }

  return { valid: true };
}
