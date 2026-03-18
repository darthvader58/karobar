import type { GmailMessageRecord } from "../shared/types";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
    body?: { data?: string };
    mimeType?: string;
    parts?: GmailPayloadPart[];
  };
}

function decodeBase64Url(input: string | undefined): string {
  if (!input) return "";
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    return atob(normalized);
  } catch {
    return "";
  }
}

function headerValue(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBodyText(part: GmailPayloadPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  if (part.parts?.length) {
    for (const child of part.parts) {
      const body = extractBodyText(child);
      if (body) return body;
    }
  }

  if (part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  return "";
}

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

export async function listRelevantMessages(
  token: string,
  query: string,
  maxResults = 10
): Promise<GmailMessageRecord[]> {
  const listResponse = await gmailGet<GmailListResponse>(
    token,
    `/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
  );

  const messages = listResponse.messages ?? [];
  const detailedMessages = await Promise.all(
    messages.map((message) =>
      gmailGet<GmailMessageResponse>(token, `/messages/${message.id}?format=full`)
    )
  );

  return detailedMessages.map((message) => ({
    id: message.id,
    threadId: message.threadId,
    subject: headerValue(message.payload?.headers, "Subject"),
    from: headerValue(message.payload?.headers, "From"),
    date:
      headerValue(message.payload?.headers, "Date") ||
      (message.internalDate ? new Date(Number(message.internalDate)).toISOString() : ""),
    snippet: message.snippet ?? "",
    bodyText: extractBodyText(message.payload) || message.snippet || "",
  }));
}
