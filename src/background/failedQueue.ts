import { StoredRecord, FailedRecord } from "../shared/types";
import { getLocal, setLocal } from "./storage";

/**
 * Add a failed record to the queue.
 */
export async function enqueue(record: StoredRecord, error: string): Promise<void> {
  try {
    const queue: FailedRecord[] = (await getLocal("failedQueue")) ?? [];
    const entry: FailedRecord = {
      record,
      failedAt: new Date().toISOString(),
      lastError: error,
    };
    queue.push(entry);
    await setLocal("failedQueue", queue);
  } catch (err) {
    throw err;
  }
}

/**
 * Remove a record from the queue by its id.
 */
export async function dequeue(id: string): Promise<void> {
  try {
    const queue: FailedRecord[] = (await getLocal("failedQueue")) ?? [];
    const filtered = queue.filter((entry) => entry.record.id !== id);
    await setLocal("failedQueue", filtered);
  } catch (err) {
    throw err;
  }
}

/**
 * Get all failed records. Returns [] on error (safe fallback).
 */
export async function getQueue(): Promise<FailedRecord[]> {
  try {
    return (await getLocal("failedQueue")) ?? [];
  } catch {
    return [];
  }
}
