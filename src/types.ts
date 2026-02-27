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
  | 'dependency-health'
  | 'naming-inconsistency'
  | 'naming-quality'
  | 'pattern-inconsistency'
  | 'architecture-inconsistency'
  | 'dead-code'
  | 'circular-dependency'
  | 'missing-types'
  // v0.12+ dimensions
  | 'ai-signal-clarity'        // Code pattern known to cause AI AI signal clarity
  | 'low-testability'           // AI changes cannot be safely verified
  | 'agent-navigation-failure'  // Agent cannot determine where code belongs
  | 'ambiguous-api'             // Public API surface is unclear or untyped
  | 'magic-literal'             // Unnamed constant confuses AI intent inference
  | 'boolean-trap'              // Boolean param pattern that inverts AI intent
  | 'change-amplification';     // A small change here causes massive downstream breakages

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

  // Business value metrics (v0.10+)
  estimatedMonthlyCost?: number;
  estimatedDeveloperHours?: number;
  comprehensionDifficultyIndex?: number;

  // AI agent readiness metrics (v0.12+)
  /** Probability (0-100) that AI will hallucinate in this file/module */
  aiSignalClarityScore?: number;
  /** How well an agent can navigate to/from this file unaided (0-100) */
  agentGroundingScore?: number;
  /** Whether AI-generated changes to this file can be safely verified (0-100) */
  testabilityScore?: number;
  /** Level of documentation drift vs code reality (0-100, higher = more drift) */
  docDriftScore?: number;
  /** Health of dependencies in relation to AI training knowledge (0-100) */
  dependencyHealthScore?: number;
  /** Model context tier this analysis was calibrated for */
  modelContextTier?: 'compact' | 'standard' | 'extended' | 'frontier';
}

// ============================================
// Business Value Metrics
// ============================================

/**
 * Cost estimation configuration
 */
export interface CostConfig {
  /** Price per 1K tokens (default: $0.01 for GPT-4) */
  pricePer1KTokens: number;
  /** Average AI queries per developer per day */
  queriesPerDevPerDay: number;
  /** Number of developers on the team */
  developerCount: number;
  /** Days per month (default: 30) */
  daysPerMonth: number;
}

/**
 * Productivity impact estimates
 */
export interface ProductivityImpact {
  /** Estimated hours to fix all issues */
  totalHours: number;
  /** Average hourly rate for developers */
  hourlyRate: number;
  /** Estimated total fix cost */
  totalCost: number;
  /** Breakdown by severity */
  bySeverity: {
    critical: { hours: number; cost: number };
    major: { hours: number; cost: number };
    minor: { hours: number; cost: number };
  };
}

/**
 * AI acceptance rate prediction
 * Based on research correlating code quality to AI suggestion acceptance
 */
export interface AcceptancePrediction {
  /** Predicted acceptance rate (0-1) */
  rate: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Factors affecting acceptance */
  factors: {
    name: string;
    impact: number; // +/- percentage points
  }[];
}

/**
 * Comprehension difficulty score (future-proof abstraction)
 * Normalized 0-100 scale: lower = easier for AI to understand
 */
export interface ComprehensionDifficulty {
  /** Overall difficulty score (0-100) */
  score: number;
  /** Factors contributing to difficulty */
  factors: {
    name: string;
    contribution: number;
    description: string;
  }[];
  /** Interpretation */
  rating: 'trivial' | 'easy' | 'moderate' | 'difficult' | 'expert';
}

/**
 * Extended report with business metrics
 */
export interface BusinessReport extends Report {
  businessMetrics: {
    /** Estimated monthly cost impact of AI context waste */
    estimatedMonthlyCost: number;
    /** Estimated developer hours to address issues */
    estimatedDeveloperHours: number;
    /** Predicted AI suggestion acceptance rate */
    aiAcceptanceRate: number;
    /** Comprehension difficulty assessment */
    comprehensionDifficulty: ComprehensionDifficulty;
    /** Timestamp for trend tracking */
    period?: string;
  };
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
