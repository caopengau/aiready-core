import chalk from 'chalk';

/**
 * Shared logic for spoke-specific CLI entry points to reduce code duplication.
 */
export async function executeSpokeCli(
  name: string,
  description: string,
  options: any,
  analyzeFn: (config: any) => Promise<any>
) {
  console.log(chalk.cyan(`Analyzing ${description.toLowerCase()}...`));
  try {
    const report = await analyzeFn({
      rootDir: process.cwd(),
      ...options,
    });

    console.log(chalk.bold(`\n${name} Analysis Results:`));
    console.log(
      `Rating: ${report.summary.rating.toUpperCase()} (Score: ${report.summary.score})`
    );

    if (report.issues && report.issues.length > 0) {
      console.log(chalk.red(`\nFound ${report.issues.length} issues.`));
    } else {
      console.log(chalk.green('\nNo issues detected.'));
    }
    return report;
  } catch (err: any) {
    console.error(chalk.red(`Error during ${name} analysis: ${err.message}`));
    process.exit(1);
  }
}
