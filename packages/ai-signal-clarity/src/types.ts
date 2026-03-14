import {
  ScanOptions,
  AnalysisResult,
  Issue,
  IssueType,
  SpokeOutput,
  Severity,
} from '@aiready/core';

export interface AiSignalClarityOptions extends ScanOptions {
  checkMagicLiterals?: boolean;
  checkBooleanTraps?: boolean;
  checkAmbiguousNames?: boolean;
  checkUndocumentedExports?: boolean;
  checkImplicitSideEffects?: boolean;
  checkDeepCallbacks?: boolean;
  checkOverloadedSymbols?: boolean;
  checkLargeFiles?: boolean;
  minSeverity?: Severity | string;
}

export interface AiSignalClarityIssue extends Issue {
  category?: string;
  signalType?: string;
  context?: string;
}

export interface FileAiSignalClarityResult extends AnalysisResult {
  signals: {
    type: string;
    description: string;
    impact: number;
    location: {
      line: number;
      column: number;
    };
  }[];
  issues: AiSignalClarityIssue[];
  filePath?: string; // For backward compatibility
}

export interface AiSignalClarityReport extends SpokeOutput {
  summary: {
    filesAnalyzed: number;
    totalSignals: number;
    criticalSignals: number;
    majorSignals: number;
    minorSignals: number;
    topRisk: string;
    rating: string;
  };
  results: FileAiSignalClarityResult[];
  aggregateSignals: any;
  recommendations: string[];
}
