import {
  AnalysisResult,
  createProvider,
  ToolName,
  ScanOptions,
} from '@aiready/core';
import { analyzeAiSignalClarity } from './analyzer';
import { calculateAiSignalClarityScore } from './scoring';
import { AiSignalClarityOptions, AiSignalClarityReport } from './types';

/**
 * AI Signal Clarity Tool Provider
 */
export const AiSignalClarityProvider = createProvider({
  id: ToolName.AiSignalClarity,
  alias: ['ai-signal', 'clarity', 'hallucination'],
  version: '0.9.5',
  defaultWeight: 11,
  async analyzeReport(options: ScanOptions) {
    return analyzeAiSignalClarity(options as AiSignalClarityOptions);
  },
  getResults(report): AnalysisResult[] {
    return report.results.map((r) => ({
      fileName: r.fileName,
      issues: r.issues as any[],
      metrics: {
        aiSignalClarityScore: 100,
      },
    }));
  },
  getSummary(report) {
    return report.summary;
  },
  getMetadata(report) {
    return { aggregateSignals: report.aggregateSignals };
  },
  score(output) {
    const report = {
      summary: output.summary,
      aggregateSignals: (output.metadata as any).aggregateSignals,
      results: [],
    } as unknown as AiSignalClarityReport;
    return calculateAiSignalClarityScore(report);
  },
});
