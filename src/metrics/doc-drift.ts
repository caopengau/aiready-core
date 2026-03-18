/**
 * Documentation Drift Metrics.
 * Measures the risk of documentation becoming out of sync with code.
 *
 * @lastUpdated 2026-03-18
 */

export interface DocDriftRisk {
  score: number;
  rating: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
  dimensions: {
    uncommentedExports: number;
    outdatedComments: number;
    undocumentedComplexity: number;
    actualDrift: number;
  };
  recommendations: string[];
}

/**
 * Calculate the documentation drift risk score based on various metrics.
 *
 * @param params - The raw metrics for doc-drift analysis gathered during scanning.
 * @param params.uncommentedExports - Number of public exports missing documentation.
 * @param params.totalExports - Total number of public exports analyzed.
 * @param params.outdatedComments - Count of comments that conflict with recent code changes.
 * @param params.undocumentedComplexity - Count of complex nodes without explanatory comments.
 * @param params.actualDrift - Raw drift metric calculated from temporal analysis.
 * @returns The calculated risk score and prioritized recommendations.
 */
export function calculateDocDrift(params: {
  uncommentedExports: number;
  totalExports: number;
  outdatedComments: number;
  undocumentedComplexity: number;
  actualDrift: number;
}): DocDriftRisk {
  const {
    uncommentedExports,
    totalExports,
    outdatedComments,
    undocumentedComplexity,
    actualDrift,
  } = params;

  const uncommentedRatio =
    totalExports > 0 ? uncommentedExports / totalExports : 0;
  const outdatedRatio = totalExports > 0 ? outdatedComments / totalExports : 0;
  const complexityRatio =
    totalExports > 0 ? undocumentedComplexity / totalExports : 0;
  const driftRatio = totalExports > 0 ? actualDrift / totalExports : 0;

  // Scaling factors: how much % of the codebase must be bad to hit 100% risk for that factor
  const DRIFT_THRESHOLD = 0.35; // 35% temporal drift = max risk for factor
  const OUTDATED_THRESHOLD = 0.5; // 50% mismatch = max risk for factor
  const COMPLEXITY_THRESHOLD = 0.3; // 30% undocumented complexity = max risk for factor
  const UNCOMMENTED_THRESHOLD = 0.8; // 80% uncommented exports = max risk for factor

  const driftRisk = Math.min(100, (driftRatio / DRIFT_THRESHOLD) * 100);
  const outdatedRisk = Math.min(
    100,
    (outdatedRatio / OUTDATED_THRESHOLD) * 100
  );
  const complexityRisk = Math.min(
    100,
    (complexityRatio / COMPLEXITY_THRESHOLD) * 100
  );
  const uncommentedRisk = Math.min(
    100,
    (uncommentedRatio / UNCOMMENTED_THRESHOLD) * 100
  );

  // Rebalanced weights: Actual Drift is now the most critical
  const risk = Math.round(
    driftRisk * 0.4 +
      complexityRisk * 0.3 +
      outdatedRisk * 0.2 +
      uncommentedRisk * 0.1
  );
  const finalRisk = Math.min(100, Math.max(0, risk));

  // Invert risk to get readiness score
  // If no exports found, readiness is 100% (no drift possible)
  const score = totalExports > 0 ? 100 - finalRisk : 100;

  let rating: DocDriftRisk['rating'];
  if (score >= 90)
    rating = 'minimal'; // low risk
  else if (score >= 75) rating = 'low';
  else if (score >= 60) rating = 'moderate';
  else if (score >= 40) rating = 'high';
  else rating = 'severe'; // high risk

  const recommendations: string[] = [];
  if (actualDrift > 0)
    recommendations.push(
      `Review ${actualDrift} functions where code was changed after documentation was last updated.`
    );
  if (outdatedComments > 0)
    recommendations.push(
      `Update or remove ${outdatedComments} outdated comments that contradict the code.`
    );
  if (uncommentedRatio > 0.3)
    recommendations.push(
      `Add JSDoc to ${uncommentedExports} uncommented exports.`
    );
  if (undocumentedComplexity > 0)
    recommendations.push(
      `Explain the business logic for ${undocumentedComplexity} highly complex functions.`
    );

  return {
    score: score,
    rating,
    dimensions: {
      uncommentedExports,
      outdatedComments,
      undocumentedComplexity,
      actualDrift,
    },
    recommendations,
  };
}
