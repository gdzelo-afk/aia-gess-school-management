/** Private storage port. No public file/upload endpoint exists yet. */
export interface PrivateBlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}
/** Jobs are committed with the domain write. A delivery worker is intentionally deferred. */
export interface PendingJob {
  kind: string;
  payload: Record<string, unknown>;
  deduplicationKey: string;
}
