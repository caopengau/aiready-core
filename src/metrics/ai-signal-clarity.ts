/**
 * AI Signal Clarity Metrics
 * Measures code patterns that increase the likelihood of AI generating incorrect code.
 */

export interface AiSignalClaritySignal {
  name: string;
  count: number;
  riskContribution: number;
  description: string;
  examples?: string[];
}

export interface AiSignalClarity {
  score: number;
  rating: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
  signals: AiSignalClaritySignal[];
  topRisk: string;
  recommendations: string[];
}

export function calculateAiSignalClarity(params: {
  overloadedSymbols: number;
  magicLiterals: number;
  booleanTraps: number;
  implicitSideEffects: number;
  deepCallbacks: number;
  ambiguousNames: number;
  undocumentedExports: number;
  largeFiles: number;
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
    largeFiles,
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
  };
}
