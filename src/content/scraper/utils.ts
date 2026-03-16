import { sanitize, EMPTY_JOB_RECORD } from "../../shared/sanitize";
import type { JobRecord } from "../../shared/types";

type JsonObject = Record<string, unknown>;

const EMPLOYMENT_TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bfull[\s-]?time\b|FULL_TIME/i, value: "Full-time" },
  { pattern: /\bpart[\s-]?time\b|PART_TIME/i, value: "Part-time" },
  { pattern: /\bintern(ship)?\b/i, value: "Internship" },
  { pattern: /\bco[\s-]?op\b/i, value: "Co-op" },
  { pattern: /\bcontract(or)?\b|CONTRACT/i, value: "Contract" },
  { pattern: /\btemporary\b|TEMPORARY/i, value: "Temporary" },
  { pattern: /\bapprenticeship\b/i, value: "Apprenticeship" },
];

const WORK_ARRANGEMENT_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bremote\b|telecommut/i, value: "Remote" },
  { pattern: /\bhybrid\b/i, value: "Hybrid" },
  { pattern: /\bon[\s-]?site\b|\bin[\s-]?office\b|\bin[\s-]?person\b/i, value: "On-site" },
];

const SEASON_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bspring\s*\/\s*summer\b|\bsummer\s*\/\s*spring\b/i, value: "Spring/Summer" },
  { pattern: /\bsummer\s*\/\s*fall\b|\bfall\s*\/\s*summer\b/i, value: "Summer/Fall" },
  { pattern: /\bfall\s*\/\s*winter\b|\bwinter\s*\/\s*fall\b/i, value: "Fall/Winter" },
  { pattern: /\bwinter\s*\/\s*spring\b|\bspring\s*\/\s*winter\b/i, value: "Winter/Spring" },
  { pattern: /\bspring\b/i, value: "Spring" },
  { pattern: /\bsummer\b/i, value: "Summer" },
  { pattern: /\bfall\b|\bautumn\b/i, value: "Fall" },
  { pattern: /\bwinter\b/i, value: "Winter" },
];

export function queryText(root: ParentNode, selector: string): string {
  try {
    const el = root.querySelector(selector);
    if (!el) return "";
    if (el instanceof HTMLMetaElement) return el.content || "";
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value || "";
    }
    return el.textContent || "";
  } catch {
    return "";
  }
}

export function queryFirstText(root: ParentNode, ...selectors: string[]): string {
  for (const selector of selectors) {
    const value = queryText(root, selector);
    if (value.trim()) return value;
  }
  return "";
}

export function getMetaContent(
  doc: Document,
  attribute: "property" | "name",
  name: string
): string {
  try {
    const el = doc.querySelector(`meta[${attribute}="${name}"]`);
    if (!el || !(el instanceof HTMLMetaElement)) return "";
    return el.content || "";
  } catch {
    return "";
  }
}

export function parseJsonLdJobPosting(doc: Document): JsonObject | null {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      const parsed = parseJson(script.textContent || "");
      const posting = findJobPosting(parsed);
      if (posting) return posting;
    }
  } catch {
    return null;
  }

  return null;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function findJobPosting(value: unknown): JsonObject | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const posting = findJobPosting(item);
      if (posting) return posting;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const obj = value as JsonObject;
  if (obj["@type"] === "JobPosting") return obj;

  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) {
      const posting = findJobPosting(item);
      if (posting) return posting;
    }
  }

  return null;
}

export function parseScriptJsonAssignment<T>(
  doc: Document,
  assignmentPattern: RegExp
): T | null {
  const scripts = doc.querySelectorAll("script");
  for (const script of Array.from(scripts)) {
    const content = script.textContent || "";
    const match = content.match(assignmentPattern);
    if (!match?.[1]) continue;
    try {
      return JSON.parse(match[1]) as T;
    } catch {
      continue;
    }
  }

  return null;
}

export function parseScriptString(doc: Document, pattern: RegExp): string {
  const scripts = doc.querySelectorAll("script");
  for (const script of Array.from(scripts)) {
    const content = script.textContent || "";
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function getCanonicalJobUrl(
  doc: Document,
  fallbackUrl: string,
  extraCandidates: string[] = []
): string {
  const candidates = [
    ...extraCandidates,
    getMetaContent(doc, "property", "og:url"),
    queryCanonicalHref(doc),
    fallbackUrl,
  ].map((value) => sanitize(value));

  const fallback = safeUrl(fallbackUrl);
  const parsedCandidates = candidates
    .map((value) => safeUrl(value))
    .filter((value): value is URL => value !== null);

  const sameOriginJobUrl = parsedCandidates.find(
    (candidate) =>
      fallback &&
      candidate.origin === fallback.origin &&
      isLikelyJobUrl(candidate)
  );
  if (sameOriginJobUrl) return sameOriginJobUrl.href;

  const anyJobUrl = parsedCandidates.find((candidate) => isLikelyJobUrl(candidate));
  if (anyJobUrl) return anyJobUrl.href;

  return fallback?.href || fallbackUrl;
}

function queryCanonicalHref(doc: Document): string {
  try {
    const el = doc.querySelector('link[rel="canonical"]');
    if (!el || !(el instanceof HTMLLinkElement)) return "";
    return el.href || "";
  } catch {
    return "";
  }
}

function safeUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isLikelyJobUrl(url: URL): boolean {
  return /\/(jobs?|careers?|apply|details|position|opening|opportunit(?:y|ies)|public\/job)\b/i.test(
    url.pathname
  );
}

export function inferEmploymentType(...sources: Array<string | null | undefined>): string {
  for (const source of sources) {
    const text = sanitize(source);
    if (!text) continue;
    for (const entry of EMPLOYMENT_TYPE_PATTERNS) {
      if (entry.pattern.test(text)) return entry.value;
    }
  }
  return "";
}

export function inferWorkArrangement(...sources: Array<string | null | undefined>): string {
  for (const source of sources) {
    const text = sanitize(source);
    if (!text) continue;
    for (const entry of WORK_ARRANGEMENT_PATTERNS) {
      if (entry.pattern.test(text)) return entry.value;
    }
  }
  return "";
}

export function inferJobTerm(
  sources: Array<string | null | undefined>,
  now: Date = new Date()
): string {
  for (const source of sources) {
    const text = sanitize(source);
    if (!text) continue;
    const season = detectSeason(text);
    if (!season) continue;
    const year = detectYear(text) ?? now.getFullYear();
    return `${season} ${year}`;
  }
  return "";
}

function detectSeason(text: string): string {
  for (const entry of SEASON_PATTERNS) {
    if (entry.pattern.test(text)) return entry.value;
  }
  return "";
}

function detectYear(text: string): number | null {
  const match = text.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function extractCompanyFromApplicationTitle(title: string): string {
  const sanitized = sanitize(title);
  if (!sanitized) return "";

  const viaAt = sanitized.match(/\bat\s+(.+?)(?:\s+via\s+.+)?$/i);
  if (viaAt?.[1]) return sanitize(viaAt[1]);

  const viaRole = sanitized.match(/\brole\s+at\s+(.+?)(?:\s+via\s+.+)?$/i);
  if (viaRole?.[1]) return sanitize(viaRole[1]);

  return "";
}

export function normalizeCompanyName(raw: string): string {
  const sanitized = sanitize(raw);
  if (!sanitized) return "";

  if (/^[A-Z0-9& .'-]+$/.test(sanitized)) {
    return sanitized;
  }

  if (/^[a-z0-9-]+$/.test(sanitized)) {
    return sanitized
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return sanitized;
}

export function extractTextContent(root: ParentNode | null | undefined): string {
  if (!root) return "";
  try {
    return sanitize(
      root instanceof Document ? root.body?.textContent || "" : root.textContent || ""
    );
  } catch {
    return "";
  }
}

export function buildRecord(partial: Partial<JobRecord>): JobRecord {
  return {
    ...EMPTY_JOB_RECORD,
    ...Object.fromEntries(
      Object.entries(partial).map(([key, value]) => [key, sanitize(value as string)])
    ),
  };
}
