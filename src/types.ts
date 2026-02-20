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

  // File classification (NEW)
  fileClassification: FileClassification; // Type of file for analysis context

  // Recommendations
  severity: 'critical' | 'major' | 'minor' | 'info';
  issues: string[]; // List of specific problems
  recommendations: string[]; // Actionable suggestions
  potentialSavings: number; // Estimated token savings if fixed
}

/**
 * Classification of file type for analysis context
 * Helps distinguish real issues from false positives
 */
export type FileClassification = 
  | 'barrel-export'    // Re-exports from other modules (index.ts files)
  | 'type-definition'  // Primarily type/interface definitions
  | 'cohesive-module'  // Single domain, high cohesion (acceptable large files)
  | 'mixed-concerns'   // Multiple domains, potential refactoring candidate
  | 'unknown';         // Unable to classify

export interface ModuleCluster {
  domain: string; // e.g., "user-management", "auth"
  files: string[];
  totalTokens: number;
  fragmentationScore: number; // 0-1, higher = more scattered
  pathEntropy?: number; // normalized [0-1] Shannon entropy of directory distribution
  directoryDistance?: number; // normalized [0-1] based on common ancestor depth
  importCohesion?: number; // 0-1 average pairwise Jaccard similarity of imports
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
  coUsageMatrix?: Map<string, Map<string, number>>; // file -> file -> co-usage count
  typeGraph?: Map<string, Set<string>>; // type -> files that reference it
}

export interface DependencyNode {
  file: string;
  imports: string[]; // Direct imports
  exports: ExportInfo[];
  tokenCost: number;
  linesOfCode: number;
  exportedBy?: string[]; // Files that import exports from this file
  sharedTypes?: string[]; // Types shared with other files
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  inferredDomain?: string; // Inferred from name/usage (legacy single domain)
  domains?: DomainAssignment[]; // Multi-domain support with confidence scores
  imports?: string[]; // Imports used by this export (for import-based cohesion)
  dependencies?: string[]; // Other exports from same file this depends on
  typeReferences?: string[]; // TypeScript types referenced by this export
}

export interface DomainAssignment {
  domain: string;
  confidence: number; // 0-1, how confident are we in this assignment
  signals: DomainSignals; // Which signals contributed to this assignment
}

export interface DomainSignals {
  folderStructure: boolean; // Matched from folder name
  importPath: boolean; // Matched from import paths
  typeReference: boolean; // Matched from TypeScript type usage
  coUsage: boolean; // Matched from co-usage patterns
  exportName: boolean; // Matched from export identifier name
}

export interface CoUsageData {
  file: string;
  coImportedWith: Map<string, number>; // file -> count of times imported together
  sharedImporters: string[]; // files that import both this and another file
}

export interface TypeDependency {
  typeName: string;
  definedIn: string; // file where type is defined
  usedBy: string[]; // files that reference this type
}

