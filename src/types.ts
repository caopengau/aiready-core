import type { ScanOptions } from '@aiready/core';

export interface ContextAnalyzerOptions extends ScanOptions {
  maxDepth?: number; // Maximum acceptable import depth, default 5
  maxContextBudget?: number; // Maximum acceptable token budget, default 10000
  minCohesion?: number; // Minimum acceptable cohesion score (0-1), default 0.6
  maxFragmentation?: number; // Maximum acceptable fragmentation (0-1), default 0.5
  focus?: 'fragmentation' | 'cohesion' | 'depth' | 'all'; // Analysis focus, default 'all'
  includeNodeModules?: boolean; // Include node_modules in analysis, default false
}

export interface ContextAnalysisResult {
  file: string;

  // Basic metrics
  tokenCost: number; // Total tokens in this file
  linesOfCode: number;

  // Dependency analysis
  importDepth: number; // Max depth of import tree
  dependencyCount: number; // Total transitive dependencies
  dependencyList: string[]; // All files in dependency tree
  circularDeps: string[][]; // Circular dependency chains if any

  // Cohesion analysis
  cohesionScore: number; // 0-1, how related are exports (1 = perfect cohesion)
  domains: string[]; // Detected domain categories (e.g., ['user', 'auth'])
  exportCount: number;

  // AI context impact
  contextBudget: number; // Total tokens to understand this file (includes all deps)
  fragmentationScore: number; // 0-1, how scattered is this domain (0 = well-grouped)
  relatedFiles: string[]; // Files that should be loaded together

  // Recommendations
  severity: 'critical' | 'major' | 'minor' | 'info';
  issues: string[]; // List of specific problems
  recommendations: string[]; // Actionable suggestions
  potentialSavings: number; // Estimated token savings if fixed
}

export interface ModuleCluster {
  domain: string; // e.g., "user-management", "auth"
  files: string[];
  totalTokens: number;
  fragmentationScore: number; // 0-1, higher = more scattered
  avgCohesion: number; // Average cohesion across files in cluster
  suggestedStructure: {
    targetFiles: number; // Recommended number of files
    consolidationPlan: string[]; // Step-by-step suggestions
  };
}

export interface ContextSummary {
  totalFiles: number;
  totalTokens: number;
  avgContextBudget: number;
  maxContextBudget: number;

  // Depth metrics
  avgImportDepth: number;
  maxImportDepth: number;
  deepFiles: Array<{ file: string; depth: number }>; // Files exceeding maxDepth

  // Fragmentation metrics
  avgFragmentation: number;
  fragmentedModules: ModuleCluster[];

  // Cohesion metrics
  avgCohesion: number;
  lowCohesionFiles: Array<{ file: string; score: number }>;

  // Issues summary
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  totalPotentialSavings: number;

  // Top offenders
  topExpensiveFiles: Array<{
    file: string;
    contextBudget: number;
    severity: string;
  }>;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>; // file -> dependencies
}

export interface DependencyNode {
  file: string;
  imports: string[]; // Direct imports
  exports: ExportInfo[];
  tokenCost: number;
  linesOfCode: number;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  inferredDomain?: string; // Inferred from name/usage
}
