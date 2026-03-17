import { ExportWithImports } from '../types/ast';

/**
 * Calculate import-based similarity between two exports using Jaccard index.
 * Returns a score between 0 and 1 representing the overlap in imported symbols.
 *
 * @param export1 - First export to compare
 * @param export2 - Second export to compare
 * @returns Similarity score (0 = no overlap, 1 = identical imports)
 */
export function calculateImportSimilarity(
  export1: ExportWithImports,
  export2: ExportWithImports
): number {
  if (export1.imports.length === 0 && export2.imports.length === 0) {
    return 1; // Both have no imports = perfectly similar
  }

  const set1 = new Set(export1.imports);
  const set2 = new Set(export2.imports);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
