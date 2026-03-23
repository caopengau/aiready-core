/**
 * Emit progress update with throttling to reduce log noise
 * @param processed Number of items processed
 * @param total Total items to process
 * @param toolId Tool identifier
 * @param message Progress message
 * @param onProgress Global progress callback
 * @param throttleCount Frequency of updates (every N items)
 */
export function emitProgress(
  processed: number,
  total: number,
  toolId: string,
  message: string,
  onProgress?: (processed: number, total: number, message: string) => void,
  throttleCount: number = 50
): void {
  if (!onProgress) return;
  if (processed % throttleCount === 0 || processed === total) {
    onProgress(processed, total, `${message} (${processed}/${total})`);
  }
}
