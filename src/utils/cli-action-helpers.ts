import { resolve as resolvePath } from 'path';
import {
  loadMergedConfig,
  resolveOutputPath,
  handleJSONOutput,
} from './cli-helpers';
import type { ToolScoringOutput } from '../scoring';

/**
 * Generate timestamp for report filenames (YYYYMMDD-HHMMSS)
 * Provides better granularity than date-only filenames
 */
export function getReportTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Interface for CLI action output parameters
 */
export interface JSONOutputParams {
  outputData: any;
  outputFile?: string;
  resolvedDir: string;
  prefix?: string;
}

/**
 * Standard JSON output handler for CLI actions.
 * Consolidates path resolution and output handling.
 */
export function handleStandardJSONOutput({
  outputData,
  outputFile,
  resolvedDir,
  prefix = 'aiready-report',
}: JSONOutputParams): void {
  const outputPath = resolveOutputPath(
    outputFile,
    `${prefix}-${getReportTimestamp()}.json`,
    resolvedDir
  );

  handleJSONOutput(outputData, outputPath, `✅ Results saved to ${outputPath}`);
}

/**
 * Resolves the output format and file path from CLI options and merged config.
 */
export function resolveOutputFormat(
  options: { output?: string; outputFile?: string },
  config: { output?: { format?: string; file?: string } }
) {
  const format = options.output ?? config.output?.format ?? 'console';
  const file = options.outputFile ?? config.output?.file;
  return { format, file };
}

/**
 * Common configuration preparation for CLI actions.
 * Resolves directory and merges configuration.
 */
export async function prepareActionConfig<T extends Record<string, any>>(
  directory: string,
  defaults: T,
  cliOptions: Partial<T>
) {
  const resolvedDir = resolvePath(process.cwd(), directory ?? '.');
  const finalOptions = await loadMergedConfig(
    resolvedDir,
    defaults,
    cliOptions
  );
  return { resolvedDir, finalOptions };
}

/**
 * Formats report data for standard JSON output including timing and scoring.
 */
export function formatStandardReport(params: {
  results?: any;
  report?: any;
  summary: any;
  elapsedTime: string;
  score?: ToolScoringOutput;
}) {
  const { results, report, summary, elapsedTime, score } = params;

  // Use report as base if provided, otherwise build from results and summary
  const baseData = report ? { ...report } : { results, summary };

  return {
    ...baseData,
    summary: {
      ...(baseData.summary || summary),
      executionTime: parseFloat(elapsedTime),
    },
    ...(score && { scoring: score }),
  };
}
