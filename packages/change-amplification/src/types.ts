import {
  ScanOptions,
  AnalysisResult,
  Issue,
  IssueType,
  SpokeOutput,
} from '@aiready/core';

export type ChangeAmplificationOptions = ScanOptions;

export interface ChangeAmplificationIssue extends Issue {
  type: IssueType.ChangeAmplification;
}

export interface FileChangeAmplificationResult extends AnalysisResult {
  issues: ChangeAmplificationIssue[];
}

export interface ChangeAmplificationReport extends SpokeOutput {
  results: FileChangeAmplificationResult[];
}
