import { scanFiles, readFileContent } from '@aiready/core';
import type { ScanOptions } from '@aiready/core';
import {
  buildDependencyGraph,
  calculateImportDepth,
  getTransitiveDependencies,
  calculateContextBudget,
  detectCircularDependencies,
  calculateCohesion,
  calculateFragmentation,
  detectModuleClusters,
  calculatePathEntropy,
  calculateDirectoryDistance,
  classifyFile,
  adjustFragmentationForClassification,
  getClassificationRecommendations,
} from './analyzer';
import { calculateContextScore } from './scoring';
import type {
  ContextAnalyzerOptions,
  ContextAnalysisResult,
  ContextSummary,
  ModuleCluster,
  DomainAssignment,
  DomainSignals,
  CoUsageData,
  TypeDependency,
  FileClassification,
} from './types';
import {
  buildCoUsageMatrix,
  buildTypeGraph,
  findSemanticClusters,
  calculateDomainConfidence,
  inferDomainFromSemantics,
  getCoUsageData,
  findConsolidationCandidates,
} from './semantic-analysis';

export type { 
  ContextAnalyzerOptions, 
  ContextAnalysisResult, 
  ContextSummary, 
  ModuleCluster,
  DomainAssignment,
  DomainSignals,
  CoUsageData,
  TypeDependency,
  FileClassification,
};

export {
  classifyFile,
  adjustFragmentationForClassification,
};

export {
  buildCoUsageMatrix,
  buildTypeGraph,
  findSemanticClusters,
  calculateDomainConfidence,
  inferDomainFromSemantics,
  getCoUsageData,
  findConsolidationCandidates,
};

/**
 * Generate smart defaults for context analysis based on repository size
 * Automatically tunes thresholds to target ~10 most serious issues
 */
async function getSmartDefaults(
  directory: string,
  userOptions: Partial<ContextAnalyzerOptions>
): Promise<ContextAnalyzerOptions> {
  // Estimate repository size by scanning files
  const files = await scanFiles({
    rootDir: directory,
    include: userOptions.include,
    exclude: userOptions.exclude,
  });

  const estimatedBlocks = files.length;

  // Smart defaults based on repository size
  // Adjusted to be stricter (higher thresholds) to catch only serious issues
  // This targets ~10 most critical issues instead of showing all files
  let maxDepth: number;
  let maxContextBudget: number;
  let minCohesion: number;
  let maxFragmentation: number;

  if (estimatedBlocks < 100) {
    // Small project - be more lenient
    maxDepth = 4;
    maxContextBudget = 8000;
    minCohesion = 0.5;
    maxFragmentation = 0.5;
  } else if (estimatedBlocks < 500) {
    // Medium project - moderate strictness
    maxDepth = 5;
    maxContextBudget = 15000;
    minCohesion = 0.45;
    maxFragmentation = 0.6;
  } else if (estimatedBlocks < 2000) {
    // Large project - stricter to focus on worst issues
    maxDepth = 7;
    maxContextBudget = 25000;
    minCohesion = 0.4;
    maxFragmentation = 0.7;
  } else {
    // Enterprise project - very strict to show only critical issues
    maxDepth = 10;
    maxContextBudget = 40000;
    minCohesion = 0.35;
    maxFragmentation = 0.8;
  }

  return {
    maxDepth,
    maxContextBudget,
    minCohesion,
    maxFragmentation,
    focus: 'all',
    includeNodeModules: false,
    rootDir: userOptions.rootDir || directory,
    include: userOptions.include,
    exclude: userOptions.exclude,
  };
}

/**
 * Analyze AI context window cost for a codebase
 */
export async function analyzeContext(
  options: ContextAnalyzerOptions
): Promise<ContextAnalysisResult[]> {
  const {
    maxDepth = 5,
    maxContextBudget = 10000,
    minCohesion = 0.6,
    maxFragmentation = 0.5,
    focus = 'all',
    includeNodeModules = false,
    ...scanOptions
  } = options;

  // Scan files (supports .ts, .js, .tsx, .jsx, .py)
  // Note: scanFiles now automatically merges user excludes with DEFAULT_EXCLUDE
  const files = await scanFiles({
    ...scanOptions,
    // Only add node_modules to exclude if includeNodeModules is false
    // The DEFAULT_EXCLUDE already includes node_modules, so this is only needed
    // if user overrides the default exclude list
    exclude: includeNodeModules && scanOptions.exclude
      ? scanOptions.exclude.filter(pattern => pattern !== '**/node_modules/**')
      : scanOptions.exclude,
  });

  // Separate files by language
  const pythonFiles = files.filter(f => f.toLowerCase().endsWith('.py'));
  const tsJsFiles = files.filter(f => !f.toLowerCase().endsWith('.py'));

  // Read all file contents
  const fileContents = await Promise.all(
    files.map(async (file) => ({
      file,
      content: await readFileContent(file),
    }))
  );

  // Build dependency graph (TS/JS)
  const graph = buildDependencyGraph(fileContents.filter(f => !f.file.toLowerCase().endsWith('.py')));

  // Analyze Python files separately (if any)
  let pythonResults: ContextAnalysisResult[] = [];
  if (pythonFiles.length > 0) {
    const { analyzePythonContext } = await import('./analyzers/python-context');
    const pythonMetrics = await analyzePythonContext(pythonFiles, scanOptions.rootDir || options.rootDir || '.');
    
    // Convert Python metrics to ContextAnalysisResult format
    pythonResults = pythonMetrics.map(metric => {
      const { severity, issues, recommendations, potentialSavings } = analyzeIssues({
        file: metric.file,
        importDepth: metric.importDepth,
        contextBudget: metric.contextBudget,
        cohesionScore: metric.cohesion,
        fragmentationScore: 0, // Python analyzer doesn't calculate fragmentation yet
        maxDepth,
        maxContextBudget,
        minCohesion,
        maxFragmentation,
        circularDeps: metric.metrics.circularDependencies.map(cycle => cycle.split(' → ')),
      });

      return {
        file: metric.file,
        tokenCost: Math.floor(metric.contextBudget / (1 + metric.imports.length || 1)), // Estimate
        linesOfCode: metric.metrics.linesOfCode,
        importDepth: metric.importDepth,
        dependencyCount: metric.imports.length,
        dependencyList: metric.imports.map(imp => imp.resolvedPath || imp.source),
        circularDeps: metric.metrics.circularDependencies.map(cycle => cycle.split(' → ')),
        cohesionScore: metric.cohesion,
        domains: ['python'], // Generic for now
        exportCount: metric.exports.length,
        contextBudget: metric.contextBudget,
        fragmentationScore: 0,
        relatedFiles: [],
        fileClassification: 'unknown' as const, // Python files not yet classified
        severity,
        issues,
        recommendations,
        potentialSavings,
      };
    });
  }

  // Detect circular dependencies (TS/JS)
  const circularDeps = detectCircularDependencies(graph);

  // Detect module clusters for fragmentation analysis
  // Enable log-scaling for fragmentation by default on medium+ repos
  const useLogScale = files.length >= 500; // medium and larger projects
  const clusters = detectModuleClusters(graph, { useLogScale });
  const fragmentationMap = new Map<string, number>();
  for (const cluster of clusters) {
    for (const file of cluster.files) {
      fragmentationMap.set(file, cluster.fragmentationScore);
    }
  }

  // Analyze each file
  const results: ContextAnalysisResult[] = [];

  for (const { file } of fileContents) {
    const node = graph.nodes.get(file);
    if (!node) continue;

    // Calculate metrics based on focus
    const importDepth =
      focus === 'depth' || focus === 'all'
        ? calculateImportDepth(file, graph)
        : 0;

    const dependencyList =
      focus === 'depth' || focus === 'all'
        ? getTransitiveDependencies(file, graph)
        : [];

    const contextBudget =
      focus === 'all' ? calculateContextBudget(file, graph) : node.tokenCost;

    const cohesionScore =
      focus === 'cohesion' || focus === 'all'
        ? calculateCohesion(node.exports, file)
        : 1;

    const fragmentationScore = fragmentationMap.get(file) || 0;

    // Find related files (files in same domain cluster)
    const relatedFiles: string[] = [];
    for (const cluster of clusters) {
      if (cluster.files.includes(file)) {
        relatedFiles.push(...cluster.files.filter((f) => f !== file));
        break;
      }
    }

    // Determine severity and generate issues/recommendations
    const { severity, issues, recommendations, potentialSavings } =
      analyzeIssues({
        file,
        importDepth,
        contextBudget,
        cohesionScore,
        fragmentationScore,
        maxDepth,
        maxContextBudget,
        minCohesion,
        maxFragmentation,
        circularDeps,
      });

    // Get domains from exports
    const domains = [
      ...new Set(node.exports.map((e) => e.inferredDomain || 'unknown')),
    ];

    // Classify the file to help distinguish real issues from false positives
    const fileClassification = classifyFile(node, cohesionScore, domains);
    
    // Adjust fragmentation based on classification
    const adjustedFragmentationScore = adjustFragmentationForClassification(
      fragmentationScore,
      fileClassification
    );

    // Get classification-specific recommendations
    const classificationRecommendations = getClassificationRecommendations(
      fileClassification,
      file,
      issues
    );

    // Re-analyze issues with adjusted fragmentation
    const {
      severity: adjustedSeverity,
      issues: adjustedIssues,
      recommendations: finalRecommendations,
      potentialSavings: adjustedSavings,
    } = analyzeIssues({
      file,
      importDepth,
      contextBudget,
      cohesionScore,
      fragmentationScore: adjustedFragmentationScore,
      maxDepth,
      maxContextBudget,
      minCohesion,
      maxFragmentation,
      circularDeps,
    });

    results.push({
      file,
      tokenCost: node.tokenCost,
      linesOfCode: node.linesOfCode,
      importDepth,
      dependencyCount: dependencyList.length,
      dependencyList,
      circularDeps: circularDeps.filter((cycle) => cycle.includes(file)),
      cohesionScore,
      domains,
      exportCount: node.exports.length,
      contextBudget,
      fragmentationScore: adjustedFragmentationScore,
      relatedFiles,
      fileClassification,
      severity: adjustedSeverity,
      issues: adjustedIssues,
      recommendations: [...finalRecommendations, ...classificationRecommendations.slice(0, 1)],
      potentialSavings: adjustedSavings,
    });
  }

  // Merge Python and TS/JS results
  const allResults = [...results, ...pythonResults];

  // Keep ALL results including info severity for visualization purposes
  // The visualizer needs to show all files as nodes
  const sorted = allResults.sort((a, b) => {
    const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.contextBudget - a.contextBudget;
  });

  return sorted;
}

/**
 * Generate summary of context analysis results
 */
export function generateSummary(
  results: ContextAnalysisResult[]
): ContextSummary {
  if (results.length === 0) {
    return {
      totalFiles: 0,
      totalTokens: 0,
      avgContextBudget: 0,
      maxContextBudget: 0,
      avgImportDepth: 0,
      maxImportDepth: 0,
      deepFiles: [],
      avgFragmentation: 0,
      fragmentedModules: [],
      avgCohesion: 0,
      lowCohesionFiles: [],
      criticalIssues: 0,
      majorIssues: 0,
      minorIssues: 0,
      totalPotentialSavings: 0,
      topExpensiveFiles: [],
    };
  }

  const totalFiles = results.length;
  const totalTokens = results.reduce((sum, r) => sum + r.tokenCost, 0);
  const totalContextBudget = results.reduce(
    (sum, r) => sum + r.contextBudget,
    0
  );
  const avgContextBudget = totalContextBudget / totalFiles;
  const maxContextBudget = Math.max(...results.map((r) => r.contextBudget));

  const avgImportDepth =
    results.reduce((sum, r) => sum + r.importDepth, 0) / totalFiles;
  const maxImportDepth = Math.max(...results.map((r) => r.importDepth));

  const deepFiles = results
    .filter((r) => r.importDepth >= 5)
    .map((r) => ({ file: r.file, depth: r.importDepth }))
    .sort((a, b) => b.depth - a.depth)
    .slice(0, 10);

  const avgFragmentation =
    results.reduce((sum, r) => sum + r.fragmentationScore, 0) / totalFiles;

  // Get unique module clusters
  const moduleMap = new Map<string, ContextAnalysisResult[]>();
  for (const result of results) {
    for (const domain of result.domains) {
      if (!moduleMap.has(domain)) {
        moduleMap.set(domain, []);
      }
      moduleMap.get(domain)!.push(result);
    }
  }

  const fragmentedModules: ModuleCluster[] = [];
  for (const [domain, files] of moduleMap.entries()) {
    if (files.length < 2) continue;
    const fragmentationScore =
      files.reduce((sum, f) => sum + f.fragmentationScore, 0) / files.length;
    if (fragmentationScore < 0.3) continue; // Skip well-organized modules

    const totalTokens = files.reduce((sum, f) => sum + f.tokenCost, 0);
    const avgCohesion =
      files.reduce((sum, f) => sum + f.cohesionScore, 0) / files.length;
    const targetFiles = Math.max(1, Math.ceil(files.length / 3));

    // Compute path entropy and directory distance for reporting
    const filePaths = files.map((f) => f.file);
    const pathEntropy = calculatePathEntropy(filePaths);
    const directoryDistance = calculateDirectoryDistance(filePaths);

    // Compute import cohesion based on dependency lists (Jaccard similarity)
    function jaccard(a: string[], b: string[]) {
      const s1 = new Set(a || []);
      const s2 = new Set(b || []);
      if (s1.size === 0 && s2.size === 0) return 0;
      const inter = new Set([...s1].filter((x) => s2.has(x)));
      const uni = new Set([...s1, ...s2]);
      return uni.size === 0 ? 0 : inter.size / uni.size;
    }

    let importSimTotal = 0;
    let importPairs = 0;
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        importSimTotal += jaccard(files[i].dependencyList || [], files[j].dependencyList || []);
        importPairs++;
      }
    }

    const importCohesion = importPairs > 0 ? importSimTotal / importPairs : 0;

    fragmentedModules.push({
      domain,
      files: files.map((f) => f.file),
      totalTokens,
      fragmentationScore,
      pathEntropy,
      directoryDistance,
      importCohesion,
      avgCohesion,
      suggestedStructure: {
        targetFiles,
        consolidationPlan: [
          `Consolidate ${files.length} ${domain} files into ${targetFiles} cohesive file(s)`,
          `Current token cost: ${totalTokens.toLocaleString()}`,
          `Estimated savings: ${Math.floor(totalTokens * 0.3).toLocaleString()} tokens (30%)`,
        ],
      },
    });
  }

  fragmentedModules.sort((a, b) => b.fragmentationScore - a.fragmentationScore);

  const avgCohesion =
    results.reduce((sum, r) => sum + r.cohesionScore, 0) / totalFiles;

  const lowCohesionFiles = results
    .filter((r) => r.cohesionScore < 0.6)
    .map((r) => ({ file: r.file, score: r.cohesionScore }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  const criticalIssues = results.filter((r) => r.severity === 'critical').length;
  const majorIssues = results.filter((r) => r.severity === 'major').length;
  const minorIssues = results.filter((r) => r.severity === 'minor').length;

  const totalPotentialSavings = results.reduce(
    (sum, r) => sum + r.potentialSavings,
    0
  );

  const topExpensiveFiles = results
    .sort((a, b) => b.contextBudget - a.contextBudget)
    .slice(0, 10)
    .map((r) => ({
      file: r.file,
      contextBudget: r.contextBudget,
      severity: r.severity,
    }));

  return {
    totalFiles,
    totalTokens,
    avgContextBudget,
    maxContextBudget,
    avgImportDepth,
    maxImportDepth,
    deepFiles,
    avgFragmentation,
    fragmentedModules: fragmentedModules.slice(0, 10),
    avgCohesion,
    lowCohesionFiles,
    criticalIssues,
    majorIssues,
    minorIssues,
    totalPotentialSavings,
    topExpensiveFiles,
  };
}

/**
 * Analyze issues for a single file
 */
function analyzeIssues(params: {
  file: string;
  importDepth: number;
  contextBudget: number;
  cohesionScore: number;
  fragmentationScore: number;
  maxDepth: number;
  maxContextBudget: number;
  minCohesion: number;
  maxFragmentation: number;
  circularDeps: string[][];
}): {
  severity: ContextAnalysisResult['severity'];
  issues: string[];
  recommendations: string[];
  potentialSavings: number;
} {
  const {
    file,
    importDepth,
    contextBudget,
    cohesionScore,
    fragmentationScore,
    maxDepth,
    maxContextBudget,
    minCohesion,
    maxFragmentation,
    circularDeps,
  } = params;

  const issues: string[] = [];
  const recommendations: string[] = [];
  let severity: ContextAnalysisResult['severity'] = 'info';
  let potentialSavings = 0;

  // Check circular dependencies (CRITICAL)
  if (circularDeps.length > 0) {
    severity = 'critical';
    issues.push(
      `Part of ${circularDeps.length} circular dependency chain(s)`
    );
    recommendations.push('Break circular dependencies by extracting interfaces or using dependency injection');
    potentialSavings += contextBudget * 0.2; // Estimate 20% savings
  }

  // Check import depth
  if (importDepth > maxDepth * 1.5) {
    severity = severity === 'critical' ? 'critical' : 'critical';
    issues.push(`Import depth ${importDepth} exceeds limit by 50%`);
    recommendations.push('Flatten dependency tree or use facade pattern');
    potentialSavings += contextBudget * 0.3; // Estimate 30% savings
  } else if (importDepth > maxDepth) {
    severity = severity === 'critical' ? 'critical' : 'major';
    issues.push(`Import depth ${importDepth} exceeds recommended maximum ${maxDepth}`);
    recommendations.push('Consider reducing dependency depth');
    potentialSavings += contextBudget * 0.15;
  }

  // Check context budget
  if (contextBudget > maxContextBudget * 1.5) {
    severity = severity === 'critical' ? 'critical' : 'critical';
    issues.push(`Context budget ${contextBudget.toLocaleString()} tokens is 50% over limit`);
    recommendations.push('Split into smaller modules or reduce dependency tree');
    potentialSavings += contextBudget * 0.4; // Significant savings possible
  } else if (contextBudget > maxContextBudget) {
    severity = severity === 'critical' || severity === 'major' ? severity : 'major';
    issues.push(`Context budget ${contextBudget.toLocaleString()} exceeds ${maxContextBudget.toLocaleString()}`);
    recommendations.push('Reduce file size or dependencies');
    potentialSavings += contextBudget * 0.2;
  }

  // Check cohesion
  if (cohesionScore < minCohesion * 0.5) {
    severity = severity === 'critical' ? 'critical' : 'major';
    issues.push(`Very low cohesion (${(cohesionScore * 100).toFixed(0)}%) - mixed concerns`);
    recommendations.push('Split file by domain - separate unrelated functionality');
    potentialSavings += contextBudget * 0.25;
  } else if (cohesionScore < minCohesion) {
    severity = severity === 'critical' || severity === 'major' ? severity : 'minor';
    issues.push(`Low cohesion (${(cohesionScore * 100).toFixed(0)}%)`);
    recommendations.push('Consider grouping related exports together');
    potentialSavings += contextBudget * 0.1;
  }

  // Check fragmentation
  if (fragmentationScore > maxFragmentation) {
    severity = severity === 'critical' || severity === 'major' ? severity : 'minor';
    issues.push(`High fragmentation (${(fragmentationScore * 100).toFixed(0)}%) - scattered implementation`);
    recommendations.push('Consolidate with related files in same domain');
    potentialSavings += contextBudget * 0.3;
  }

  if (issues.length === 0) {
    issues.push('No significant issues detected');
    recommendations.push('File is well-structured for AI context usage');
  }

  // Detect build artifacts and downgrade severity to reduce noise
  if (isBuildArtifact(file)) {
    issues.push('Detected build artifact (bundled/output file)');
    recommendations.push('Exclude build outputs (e.g., cdk.out, dist, build, .next) from analysis');
    severity = downgradeSeverity(severity);
    // Build artifacts do not represent actionable savings
    potentialSavings = 0;
  }

  return { severity, issues, recommendations, potentialSavings: Math.floor(potentialSavings) };
}

export { getSmartDefaults };

/**
 * Heuristic: identify common build artifact paths
 */
function isBuildArtifact(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('/node_modules/') ||
    lower.includes('/dist/') ||
    lower.includes('/build/') ||
    lower.includes('/out/') ||
    lower.includes('/output/') ||
    lower.includes('/cdk.out/') ||
    lower.includes('/.next/') ||
    /\/asset\.[^/]+\//.test(lower) // e.g., cdk.out/asset.*
  );
}

function downgradeSeverity(s: ContextAnalysisResult['severity']): ContextAnalysisResult['severity'] {
  switch (s) {
    case 'critical':
      return 'minor';
    case 'major':
      return 'minor';
    case 'minor':
      return 'info';
    default:
      return 'info';
  }
}

export { calculateContextScore };
