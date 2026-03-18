import type { GmailStageExtraction, GmailSyncResponse } from "../shared/types";
import { getToken } from "./auth";
import { listRelevantMessages } from "./gmailClient";
import { extractStageUpdate } from "./inferenceClient";
import { sheetsClient } from "./sheetsClient";
import { getLocal, getSync, setLocal } from "./storage";

const MAX_PROCESSED_MESSAGE_IDS = 200;

function withSyncTimestamp(extraction: GmailStageExtraction): GmailStageExtraction {
  return {
    ...extraction,
    lastGmailSync: new Date().toISOString(),
  };
}

export async function runGmailSync(): Promise<GmailSyncResponse> {
  const config = await getSync("gmailSyncConfig");
  const sheetId = await getSync("sheetId");

  if (!config?.enabled) {
    return { success: false, processedCount: 0, updatedCount: 0, error: "Gmail monitoring is disabled." };
  }
  if (!config.extractionEndpoint) {
    return { success: false, processedCount: 0, updatedCount: 0, error: "No inference endpoint configured." };
  }
  if (!sheetId) {
    return { success: false, processedCount: 0, updatedCount: 0, error: "No sheet configured." };
  }

  const token = await getToken(false);
  const processedMessageIds = new Set((await getLocal("processedGmailMessageIds")) ?? []);
  const messages = await listRelevantMessages(token, config.gmailQuery);

  let processedCount = 0;
  let updatedCount = 0;

  for (const message of messages) {
    if (processedMessageIds.has(message.id)) continue;

    processedCount += 1;
    try {
      const extraction = withSyncTimestamp(
        await extractStageUpdate(config.extractionEndpoint, message)
      );

      if (!extraction.shouldUpdate) {
        processedMessageIds.add(message.id);
        continue;
      }

      const match = await sheetsClient.findMatchingRow(sheetId, extraction);
      if (match) {
        await sheetsClient.updateStageRow(sheetId, match.rowIndex, match.row, extraction);
        updatedCount += 1;
      }
    } finally {
      processedMessageIds.add(message.id);
    }
  }

  const nextProcessedIds = Array.from(processedMessageIds).slice(-MAX_PROCESSED_MESSAGE_IDS);
  const lastSyncAt = new Date().toISOString();

  await setLocal("processedGmailMessageIds", nextProcessedIds);
  await setLocal("lastGmailSyncAt", lastSyncAt);

  return {
    success: true,
    processedCount,
    updatedCount,
  };
}
