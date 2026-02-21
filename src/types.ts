export interface AnalysisResult {
  fileName: string;
  issues: Issue[];
  metrics: Metrics;
}

export interface Issue {
  type: IssueType;
  severity: 'critical' | 'major' | 'minor' | 'info';
  message: string;
  location: Location;
  suggestion?: string;
}

export type IssueType =
  | 'duplicate-pattern'
  | 'context-fragmentation'
  | 'doc-drift'
  | 'naming-inconsistency'
    | 'naming-quality'
    | 'pattern-inconsistency'
    | 'architecture-inconsistency'
  | 'dead-code'
  | 'circular-dependency'
  | 'missing-types';

export interface Location {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface Metrics {
  tokenCost?: number;
  complexityScore?: number;
  consistencyScore?: number;
  docFreshnessScore?: number;
}

export interface ScanOptions {
  rootDir: string;
  include?: string[];
  exclude?: string[];
  maxDepth?: number;
}

export interface AIReadyConfig {
  // Global scan options
  scan?: {
    include?: string[];
    exclude?: string[];
    tools?: string[];  // Which tools to run: ["patterns", "context", "consistency"]
  };

  // Tool-specific configurations
  tools?: {
    'pattern-detect'?: {
      enabled?: boolean;
      scoreWeight?: number;
      minSimilarity?: number;
      minLines?: number;
      batchSize?: number;
      approx?: boolean;
      minSharedTokens?: number;
      maxCandidatesPerBlock?: number;
      streamResults?: boolean;
      maxResults?: number;
    };
    'context-analyzer'?: {
      enabled?: boolean;
      scoreWeight?: number;
      maxDepth?: number;
      maxContextBudget?: number;
      minCohesion?: number;
      maxFragmentation?: number;
      focus?: 'fragmentation' | 'cohesion' | 'depth' | 'all';
      includeNodeModules?: boolean;
      maxResults?: number;
      // Domain inference configuration
      domainKeywords?: string[]; // project-specific domain keywords (e.g., ['txn','transaction','cust'])
      domainPatterns?: string[]; // regex strings to match domains (e.g., ['^ord(er)?$', '^(inv|invoice)$'])
      pathDomainMap?: Record<string, string>; // map of path segment -> domain (e.g., {'orders': 'order'})
    };
    'consistency'?: {
      enabled?: boolean;
      scoreWeight?: number;
      // Custom abbreviations to accept (domain-specific terms)
      acceptedAbbreviations?: string[]; // e.g., ['ses', 'gst', 'cdk', 'btn', 'buf', 'agg']
      // Custom short words that are full English words, not abbreviations
      shortWords?: string[]; // e.g., ['oak', 'elm', 'ash'] for tree species
      // Disable specific checks
      disableChecks?: ('single-letter' | 'abbreviation' | 'convention-mix' | 'unclear' | 'poor-naming')[];
    };
    [toolName: string]: {
      enabled?: boolean;
      scoreWeight?: number;
      [key: string]: any;
    } | undefined;
  };

  // Scoring configuration
  scoring?: {
    threshold?: number;       // Minimum passing score
    showBreakdown?: boolean;  // Show detailed breakdown
    compareBaseline?: string; // Path to baseline JSON
    saveTo?: string;          // Auto-save score to path
  };

  // Output preferences
  output?: {
    format?: 'console' | 'json' | 'html';
    file?: string;
  };

  // Visualizer preferences
  visualizer?: {
    groupingDirs?: string[];
    graph?: {
      maxNodes?: number;
      maxEdges?: number;
    };
  };
}

export interface Report {
  summary: {
    totalFiles: number;
    totalIssues: number;
    criticalIssues: number;
    majorIssues: number;
  };
  results: AnalysisResult[];
  metrics: {
    overallScore: number;
    tokenCostTotal: number;
    avgConsistency: number;
  };
}

// ============================================
// Graph Visualization Types
// ============================================

/**
 * Severity levels for issues
 */
export type GraphIssueSeverity = 'critical' | 'major' | 'minor' | 'info';

/**
 * Base graph node
 */
export interface GraphNode {
  id: string;
  label: string;
  path?: string;
  size?: number;
  value?: number;
  color?: string;
  group?: string;
  x?: number;
  y?: number;
}

/**
 * Graph edge between nodes
 */
export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type?: string;
  weight?: number;
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  projectName?: string;
  timestamp: string;
  totalFiles: number;
  totalDependencies: number;
  analysisTypes: string[];
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  infoIssues: number;
}

/**
 * Complete graph data structure for visualization
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: { id: string; name: string; nodeIds: string[] }[];
  issues?: { id: string; type: string; severity: GraphIssueSeverity; nodeIds: string[]; message: string }[];
  metadata: GraphMetadata;
}
