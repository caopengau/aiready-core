import chalk from 'chalk';
import { ScanOptions } from '../types/common';

/**
 * Shared logic for spoke-specific CLI entry points to reduce code duplication.
 */
export async function executeSpokeCli(
  name: string,
  description: string,
  options: Partial<ScanOptions> & Record<string, any>,
  analyzeFn: (config: ScanOptions) => Promise<unknown>
) {
  console.log(chalk.cyan(`Analyzing ${description.toLowerCase()}...`));
  try {
    const report = await analyzeFn({
      ...options,
      rootDir: options.rootDir ?? process.cwd(),
    } as ScanOptions);

    console.log(chalk.bold(`\n${name} Analysis Results:`));
    const reportRecord = report as Record<string, unknown>;
    const summary = reportRecord.summary as Record<string, unknown>;
    console.log(
      `Rating: ${(summary.rating as string).toUpperCase()} (Score: ${summary.score})`
    );

    const issues = reportRecord.issues as unknown[] | undefined;
    if (issues && issues.length > 0) {
      console.log(chalk.red(`\nFound ${issues.length} issues.`));
    } else {
      console.log(chalk.green('\nNo issues detected.'));
    }
    return report;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error during ${name} analysis: ${errorMessage}`));
    process.exit(1);
  }
}
