import { emitProgress } from './cli-helpers';

/**
 * Generic batch analysis runner with progress reporting.
 */
export async function runBatchAnalysis<T, R>(
  items: T[],
  label: string,
  toolId: string,
  onProgress:
    | ((processed: number, total: number, message: string) => void)
    | undefined,
  processFn: (item: T) => Promise<R>,
  onResult: (result: R) => void
): Promise<void> {
  let processed = 0;
  for (const item of items) {
    processed++;
    emitProgress(processed, items.length, toolId, label, onProgress);
    try {
      const result = await processFn(item);
      onResult(result);
    } catch (error) {
      console.error(`[${toolId}] Error processing ${item}:`, error);
      // Continue to next item instead of crashing the whole batch
    }
  }
}
