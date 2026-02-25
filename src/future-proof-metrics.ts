/**
 * Future-Proof AI Metrics Abstraction Layer
 * 
 * This module provides technology-agnostic metric primitives that will
 * remain valid across changes in AI models, tokenization, and paradigms.
 * 
 * The key insight: rather than measuring "tokens" or "import depth",
 * we measure cognitive concepts that translate to any AI architecture:
 * - Cognitive Load: How much mental effort for AI to understand
 * - Semantic Distance: How far apart related concepts are
 * - Concept Cohesion: How well grouped related ideas are
 * - Pattern Entropy: How ordered vs chaotic the structure is
 * - Hallucination Risk: How likely AI is to generate incorrect code
 * - Agent Grounding Score: How well an agent can navigate unaided
 * - Testability Index: How verifiable AI-generated changes are
 * 
 * v0.12+: Added hallucination risk, agent grounding, and testability dimensions.
 */

import type { ToolScoringOutput } from './scoring';

// ============================================
// COGNITIVE LOAD METRICS
// ============================================

/**
 * Factors that contribute to cognitive load for AI understanding
 * These are normalized 0-100 factors that can be combined
 */
export interface LoadFactor {
  name: string;
  score: number;       // 0-100, higher = more load
  weight: number;       // How much this factor contributes (0-1)
  description: string;
}

/**
 * Cognitive Load Assessment
 * Replaces "token cost" with a multi-dimensional load analysis
 */
export interface CognitiveLoad {
  score: number;
  rating: 'trivial' | 'easy' | 'moderate' | 'difficult' | 'expert';
  factors: LoadFactor[];
  rawValues: {
    size: number;
    complexity: number;
    dependencyCount: number;
    conceptCount: number;
  };
}

/**
 * Calculate cognitive load from raw file metrics
 */
export function calculateCognitiveLoad(params: {
  linesOfCode: number;
  exportCount: number;
  importCount: number;
  uniqueConcepts: number;
  cyclomaticComplexity?: number;
}): CognitiveLoad {
  const { linesOfCode, exportCount, importCount, uniqueConcepts, cyclomaticComplexity = 1 } = params;
  
  const sizeFactor: LoadFactor = {
    name: 'Size Complexity',
    score: Math.min(100, Math.max(0, (linesOfCode - 50) / 10)),
    weight: 0.30,
    description: `${linesOfCode} lines of code`,
  };
  
  const interfaceFactor: LoadFactor = {
    name: 'Interface Complexity',
    score: Math.min(100, exportCount * 5),
    weight: 0.25,
    description: `${exportCount} exported concepts`,
  };
  
  const dependencyFactor: LoadFactor = {
    name: 'Dependency Complexity',
    score: Math.min(100, importCount * 8),
    weight: 0.25,
    description: `${importCount} dependencies`,
  };
  
  const conceptDensity = linesOfCode > 0 ? uniqueConcepts / linesOfCode : 0;
  const conceptFactor: LoadFactor = {
    name: 'Conceptual Density',
    score: Math.min(100, conceptDensity * 500),
    weight: 0.20,
    description: `${uniqueConcepts} unique concepts`,
  };
  
  const factors = [sizeFactor, interfaceFactor, dependencyFactor, conceptFactor];
  const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  
  let rating: CognitiveLoad['rating'];
  if (score < 20) rating = 'trivial';
  else if (score < 40) rating = 'easy';
  else if (score < 60) rating = 'moderate';
  else if (score < 80) rating = 'difficult';
  else rating = 'expert';
  
  return {
    score: Math.round(score),
    rating,
    factors,
    rawValues: {
      size: linesOfCode,
      complexity: cyclomaticComplexity,
      dependencyCount: importCount,
      conceptCount: uniqueConcepts,
    },
  };
}

// ============================================
// SEMANTIC DISTANCE METRICS  
// ============================================

export interface SemanticDistance {
  between: [string, string];
  distance: number;
  relationship: 'same-file' | 'same-domain' | 'cross-domain' | 'unrelated';
  path: string[];
  reason: string;
}

export function calculateSemanticDistance(params: {
  file1: string;
  file2: string;
  file1Domain: string;
  file2Domain: string;
  file1Imports: string[];
  file2Imports: string[];
  sharedDependencies: string[];
}): SemanticDistance {
  const { file1, file2, file1Domain, file2Domain, sharedDependencies } = params;
  
  const domainDistance = file1Domain === file2Domain ? 0 : 
                         file1Domain && file2Domain ? 0.5 : 0.8;
  
  const importOverlap = sharedDependencies.length / Math.max(1, Math.min(params.file1Imports.length, params.file2Imports.length));
  const importDistance = 1 - importOverlap;
  
  const distance = (domainDistance * 0.4) + (importDistance * 0.3) + 
                   (sharedDependencies.length > 0 ? 0 : 0.3);
  
  let relationship: SemanticDistance['relationship'];
  if (file1 === file2) relationship = 'same-file';
  else if (file1Domain === file2Domain) relationship = 'same-domain';
  else if (sharedDependencies.length > 0) relationship = 'cross-domain';
  else relationship = 'unrelated';
  
  const pathItems = [file1Domain, ...sharedDependencies, file2Domain].filter((s): s is string => typeof s === 'string' && s.length > 0);
  
  return {
    between: [file1, file2],
    distance: Math.round(distance * 100) / 100,
    relationship,
    path: pathItems,
    reason: relationship === 'same-domain' 
      ? `Both in "${file1Domain}" domain`
      : relationship === 'cross-domain'
      ? `Share ${sharedDependencies.length} dependency(ies)`
      : 'No strong semantic relationship detected',
  };
}

// ============================================
// PATTERN ENTROPY METRICS
// ============================================

export interface PatternEntropy {
  domain: string;
  entropy: number;
  rating: 'crystalline' | 'well-structured' | 'moderate' | 'fragmented' | 'chaotic';
  distribution: {
    locationCount: number;
    dominantLocation: string;
    giniCoefficient: number;
  };
  recommendations: string[];
}

export interface FileWithDomain {
  path: string;
  domain: string;
}

export function calculatePatternEntropy(files: FileWithDomain[]): PatternEntropy {
  if (files.length === 0) {
    return {
      domain: 'unknown',
      entropy: 0,
      rating: 'crystalline',
      distribution: { locationCount: 0, dominantLocation: '', giniCoefficient: 0 },
      recommendations: ['No files to analyze'],
    };
  }
  
  const dirGroups = new Map<string, number>();
  for (const file of files) {
    const parts = file.path.split('/').slice(0, 4).join('/') || 'root';
    dirGroups.set(parts, (dirGroups.get(parts) || 0) + 1);
  }
  
  const counts = Array.from(dirGroups.values());
  const total = counts.reduce((a, b) => a + b, 0);
  let entropy = 0;
  for (const count of counts) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  
  const maxEntropy = Math.log2(dirGroups.size || 1);
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  
  const sortedCounts = counts.sort((a, b) => a - b);
  let gini = 0;
  for (let i = 0; i < sortedCounts.length; i++) {
    gini += (2 * (i + 1) - sortedCounts.length - 1) * sortedCounts[i];
  }
  gini /= total * sortedCounts.length;
  
  let dominantLocation = '';
  let maxCount = 0;
  for (const [loc, count] of dirGroups.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantLocation = loc;
    }
  }
  
  let rating: PatternEntropy['rating'];
  if (normalizedEntropy < 0.2) rating = 'crystalline';
  else if (normalizedEntropy < 0.4) rating = 'well-structured';
  else if (normalizedEntropy < 0.6) rating = 'moderate';
  else if (normalizedEntropy < 0.8) rating = 'fragmented';
  else rating = 'chaotic';
  
  const recommendations: string[] = [];
  if (normalizedEntropy > 0.5) {
    recommendations.push(`Consolidate ${files.length} files into fewer directories by domain`);
  }
  if (dirGroups.size > 5) {
    recommendations.push('Consider barrel exports to reduce directory navigation');
  }
  if (gini > 0.5) {
    recommendations.push('Redistribute files more evenly across directories');
  }
  
  const firstFile = files.length > 0 ? files[0] : null;
  const domainValue = firstFile ? firstFile.domain : 'mixed';
  
  return {
    domain: domainValue,
    entropy: Math.round(normalizedEntropy * 100) / 100,
    rating,
    distribution: {
      locationCount: dirGroups.size,
      dominantLocation,
      giniCoefficient: Math.round(gini * 100) / 100,
    },
    recommendations,
  };
}

// ============================================
// CONCEPT COHESION METRICS
// ============================================

export interface ConceptCohesion {
  score: number;
  rating: 'excellent' | 'good' | 'moderate' | 'poor';
  analysis: {
    uniqueDomains: number;
    domainConcentration: number;
    exportPurposeClarity: number;
  };
}

export function calculateConceptCohesion(params: {
  exports: Array<{ name: string; inferredDomain?: string; domains?: string[] }>;
}): ConceptCohesion {
  const { exports } = params;
  
  if (exports.length === 0) {
    return {
      score: 1,
      rating: 'excellent',
      analysis: { uniqueDomains: 0, domainConcentration: 0, exportPurposeClarity: 1 },
    };
  }
  
  const allDomains: string[] = [];
  for (const exp of exports) {
    if (exp.inferredDomain) allDomains.push(exp.inferredDomain);
    if (exp.domains) allDomains.push(...exp.domains);
  }
  
  const uniqueDomains = new Set(allDomains);
  
  const domainCounts = new Map<string, number>();
  for (const d of allDomains) {
    domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
  }
  const maxCount = Math.max(...Array.from(domainCounts.values()), 1);
  const domainConcentration = maxCount / allDomains.length;
  
  const exportPurposeClarity = 1 - (uniqueDomains.size - 1) / Math.max(1, exports.length);
  
  const score = (domainConcentration * 0.5) + (exportPurposeClarity * 0.5);
  
  let rating: ConceptCohesion['rating'];
  if (score > 0.8) rating = 'excellent';
  else if (score > 0.6) rating = 'good';
  else if (score > 0.4) rating = 'moderate';
  else rating = 'poor';
  
  return {
    score: Math.round(score * 100) / 100,
    rating,
    analysis: {
      uniqueDomains: uniqueDomains.size,
      domainConcentration: Math.round(domainConcentration * 100) / 100,
      exportPurposeClarity: Math.round(exportPurposeClarity * 100) / 100,
    },
  };
}

// ============================================
// AGGREGATE FUTURE-PROOF SCORE
// ============================================

export function calculateFutureProofScore(params: {
  cognitiveLoad: CognitiveLoad;
  patternEntropy: PatternEntropy;
  conceptCohesion: ConceptCohesion;
  semanticDistances?: SemanticDistance[];
}): ToolScoringOutput {
  const loadScore = 100 - params.cognitiveLoad.score;
  const entropyScore = 100 - (params.patternEntropy.entropy * 100);
  const cohesionScore = params.conceptCohesion.score * 100;
  
  const overall = Math.round(
    (loadScore * 0.40) +
    (entropyScore * 0.30) +
    (cohesionScore * 0.30)
  );
  
  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Cognitive Load',
      impact: Math.round(loadScore - 50),
      description: params.cognitiveLoad.rating,
    },
    {
      name: 'Pattern Entropy',
      impact: Math.round(entropyScore - 50),
      description: params.patternEntropy.rating,
    },
    {
      name: 'Concept Cohesion',
      impact: Math.round(cohesionScore - 50),
      description: params.conceptCohesion.rating,
    },
  ];
  
  const recommendations: ToolScoringOutput['recommendations'] = [];
  
  for (const rec of params.patternEntropy.recommendations) {
    recommendations.push({
      action: rec,
      estimatedImpact: 5,
      priority: 'medium',
    });
  }
  
  if (params.conceptCohesion.rating === 'poor') {
    recommendations.push({
      action: 'Improve concept cohesion by grouping related exports',
      estimatedImpact: 8,
      priority: 'high',
    });
  }
  
  const semanticDistanceAvg = params.semanticDistances && params.semanticDistances.length > 0
    ? params.semanticDistances.reduce((s, d) => s + d.distance, 0) / params.semanticDistances.length
    : 0;
  
  return {
    toolName: 'future-proof',
    score: overall,
    rawMetrics: {
      cognitiveLoadScore: params.cognitiveLoad.score,
      entropyScore: params.patternEntropy.entropy,
      cohesionScore: params.conceptCohesion.score,
      semanticDistanceAvg,
    },
    factors,
    recommendations,
  };
}

// ============================================
// HALLUCINATION RISK METRICS
// ============================================

/**
 * Signals that increase the likelihood of AI generating incorrect code.
 * Technology-agnostic: these patterns confuse both current and future AI.
 */
export interface HallucinationRiskSignal {
  name: string;
  count: number;          // How many instances detected
  riskContribution: number; // 0-100 contribution to overall risk
  description: string;
  examples?: string[];    // First few examples found
}

/**
 * Hallucination Risk Score (0-100, higher = more risk)
 * 
 * Measures code patterns that empirically cause AI models to:
 * - Confidently generate incorrect function signatures
 * - Create plausible-but-wrong implementations
 * - Miss implicit contracts / side effects
 * - Misunderstand overloaded symbols
 */
export interface HallucinationRisk {
  /** Overall risk score (0-100). Higher = more likely AI will hallucinate. */
  score: number;
  rating: 'minimal' | 'low' | 'moderate' | 'high' | 'severe';
  signals: HallucinationRiskSignal[];
  /** Most impactful signal to fix first */
  topRisk: string;
  recommendations: string[];
}

/**
 * Calculate hallucination risk from code analysis results
 * 
 * Input data can come from any parser; all inputs are normalized 0-N counts.
 */
export function calculateHallucinationRisk(params: {
  /** Overloaded function names (same name, different signatures) */
  overloadedSymbols: number;
  /** Magic numbers and string literals without named constants */
  magicLiterals: number;
  /** Boolean trap parameters (function(true, false, null)) */
  booleanTraps: number;
  /** Implicit returns / void-implicit side effect functions */
  implicitSideEffects: number;
  /** Callback nesting depth > 3 (callback hell indicator) */
  deepCallbacks: number;
  /** Non-descriptive names: single letters, x1/x2 patterns, tmp/data/obj */
  ambiguousNames: number;
  /** Exported symbols with no JSDoc/docstring */
  undocumentedExports: number;
  /** Total symbols analyzed (for normalization) */
  totalSymbols: number;
  /** Total exports in codebase */
  totalExports: number;
}): HallucinationRisk {
  const {
    overloadedSymbols, magicLiterals, booleanTraps, implicitSideEffects,
    deepCallbacks, ambiguousNames, undocumentedExports, totalSymbols, totalExports,
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

  // Each signal is normalized to 0-100 contribution
  // Weights reflect empirical impact on AI accuracy

  const overloadRatio = Math.min(1, overloadedSymbols / Math.max(1, totalSymbols));
  const overloadSignal: HallucinationRiskSignal = {
    name: 'Symbol Overloading',
    count: overloadedSymbols,
    riskContribution: Math.round(overloadRatio * 100 * 0.25), // 25% weight
    description: `${overloadedSymbols} overloaded symbols — AI picks wrong signature`,
  };

  const magicRatio = Math.min(1, magicLiterals / Math.max(1, totalSymbols * 2));
  const magicSignal: HallucinationRiskSignal = {
    name: 'Magic Literals',
    count: magicLiterals,
    riskContribution: Math.round(magicRatio * 100 * 0.20), // 20% weight
    description: `${magicLiterals} unnamed constants — AI invents wrong values`,
  };

  const trapRatio = Math.min(1, booleanTraps / Math.max(1, totalSymbols));
  const trapSignal: HallucinationRiskSignal = {
    name: 'Boolean Traps',
    count: booleanTraps,
    riskContribution: Math.round(trapRatio * 100 * 0.20), // 20% weight
    description: `${booleanTraps} boolean trap parameters — AI inverts intent`,
  };

  const sideEffectRatio = Math.min(1, implicitSideEffects / Math.max(1, totalExports));
  const sideEffectSignal: HallucinationRiskSignal = {
    name: 'Implicit Side Effects',
    count: implicitSideEffects,
    riskContribution: Math.round(sideEffectRatio * 100 * 0.15), // 15% weight
    description: `${implicitSideEffects} functions with implicit side effects — AI misses contracts`,
  };

  const callbackRatio = Math.min(1, deepCallbacks / Math.max(1, totalSymbols * 0.1));
  const callbackSignal: HallucinationRiskSignal = {
    name: 'Callback Nesting',
    count: deepCallbacks,
    riskContribution: Math.round(callbackRatio * 100 * 0.10), // 10% weight
    description: `${deepCallbacks} deep callback chains — AI loses control flow context`,
  };

  const ambiguousRatio = Math.min(1, ambiguousNames / Math.max(1, totalSymbols));
  const ambiguousSignal: HallucinationRiskSignal = {
    name: 'Ambiguous Names',
    count: ambiguousNames,
    riskContribution: Math.round(ambiguousRatio * 100 * 0.10), // 10% weight
    description: `${ambiguousNames} non-descriptive identifiers — AI guesses wrong intent`,
  };

  const undocRatio = Math.min(1, undocumentedExports / Math.max(1, totalExports));
  const undocSignal: HallucinationRiskSignal = {
    name: 'Undocumented Exports',
    count: undocumentedExports,
    riskContribution: Math.round(undocRatio * 100 * 0.10), // 10% weight
    description: `${undocumentedExports} public functions without docs — AI fabricates behavior`,
  };

  const signals = [
    overloadSignal, magicSignal, trapSignal,
    sideEffectSignal, callbackSignal, ambiguousSignal, undocSignal,
  ];

  const score = Math.min(100, signals.reduce((sum, s) => sum + s.riskContribution, 0));

  let rating: HallucinationRisk['rating'];
  if (score < 10) rating = 'minimal';
  else if (score < 25) rating = 'low';
  else if (score < 50) rating = 'moderate';
  else if (score < 75) rating = 'high';
  else rating = 'severe';

  // Find top risk signal
  const topSignal = signals.reduce((a, b) => a.riskContribution > b.riskContribution ? a : b);
  const topRisk = topSignal.riskContribution > 0
    ? topSignal.description
    : 'No significant hallucination risks detected';

  const recommendations: string[] = [];
  if (overloadSignal.riskContribution > 5) {
    recommendations.push(`Rename ${overloadedSymbols} overloaded symbols to unique, intent-revealing names`);
  }
  if (magicSignal.riskContribution > 5) {
    recommendations.push(`Extract ${magicLiterals} magic literals into named constants`);
  }
  if (trapSignal.riskContribution > 5) {
    recommendations.push(`Replace ${booleanTraps} boolean traps with named options objects`);
  }
  if (undocSignal.riskContribution > 5) {
    recommendations.push(`Add JSDoc/docstrings to ${undocumentedExports} undocumented public functions`);
  }
  if (sideEffectSignal.riskContribution > 5) {
    recommendations.push('Mark functions with side effects explicitly in their names or docs');
  }

  return {
    score: Math.round(score),
    rating,
    signals: signals.filter(s => s.count > 0),
    topRisk,
    recommendations,
  };
}

// ============================================
// AGENT GROUNDING SCORE METRICS
// ============================================

/**
 * Agent Grounding Score
 * 
 * Measures how well an AI agent can navigate a codebase *independently*,
 * without human assistance or extensive prompting.
 * 
 * High grounding = agent can find files, understand project structure,
 * locate relevant code, and correctly infer ownership without being told.
 * 
 * This is technology-agnostic: any agentic system (current or future)
 * needs these structural guarantees to work effectively.
 */
export interface AgentGroundingScore {
  /** 0-100 score; higher = better self-navigation */
  score: number;
  rating: 'excellent' | 'good' | 'moderate' | 'poor' | 'disorienting';
  dimensions: {
    /** Can agent find where to put new code? (directory structure clarity) */
    structureClarityScore: number;
    /** Can agent understand what a file does from its name alone? */
    selfDocumentationScore: number;
    /** Are entry points (index, main, README) present and accurate? */
    entryPointScore: number;
    /** Does the public API surface reflect the project's mental model? */
    apiClarityScore: number;
    /** Is the domain language consistent? (Same concept = same word everywhere) */
    domainConsistencyScore: number;
  };
  recommendations: string[];
}

/**
 * Calculate how well an AI agent can ground itself in the codebase
 */
export function calculateAgentGrounding(params: {
  /** Number of directories exceeding recommended depth (> 4 levels) */
  deepDirectories: number;
  /** Total directories */
  totalDirectories: number;
  /** Files whose name alone doesn't reveal purpose (e.g., utils.ts, helpers.ts, misc.ts) */
  vagueFileNames: number;
  /** Total files */
  totalFiles: number;
  /** Whether a root README exists */
  hasRootReadme: boolean;
  /** Whether README has been updated in last 90 days (or unknown) */
  readmeIsFresh: boolean;
  /** Number of barrel exports (index.ts/index.js files that re-export) */
  barrelExports: number;
  /** Number of exported functions/classes/types with no type annotations */
  untypedExports: number;
  /** Total exports */
  totalExports: number;
  /** Number of domain terms used inconsistently (same concept, different names) */
  inconsistentDomainTerms: number;
  /** Distinct domain vocabulary size (unique business terms detected) */
  domainVocabularySize: number;
}): AgentGroundingScore {
  const {
    deepDirectories, totalDirectories, vagueFileNames, totalFiles,
    hasRootReadme, readmeIsFresh, barrelExports, untypedExports, totalExports,
    inconsistentDomainTerms, domainVocabularySize,
  } = params;

  // Structure clarity: penalize deep directories
  const deepDirRatio = totalDirectories > 0 ? deepDirectories / totalDirectories : 0;
  const structureClarityScore = Math.max(0, Math.round(100 - (deepDirRatio * 80)));

  // Self-documentation: file names that reveal purpose
  const vagueRatio = totalFiles > 0 ? vagueFileNames / totalFiles : 0;
  const selfDocumentationScore = Math.max(0, Math.round(100 - (vagueRatio * 90)));

  // Entry point score: README presence, freshness, barrel exports
  let entryPointScore = 60; // Base
  if (hasRootReadme) entryPointScore += 25;
  if (readmeIsFresh) entryPointScore += 10;
  const barrelRatio = totalFiles > 0 ? barrelExports / (totalFiles * 0.1) : 0;
  entryPointScore += Math.round(Math.min(5, barrelRatio * 5)); // Up to +5 for good barrel use
  entryPointScore = Math.min(100, entryPointScore);

  // API clarity: typed exports are navigable
  const untypedRatio = totalExports > 0 ? untypedExports / totalExports : 0;
  const apiClarityScore = Math.max(0, Math.round(100 - (untypedRatio * 70)));

  // Domain consistency: same term for same concept
  const inconsistencyRatio = domainVocabularySize > 0
    ? inconsistentDomainTerms / domainVocabularySize
    : 0;
  const domainConsistencyScore = Math.max(0, Math.round(100 - (inconsistencyRatio * 80)));

  // Weighted overall
  const score = Math.round(
    (structureClarityScore * 0.20) +
    (selfDocumentationScore * 0.25) +
    (entryPointScore * 0.20) +
    (apiClarityScore * 0.15) +
    (domainConsistencyScore * 0.20)
  );

  let rating: AgentGroundingScore['rating'];
  if (score >= 85) rating = 'excellent';
  else if (score >= 70) rating = 'good';
  else if (score >= 50) rating = 'moderate';
  else if (score >= 30) rating = 'poor';
  else rating = 'disorienting';

  const recommendations: string[] = [];
  if (structureClarityScore < 70) {
    recommendations.push(`Flatten ${deepDirectories} overly-deep directories to improve agent navigation`);
  }
  if (selfDocumentationScore < 70) {
    recommendations.push(`Rename ${vagueFileNames} vague files (utils, helpers, misc) to domain-specific names`);
  }
  if (!hasRootReadme) {
    recommendations.push('Add a root README.md so agents understand the project context immediately');
  } else if (!readmeIsFresh) {
    recommendations.push('Update README.md — stale entry-point documentation disorients agents');
  }
  if (apiClarityScore < 70) {
    recommendations.push(`Add TypeScript types to ${untypedExports} untyped exports to improve API discoverability`);
  }
  if (domainConsistencyScore < 70) {
    recommendations.push(`Unify ${inconsistentDomainTerms} inconsistent domain terms — agents need one word per concept`);
  }

  return {
    score,
    rating,
    dimensions: {
      structureClarityScore,
      selfDocumentationScore,
      entryPointScore,
      apiClarityScore,
      domainConsistencyScore,
    },
    recommendations,
  };
}

// ============================================
// TESTABILITY INDEX METRICS
// ============================================

/**
 * Testability Index
 * 
 * Measures how verifiable AI-generated changes are.
 * AI assistants are only as useful as your ability to validate their output.
 * 
 * Core insight: A codebase where generated code CAN'T be verified
 * is one where AI assistance actively introduces hidden risk.
 * 
 * Technology-agnostic: test frameworks change; testability principles don't.
 */
export interface TestabilityIndex {
  /** 0-100 score; higher = AI changes are more verifiable */
  score: number;
  rating: 'excellent' | 'good' | 'moderate' | 'poor' | 'unverifiable';
  dimensions: {
    /** Ratio of test files to source files */
    testCoverageRatio: number;
    /** Pure function prevalence (no side effects = easy to test) */
    purityScore: number;
    /** Dependency injection / inversion of control score */
    dependencyInjectionScore: number;
    /** Interface segregation (small, focused interfaces) */
    interfaceFocusScore: number;
    /** Observable outputs (functions return values vs mutate state) */
    observabilityScore: number;
  };
  /** Estimated AI suggestion safety — without tests, AI changes are high-risk */
  aiChangeSafetyRating: 'safe' | 'moderate-risk' | 'high-risk' | 'blind-risk';
  recommendations: string[];
}

/**
 * Calculate testability index from code structure analysis
 */
export function calculateTestabilityIndex(params: {
  /** Number of test files (*.test.*, *.spec.*, __tests__/**) */
  testFiles: number;
  /** Number of source files (excluding tests, configs) */
  sourceFiles: number;
  /** Functions that take only data and return data (no I/O, no mutations) */
  pureFunctions: number;
  /** Total functions analyzed */
  totalFunctions: number;
  /** Classes/functions using constructor injection or factory patterns */
  injectionPatterns: number;
  /** Total classes/services */
  totalClasses: number;
  /** Interfaces/types with > 10 methods (low segregation) */
  bloatedInterfaces: number;
  /** Total interfaces/types */
  totalInterfaces: number;
  /** Functions that directly mutate external state (globals, DOM, DB without abstraction) */
  externalStateMutations: number;
  /** Has a defined testing framework (package.json test script exists) */
  hasTestFramework: boolean;
}): TestabilityIndex {
  const {
    testFiles, sourceFiles, pureFunctions, totalFunctions,
    injectionPatterns, totalClasses, bloatedInterfaces, totalInterfaces,
    externalStateMutations, hasTestFramework,
  } = params;

  // Test coverage ratio (0-100): presence and density of tests
  const rawCoverageRatio = sourceFiles > 0 ? testFiles / sourceFiles : 0;
  const testCoverageRatio = Math.min(100, Math.round(rawCoverageRatio * 100));

  // Purity score: pure functions are trivially testable
  const purityRatio = totalFunctions > 0 ? pureFunctions / totalFunctions : 0.5;
  const purityScore = Math.round(purityRatio * 100);

  // Dependency injection: DI means you can substitute mocks
  const injectionRatio = totalClasses > 0 ? injectionPatterns / totalClasses : 0.5;
  const dependencyInjectionScore = Math.round(Math.min(100, injectionRatio * 100));

  // Interface focus: small interfaces = easier to mock and verify
  const bloatedRatio = totalInterfaces > 0 ? bloatedInterfaces / totalInterfaces : 0;
  const interfaceFocusScore = Math.max(0, Math.round(100 - (bloatedRatio * 80)));

  // Observability: functions returning values > mutating state
  const mutationRatio = totalFunctions > 0 ? externalStateMutations / totalFunctions : 0;
  const observabilityScore = Math.max(0, Math.round(100 - (mutationRatio * 100)));

  // Framework bonus/penalty
  const frameworkWeight = hasTestFramework ? 1.0 : 0.8;

  // Weighted overall
  const rawScore = (
    (testCoverageRatio * 0.30) +
    (purityScore * 0.25) +
    (dependencyInjectionScore * 0.20) +
    (interfaceFocusScore * 0.10) +
    (observabilityScore * 0.15)
  ) * frameworkWeight;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let rating: TestabilityIndex['rating'];
  if (score >= 85) rating = 'excellent';
  else if (score >= 70) rating = 'good';
  else if (score >= 50) rating = 'moderate';
  else if (score >= 30) rating = 'poor';
  else rating = 'unverifiable';

  // AI change safety is driven primarily by test presence
  let aiChangeSafetyRating: TestabilityIndex['aiChangeSafetyRating'];
  if (rawCoverageRatio >= 0.5 && score >= 70) aiChangeSafetyRating = 'safe';
  else if (rawCoverageRatio >= 0.2 && score >= 50) aiChangeSafetyRating = 'moderate-risk';
  else if (rawCoverageRatio > 0) aiChangeSafetyRating = 'high-risk';
  else aiChangeSafetyRating = 'blind-risk';

  const recommendations: string[] = [];
  if (!hasTestFramework) {
    recommendations.push('Add a testing framework (Jest, Vitest, pytest) — AI changes cannot be verified without tests');
  }
  if (rawCoverageRatio < 0.3) {
    const neededTests = Math.round(sourceFiles * 0.3 - testFiles);
    recommendations.push(`Add ~${neededTests} test files to reach 30% coverage ratio — minimum for safe AI assistance`);
  }
  if (purityScore < 50) {
    recommendations.push('Extract pure functions from side-effectful code — pure functions are trivially AI-testable');
  }
  if (dependencyInjectionScore < 50 && totalClasses > 0) {
    recommendations.push('Adopt dependency injection — makes classes mockable and AI-generated code verifiable');
  }
  if (externalStateMutations > totalFunctions * 0.3) {
    recommendations.push('Reduce direct state mutations — return values instead to improve observability');
  }

  return {
    score,
    rating,
    dimensions: {
      testCoverageRatio,
      purityScore,
      dependencyInjectionScore,
      interfaceFocusScore,
      observabilityScore,
    },
    aiChangeSafetyRating,
    recommendations,
  };
}

// ============================================
// AGGREGATE EXTENDED FUTURE-PROOF SCORE
// ============================================

/**
 * Calculate the complete extended future-proof score including all 6 dimensions.
 * Replaces calculateFutureProofScore when all dimensions are available.
 */
export function calculateExtendedFutureProofScore(params: {
  cognitiveLoad: CognitiveLoad;
  patternEntropy: PatternEntropy;
  conceptCohesion: ConceptCohesion;
  hallucinationRisk: HallucinationRisk;
  agentGrounding: AgentGroundingScore;
  testability: TestabilityIndex;
  semanticDistances?: SemanticDistance[];
}): ToolScoringOutput {
  const loadScore = 100 - params.cognitiveLoad.score;
  const entropyScore = 100 - (params.patternEntropy.entropy * 100);
  const cohesionScore = params.conceptCohesion.score * 100;
  const hallucinationScore = 100 - params.hallucinationRisk.score;
  const groundingScore = params.agentGrounding.score;
  const testabilityScore = params.testability.score;

  // Weights: cognitive clarity + code structure + AI safety
  const overall = Math.round(
    (loadScore * 0.20) +
    (entropyScore * 0.15) +
    (cohesionScore * 0.15) +
    (hallucinationScore * 0.20) +
    (groundingScore * 0.15) +
    (testabilityScore * 0.15)
  );

  const factors: ToolScoringOutput['factors'] = [
    {
      name: 'Cognitive Load',
      impact: Math.round(loadScore - 50),
      description: params.cognitiveLoad.rating,
    },
    {
      name: 'Pattern Entropy',
      impact: Math.round(entropyScore - 50),
      description: params.patternEntropy.rating,
    },
    {
      name: 'Concept Cohesion',
      impact: Math.round(cohesionScore - 50),
      description: params.conceptCohesion.rating,
    },
    {
      name: 'Hallucination Risk',
      impact: Math.round(hallucinationScore - 50),
      description: `${params.hallucinationRisk.rating} risk (${params.hallucinationRisk.score}/100 raw)`,
    },
    {
      name: 'Agent Grounding',
      impact: Math.round(groundingScore - 50),
      description: params.agentGrounding.rating,
    },
    {
      name: 'Testability',
      impact: Math.round(testabilityScore - 50),
      description: `${params.testability.rating} — AI changes are ${params.testability.aiChangeSafetyRating}`,
    },
  ];

  const recommendations: ToolScoringOutput['recommendations'] = [];

  // Collect and prioritize all recommendations
  for (const rec of params.hallucinationRisk.recommendations) {
    recommendations.push({ action: rec, estimatedImpact: 8, priority: 'high' });
  }
  for (const rec of params.agentGrounding.recommendations) {
    recommendations.push({ action: rec, estimatedImpact: 6, priority: 'medium' });
  }
  for (const rec of params.testability.recommendations) {
    const priority = params.testability.aiChangeSafetyRating === 'blind-risk' ? 'high' : 'medium';
    recommendations.push({ action: rec, estimatedImpact: 10, priority });
  }
  for (const rec of params.patternEntropy.recommendations) {
    recommendations.push({ action: rec, estimatedImpact: 5, priority: 'low' });
  }

  const semanticDistanceAvg = params.semanticDistances && params.semanticDistances.length > 0
    ? params.semanticDistances.reduce((s, d) => s + d.distance, 0) / params.semanticDistances.length
    : 0;

  return {
    toolName: 'future-proof',
    score: overall,
    rawMetrics: {
      cognitiveLoadScore: params.cognitiveLoad.score,
      entropyScore: params.patternEntropy.entropy,
      cohesionScore: params.conceptCohesion.score,
      hallucinationRiskScore: params.hallucinationRisk.score,
      agentGroundingScore: params.agentGrounding.score,
      testabilityScore: params.testability.score,
      semanticDistanceAvg,
    },
    factors,
    recommendations,
  };
}
