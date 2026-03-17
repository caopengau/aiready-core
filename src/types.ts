import {
  ToolName,
  IssueType,
  Severity,
  Metrics,
  AnalysisResult,
  SpokeOutput,
  UnifiedReport,
  Location,
  Issue,
  UnifiedReportSchema,
  AnalysisStatus,
  FRIENDLY_TOOL_NAMES,
  ToolOptions,
} from './types/schema';
import { TokenBudget } from './types/ast';
import { GraphNode, GraphEdge, GraphData } from './types/visualization';
import {
  Lead,
  LeadSchema,
  LeadSubmission,
  LeadSubmissionSchema,
  LeadSource,
  LeadSourceSchema,
} from './types/business';

export {
  GraphNode,
  GraphEdge,
  GraphData,
  TokenBudget,
  UnifiedReportSchema,
  AnalysisStatus,
  FRIENDLY_TOOL_NAMES,
  Lead,
  LeadSchema,
  LeadSubmission,
  LeadSubmissionSchema,
  LeadSource,
  LeadSourceSchema,
};
export { ToolName, IssueType, Severity };

export type {
  Metrics,
  AnalysisResult,
  SpokeOutput,
  UnifiedReport,
  Location,
  Issue,
  ToolOptions,
};

/**
 * AI readiness configuration
 */
export interface AIReadyConfig {
  /** Target score threshold (0-100) */
  threshold?: number;
  /** Files or directories to include in scan */
  include?: string[];
  /** Files or directories to exclude from scan */
  exclude?: string[];
  /** Scan-specific configuration */
  scan?: {
    include?: string[];
    exclude?: string[];
    parallel?: boolean;
    deep?: boolean;
  };
  /** Output-specific configuration */
  output?: {
    /** Output format (json, console, html) */
    format?: 'json' | 'console' | 'html';
    /** Output file path */
    path?: string;
    /** Output directory */
    saveTo?: string;
    /** Whether to show score breakdown in console */
    showBreakdown?: boolean;
    /** Baseline report to compare against */
    compareBaseline?: string;
  };
  /** Tool-specific configuration overrides */
  tools?: Record<string, any>;
  /** Scoring profile and weights */
  scoring?: {
    /** Name of the scoring profile (e.g. "strict", "balanced") */
    profile?: string;
    /** Custom weights for tools and metrics */
    weights?: Record<string, number>;
  };
}

/**
 * Legacy alias for Config
 */
export type Config = AIReadyConfig;

/**
 * Scan options for tool providers
 */
export interface ScanOptions extends ToolOptions {
  /** Target output format */
  output?: string | { format: string; file?: string };
  /** Visual format (json/console/html) */
  format?: 'json' | 'console' | 'html';
  /** Whether to run in parallel */
  parallel?: boolean;
}

/**
 * Result of a single tool execution
 */
export interface ToolOutput {
  /** Unique name/ID of the tool */
  toolName: ToolName | string;
  /** Whether the tool ran successfully */
  success: boolean;
  /** List of issues found by the tool */
  issues: IssueType[] | any[];
  /** Numeric metrics produced by the tool */
  metrics: Metrics;
  /** Execution duration in milliseconds */
  duration?: number;
}

/**
 * Overall scan result
 */
export interface ScanResult {
  /** ISO timestamp of the scan */
  timestamp: string;
  /** Root directory analyzed */
  rootDir: string;
  /** Number of files processed */
  filesAnalyzed: number;
  /** Total issues found across all tools */
  totalIssues: number;
  /** Breakdown of issue counts by type */
  issuesByType: Record<string, number>;
  /** Breakdown of issue counts by severity */
  issuesBySeverity: Record<Severity | string, number>;
  /** Final calculated AIReady score (0-100) */
  score: number;
  /** Individual tool outputs */
  tools: ToolOutput[];
}

/**
 * Cost configuration for business impact analysis
 */
export interface CostConfig {
  /** Price in USD per 1,000 tokens */
  pricePer1KTokens: number;
  /** Average number of AI queries per developer per day */
  queriesPerDevPerDay: number;
  /** Total number of developers in the team */
  developerCount: number;
  /** Working days per month */
  daysPerMonth: number;
}

/**
 * Productivity impact metrics
 */
export interface ProductivityImpact {
  /** Estimated developer hours wasted on quality issues */
  totalHours: number;
  /** Developer hourly rate used for calculation */
  hourlyRate: number;
  /** Estimated total monthly cost of productivity loss */
  totalCost: number;
  /** Impact breakdown by severity */
  bySeverity: Record<
    Severity | string,
    {
      /** Hours lost for this severity level */
      hours: number;
      /** Cost associated with these hours */
      cost: number;
    }
  >;
}

/**
 * AI suggestion acceptance prediction
 */
export interface AcceptancePrediction {
  /** Predicted acceptance rate (0-1) */
  rate: number;
  /** Confidence level of the prediction (0-1) */
  confidence: number;
  /** Qualitative factors influencing the prediction */
  factors: Array<{
    /** Factor name */
    name: string;
    /** Impact weight (-100 to 100) */
    impact: number;
  }>;
}

/**
 * Technical Value Chain summary
 */
export interface TechnicalValueChain {
  /** Overall business value score for the component */
  score?: number;
  /** Business logic density (e.g. core vs boilerplate) */
  density?: number;
  /** Data access layer complexity */
  complexity?: number;
  /** API surface area and exposure */
  surface?: number;
  /** Issue type associated with this chain */
  issueType?: string;
  /** Name of the leading technical metric */
  technicalMetric?: string;
  /** Raw value of the technical metric */
  technicalValue?: number;
  /** Impact on AI agents */
  aiImpact?: {
    description: string;
    scoreImpact: number;
  };
  /** Impact on developer experience */
  developerImpact?: {
    description: string;
    productivityLoss: number;
  };
  /** Predicted business outcome */
  businessOutcome?: {
    directCost: number;
    opportunityCost: number;
    riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  };
}

/**
 * Compatibility alias
 */
export type TechnicalValueChainSummary = TechnicalValueChain;

/**
 * Code comprehension difficulty metrics
 */
export interface ComprehensionDifficulty {
  /** Overall difficulty score (0-100) */
  score: number;
  /** Descriptive rating of difficulty */
  rating: 'trivial' | 'easy' | 'moderate' | 'difficult' | 'expert';
  /** Ratios and factors contributing to difficulty */
  factors: {
    /** Ratio of file tokens to model context limit */
    budgetRatio: number;
    /** Relative depth of dependency tree */
    depthRatio: number;
    /** Level of logical fragmentation */
    fragmentation: number;
  };
}

/**
 * Business impact metrics (v0.10+)
 */
export interface BusinessMetrics {
  /** Predicted monthly cost of technical waste */
  estimatedMonthlyCost?: number;
  /** Estimated developer hours lost per month */
  estimatedDeveloperHours?: number;
  /** Predicted rate of AI suggestion acceptance */
  aiAcceptanceRate?: number;
  /** Overall AI readiness score */
  aiReadinessScore?: number;
}

/**
 * Canonical file content structure
 */
export interface FileContent {
  /** Absolute or relative file path */
  file: string;
  /** UTF-8 file content */
  content: string;
}

/**
 * Constants for tests and configuration stability
 */
export const GLOBAL_INFRA_OPTIONS = [
  'rootDir',
  'include',
  'exclude',
  'tools',
  'scoring',
];
export const GLOBAL_SCAN_OPTIONS = [
  'rootDir',
  'include',
  'exclude',
  'config',
  'threshold',
  'output',
  'format',
  'parallel',
  'showBreakdown',
];
export const COMMON_FINE_TUNING_OPTIONS = [
  'maxDepth',
  'minSimilarity',
  'threshold',
  'showBreakdown',
];

/**
 * Re-export Severity for convenience
 */
export type { Severity as SeverityType };

/**
 * Analysis issue mapping to graph
 */
export type GraphIssueSeverity = Severity;

/**
 * Graph metadata
 */
export interface GraphMetadata {
  /** Project name if available */
  projectName?: string;
  /** ISO timestamp of analysis */
  timestamp: string;
  /** Total number of files in the graph */
  totalFiles: number;
  /** Total dependency edges in the graph */
  totalDependencies: number;
  /** Types of analysis performed */
  analysisTypes: string[];
  /** Count of critical issues in graph nodes */
  criticalIssues: number;
  /** Count of major issues in graph nodes */
  majorIssues: number;
  /** Count of minor issues in graph nodes */
  minorIssues: number;
  /** Count of informational issues in graph nodes */
  infoIssues: number;
  /** AI token budget unit economics (v0.13+) */
  tokenBudget?: TokenBudget;
  /** Execution time in milliseconds */
  executionTime?: number;
}
