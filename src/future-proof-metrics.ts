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
