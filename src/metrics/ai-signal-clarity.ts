/**
 * AI Signal Clarity Metrics.
 * Measures code patterns that increase the likelihood of AI generating incorrect code.
 *
 * @lastUpdated 2026-03-18
 */

/**
 * Represents a single risk signal affecting AI clarity
 */
export interface AiSignalClaritySignal {
  /** Name of the signal */
  name: string;
  /** Occurrences of this signal */
  count: number;
  /** Numerical contribution to the risk score */
  riskContribution: number;
  /** Human-readable description of the risk */
  description: string;
  /** Examples of problematic patterns */
  examples?: string[];
}

/**
 * Complete AI Signal Clarity analysis result
 */
export interface AiSignalClarity {
  /** Normalized risk score (0-100) where higher means more confusion risk */
  score: number;
  /** Human-readable risk rating */
  rating: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
  /** Individual signals detected */
  signals: AiSignalClaritySignal[];
  /** The single highest risk factor identified */
  topRisk: string;
  /** Actionable recommendations to improve clarity */
  recommendations: string[];
  /** Metric dimensions for scoring (0-100) */
  dimensions: {
    overloadingScore: number;
    magicLiteralScore: number;
    booleanTrapScore: number;
    implicitSideEffectScore: number;
    deepCallbackScore: number;
    ambiguityScore: number;
    documentationScore: number;
    sizeScore: number;
  };
}

/**
 * Calculate AI Signal Clarity metrics based on various documented and undocumented code patterns.
 *
 * @param params - Counts of various problematic or beneficial patterns detected during scanning.
 * @param params.overloadedSymbols - Count of symbols with identical names in different scopes.
 * @param params.magicLiterals - Count of unnamed constant values.
 * @param params.booleanTraps - Count of functions with multiple boolean parameters.
 * @param params.implicitSideEffects - Count of functions with undocumented side effects.
 * @param params.deepCallbacks - Count of nested callback structures.
 * @param params.ambiguousNames - Count of non-descriptive identifiers (e.g., 'data', 'info').
 * @param params.undocumentedExports - Count of public exports missing JSDoc/docstrings.
 * @param params.largeFiles - Optional count of files exceeding size limits.
 * @param params.totalSymbols - Total number of symbols analyzed.
 * @param params.totalExports - Total number of public exports analyzed.
 * @returns Comprehensive AiSignalClarity analysis.
 */
export function calculateAiSignalClarity(params: {
  overloadedSymbols: number;
  magicLiterals: number;
  booleanTraps: number;
  implicitSideEffects: number;
  deepCallbacks: number;
  ambiguousNames: number;
  undocumentedExports: number;
  largeFiles?: number; // Optional with default below
  totalSymbols: number;
  totalExports: number;
}): AiSignalClarity {
  const {
    overloadedSymbols,
    magicLiterals,
    booleanTraps,
    implicitSideEffects,
    deepCallbacks,
    ambiguousNames,
    undocumentedExports,
    largeFiles = 0, // Default to 0 to prevent NaN
    totalSymbols,
    totalExports,
  } = params;

  if (totalSymbols === 0) {
    return {
      score: 0,
      rating: 'minimal',
      signals: [],
      topRisk: 'No symbols to analyze',
      recommendations: [],
      dimensions: {
        overloadingScore: 100,
        magicLiteralScore: 100,
        booleanTrapScore: 100,
        implicitSideEffectScore: 100,
        deepCallbackScore: 100,
        ambiguityScore: 100,
        documentationScore: 100,
        sizeScore: 100,
      },
    };
  }

  const overloadRatio = overloadedSymbols / Math.max(1, totalSymbols);
  const overloadSignal: AiSignalClaritySignal = {
    name: 'Symbol Overloading',
    count: overloadedSymbols,
    riskContribution: Math.round(Math.min(1, overloadRatio) * 100 * 0.2),
    description: `${overloadedSymbols} overloaded symbols — AI picks wrong signature`,
  };

  const largeFileSignal: AiSignalClaritySignal = {
    name: 'Large Files',
    count: largeFiles,
    riskContribution: Math.round(Math.min(5, largeFiles) * 5), // up to 25 points
    description: `${largeFiles} large files — pushing AI context limits`,
  };

  const magicRatio = magicLiterals / Math.max(1, totalSymbols * 2);
  const magicSignal: AiSignalClaritySignal = {
    name: 'Magic Literals',
    count: magicLiterals,
    riskContribution: Math.round(Math.min(1, magicRatio) * 100 * 0.15),
    description: `${magicLiterals} unnamed constants — AI invents wrong values`,
  };

  const trapRatio = booleanTraps / Math.max(1, totalSymbols);
  const trapSignal: AiSignalClaritySignal = {
    name: 'Boolean Traps',
    count: booleanTraps,
    riskContribution: Math.round(Math.min(1, trapRatio) * 100 * 0.15),
    description: `${booleanTraps} boolean trap parameters — AI inverts intent`,
  };

  const sideEffectRatio = implicitSideEffects / Math.max(1, totalExports);
  const sideEffectSignal: AiSignalClaritySignal = {
    name: 'Implicit Side Effects',
    count: implicitSideEffects,
    riskContribution: Math.round(Math.min(1, sideEffectRatio) * 100 * 0.1),
    description: `${implicitSideEffects} functions with implicit side effects — AI misses contracts`,
  };

  const callbackRatio = deepCallbacks / Math.max(1, totalSymbols * 0.1);
  const callbackSignal: AiSignalClaritySignal = {
    name: 'Callback Nesting',
    count: deepCallbacks,
    riskContribution: Math.round(Math.min(1, callbackRatio) * 100 * 0.1),
    description: `${deepCallbacks} deep callback chains — AI loses control flow context`,
  };

  const ambiguousRatio = ambiguousNames / Math.max(1, totalSymbols);
  const ambiguousSignal: AiSignalClaritySignal = {
    name: 'Ambiguous Names',
    count: ambiguousNames,
    riskContribution: Math.round(Math.min(1, ambiguousRatio) * 100 * 0.05),
    description: `${ambiguousNames} non-descriptive identifiers — AI guesses wrong intent`,
  };

  const undocRatio = undocumentedExports / Math.max(1, totalExports);
  const undocSignal: AiSignalClaritySignal = {
    name: 'Undocumented Exports',
    count: undocumentedExports,
    riskContribution: Math.round(Math.min(1, undocRatio) * 100 * 0.05),
    description: `${undocumentedExports} public functions without docs — AI fabricates behavior`,
  };

  const signals = [
    overloadSignal,
    largeFileSignal,
    magicSignal,
    trapSignal,
    sideEffectSignal,
    callbackSignal,
    ambiguousSignal,
    undocSignal,
  ];
  const score = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.riskContribution, 0)
  );

  let rating: AiSignalClarity['rating'];
  if (score < 10) rating = 'minimal';
  else if (score < 25) rating = 'low';
  else if (score < 50) rating = 'moderate';
  else if (score < 75) rating = 'high';
  else rating = 'severe';

  const topSignal = signals.reduce((a, b) =>
    a.riskContribution > b.riskContribution ? a : b
  );
  const topRisk =
    topSignal.riskContribution > 0
      ? topSignal.description
      : 'No significant issues detected';

  const recommendations: string[] = [];
  if (largeFileSignal.riskContribution > 5)
    recommendations.push(
      `Split ${largeFiles} large files (> 500 lines) into smaller, single-responsibility modules`
    );
  if (overloadSignal.riskContribution > 5)
    recommendations.push(
      `Rename ${overloadedSymbols} overloaded symbols to unique, intent-revealing names`
    );
  if (magicSignal.riskContribution > 5)
    recommendations.push(
      `Extract ${magicLiterals} magic literals into named constants`
    );
  if (trapSignal.riskContribution > 5)
    recommendations.push(
      `Replace ${booleanTraps} boolean traps with named options objects`
    );
  if (undocSignal.riskContribution > 5)
    recommendations.push(
      `Add JSDoc/docstrings to ${undocumentedExports} undocumented public functions`
    );
  if (sideEffectSignal.riskContribution > 5)
    recommendations.push(
      'Mark functions with side effects explicitly in their names or docs'
    );

  return {
    score: Math.round(score),
    rating,
    signals: signals.filter((s) => s.count > 0),
    topRisk,
    recommendations,
    dimensions: {
      overloadingScore: Math.max(0, 100 - overloadSignal.riskContribution * 5),
      magicLiteralScore: Math.max(0, 100 - magicSignal.riskContribution * 6.6),
      booleanTrapScore: Math.max(0, 100 - trapSignal.riskContribution * 6.6),
      implicitSideEffectScore: Math.max(
        0,
        100 - sideEffectSignal.riskContribution * 10
      ),
      deepCallbackScore: Math.max(
        0,
        100 - callbackSignal.riskContribution * 10
      ),
      ambiguityScore: Math.max(0, 100 - ambiguousSignal.riskContribution * 20),
      documentationScore: Math.max(0, 100 - undocSignal.riskContribution * 20),
      sizeScore: Math.max(0, 100 - largeFileSignal.riskContribution * 4),
    },
  };
}
