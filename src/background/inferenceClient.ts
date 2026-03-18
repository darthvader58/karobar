import type { GmailMessageRecord, GmailStageExtraction } from "../shared/types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export async function extractStageUpdate(
  endpoint: string,
  message: GmailMessageRecord
): Promise<GmailStageExtraction> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Inference endpoint error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    shouldUpdate: payload.shouldUpdate === true,
    companyName: asString(payload.companyName),
    jobTitle: asString(payload.jobTitle),
    jobUrl: asString(payload.jobUrl),
    currentStage: asString(payload.currentStage),
    oaDeadline: asString(payload.oaDeadline),
    round1Date: asString(payload.round1Date),
    round1Deadline: asString(payload.round1Deadline),
    round2Date: asString(payload.round2Date),
    round2Deadline: asString(payload.round2Deadline),
    finalRoundDate: asString(payload.finalRoundDate),
    finalRoundDeadline: asString(payload.finalRoundDeadline),
    outcome: asString(payload.outcome),
    gmailThreadId: asString(payload.gmailThreadId || message.threadId),
    lastGmailSync: asString(payload.lastGmailSync),
    confidence: asNumber(payload.confidence),
  };
}
