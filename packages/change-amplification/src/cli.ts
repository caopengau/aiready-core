#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { analyzeChangeAmplification } from './analyzer';
import type { ChangeAmplificationOptions } from './types';

export const changeAmplificationAction = async (
  directory: string,
  options: any
) => {
  try {
    const resolvedDir = path.resolve(process.cwd(), directory);
    const finalOptions: ChangeAmplificationOptions = {
      rootDir: resolvedDir,
      include: options.include ? options.include.split(',') : undefined,
      exclude: options.exclude ? options.exclude.split(',') : undefined,
    };

    const report = await analyzeChangeAmplification(finalOptions);

    if (options.output === 'json') {
      const outputPath =
        options.outputFile || `change-amplification-report-${Date.now()}.json`;
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      return;
    }

    console.log(chalk.bold('\n🌐 Change Amplification Analysis\n'));
    console.log(`Rating: ${chalk.bold(report.summary.rating)}`);
    console.log(`Score: ${Math.round(report.summary.score ?? 0)}/100`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Major Issues: ${report.summary.majorIssues}`);

    if (report.summary.recommendations.length > 0) {
      console.log(chalk.bold('\nRecommendations:'));
      for (const rec of report.summary.recommendations) {
        console.log(chalk.cyan(`• ${rec}`));
      }
    }

    if (report.results.length > 0) {
      console.log(chalk.bold('\nHotspots:'));
      for (const result of report.results) {
        console.log(`\n📄 ${chalk.cyan(result.fileName)}`);
        for (const issue of result.issues) {
          const color =
            issue.severity === 'critical' ? chalk.red : chalk.yellow;
          console.log(`  ${color('■')} ${issue.message}`);
          console.log(`    ${chalk.dim('Suggestion: ' + issue.suggestion)}`);
        }
      }
    } else {
      console.log(
        chalk.green(
          '\n✨ No change amplification issues found. Architecture is well contained.'
        )
      );
    }
  } catch (error) {
    console.error(
      chalk.red('Error during change amplification analysis:'),
      error
    );
    process.exit(1);
  }
};

const program = new Command();
program
  .name('aiready-change-amplification')
  .description('Analyze graph metrics for change amplification')
  .argument('[directory]', 'Directory to analyze', '.')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(changeAmplificationAction);

if (require.main === module) {
  program.parse();
}
