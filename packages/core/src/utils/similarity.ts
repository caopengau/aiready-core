/**
 * Calculate Jaccard similarity between two strings.
 * Splitting by non-alphanumeric to be robust across different programming languages and formats.
 *
 * @param a - First string for comparison.
 * @param b - Second string for comparison.
 * @returns Similarity score between 0 and 1.
 */
export function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;

  const tokensA = a.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 0);
  const tokensB = b.split(/[^a-zA-Z0-9]+/).filter((t) => t.length > 0);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate heuristic confidence score for a duplicate or pattern detection.
 * Considers similarity, block size, and structural match.
 *
 * @param similarity - Similarity score (0-1).
 * @param tokens - Token count of the code block.
 * @param lines - Line count of the code block.
 * @returns Confidence score between 0 and 1.
 */
export function calculateHeuristicConfidence(
  similarity: number,
  tokens: number,
  lines: number
): number {
  // Base confidence is the similarity itself
  let confidence = similarity;

  // Boost confidence for larger blocks (less likely to be accidental)
  if (lines > 20) confidence += 0.05;
  if (tokens > 200) confidence += 0.05;

  // Small blocks are noisier
  if (lines < 5) confidence -= 0.1;

  return Math.max(0, Math.min(1, confidence));
}
