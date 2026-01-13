#!/usr/bin/env node

import { Command } from 'commander';
import { analyzePatterns, generateSummary, detectDuplicatePatterns } from './index';
import type { PatternType, DuplicatePattern } from './detector';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';

const program = new Command();

program
  .name('aiready-patterns')
  .description('Detect duplicate patterns in your codebase')
  .version('0.1.0')
  .addHelpText('after', '\nCONFIGURATION:\n  Supports config files: aiready.json, aiready.config.json, .aiready.json, .aireadyrc.json, aiready.config.js, .aireadyrc.js\n  CLI options override config file settings')
  .argument('<directory>', 'Directory to analyze')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1)')
  .option('-l, --min-lines <number>', 'Minimum lines to consider')
  .option('--batch-size <number>', 'Batch size for comparisons')
  .option('--no-approx', 'Disable approximate candidate selection (faster on small repos, slower on large)')
  .option('--min-shared-tokens <number>', 'Minimum shared tokens to consider a candidate')
  .option('--max-candidates <number>', 'Maximum candidates per block')
  .option('--no-stream-results', 'Disable incremental output (default: enabled)')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('--severity <level>', 'Filter by severity: critical|high|medium|all')
  .option('--include-tests', 'Include test files in analysis (excluded by default)')
  .option('--max-results <number>', 'Maximum number of results to show in console output')
  .option(
    '-o, --output <format>',
    'Output format: console, json, html',
    'console'
  )
  .option('--output-file <path>', 'Output file path (for json/html)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();

    // Load config file if it exists
    const config = loadConfig(directory);

    // Define defaults
    const defaults = {
      minSimilarity: 0.4,
      minLines: 5,
      batchSize: 100,
      approx: true,
      minSharedTokens: 8,
      maxCandidatesPerBlock: 100,
      streamResults: true,
      include: undefined,
      exclude: undefined,
      severity: 'all',
      includeTests: false,
      maxResults: 10,
    };

    // Merge config with defaults
    const mergedConfig = mergeConfigWithDefaults(config, defaults);

    // Override with CLI options (CLI takes precedence)
    const finalOptions = {
      rootDir: directory,
      minSimilarity: options.similarity ? parseFloat(options.similarity) : mergedConfig.minSimilarity,
      minLines: options.minLines ? parseInt(options.minLines) : mergedConfig.minLines,
      batchSize: options.batchSize ? parseInt(options.batchSize) : mergedConfig.batchSize,
      approx: options.approx !== false && mergedConfig.approx, // CLI --no-approx takes precedence
      minSharedTokens: options.minSharedTokens ? parseInt(options.minSharedTokens) : mergedConfig.minSharedTokens,
      maxCandidatesPerBlock: options.maxCandidates ? parseInt(options.maxCandidates) : mergedConfig.maxCandidatesPerBlock,
      streamResults: options.streamResults !== false && mergedConfig.streamResults,
      include: options.include?.split(',') || mergedConfig.include,
      exclude: options.exclude?.split(',') || mergedConfig.exclude,
      severity: options.severity || mergedConfig.severity,
      includeTests: options.includeTests || mergedConfig.includeTests,
      maxResults: options.maxResults ? parseInt(options.maxResults) : mergedConfig.maxResults,
    };

    // Handle test file exclusion by default
    if (!finalOptions.includeTests) {
      const testPatterns = [
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
        '**/test/**',
        '**/*.test',
        '**/*.spec',
      ];
      finalOptions.exclude = finalOptions.exclude
        ? [...finalOptions.exclude, ...testPatterns]
        : testPatterns;
    }

    const { results, duplicates: rawDuplicates, files } = await analyzePatterns(finalOptions);



    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = generateSummary(results);
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    if (options.output === 'json') {
      const jsonOutput = {
        summary,
        results,
        timestamp: new Date().toISOString(),
      };

      if (options.outputFile) {
        writeFileSync(options.outputFile, JSON.stringify(jsonOutput, null, 2));
        console.log(chalk.green(`\n✓ JSON report saved to ${options.outputFile}`));
      } else {
        console.log(JSON.stringify(jsonOutput, null, 2));
      }
      return;
    }

    if (options.output === 'html') {
      const html = generateHTMLReport(summary, results);
      const outputPath = options.outputFile || join(process.cwd(), 'pattern-report.html');
      writeFileSync(outputPath, html);
      console.log(chalk.green(`\n✓ HTML report saved to ${outputPath}`));
      return;
    }

    // Console output
    const terminalWidth = process.stdout.columns || 80;
    const dividerWidth = Math.min(60, terminalWidth - 2);
    const divider = '━'.repeat(dividerWidth);
    
    console.log(chalk.cyan(divider));
    console.log(chalk.bold.white('  PATTERN ANALYSIS SUMMARY'));
    console.log(chalk.cyan(divider) + '\n');

    console.log(
      chalk.white(`📁 Files analyzed: ${chalk.bold(results.length)}`)
    );
    console.log(
      chalk.yellow(`⚠  Duplicate patterns found: ${chalk.bold(totalIssues)}`)
    );
    console.log(
      chalk.red(
        `💰 Token cost (wasted): ${chalk.bold(summary.totalTokenCost.toLocaleString())}`
      )
    );
    console.log(
      chalk.gray(`⏱  Analysis time: ${chalk.bold(elapsedTime + 's')}`)
    );

    // Show breakdown by pattern type (only if duplicates exist)
    const sortedTypes = Object.entries(summary.patternsByType)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    if (sortedTypes.length > 0) {
      console.log(chalk.cyan('\n' + divider));
      console.log(chalk.bold.white('  PATTERNS BY TYPE'));
      console.log(chalk.cyan(divider) + '\n');

      sortedTypes.forEach(([type, count]) => {
        const icon = getPatternIcon(type as PatternType);
        console.log(`${icon} ${chalk.white(type.padEnd(15))} ${chalk.bold(count)}`);
      });
    }

    // Show top duplicates with detailed information
    if (totalIssues > 0) {
      console.log(chalk.cyan('\n' + divider));
      console.log(chalk.bold.white('  TOP DUPLICATE PATTERNS'));
      console.log(chalk.cyan(divider) + '\n');

      // Filter duplicates by severity if specified
      let filteredDuplicates = rawDuplicates;
      if (finalOptions.severity !== 'all') {
        const severityThresholds = {
          critical: 0.95,
          high: 0.9,
          medium: 0.4,
        };
        const threshold = severityThresholds[finalOptions.severity as keyof typeof severityThresholds] || 0.4;
        filteredDuplicates = rawDuplicates.filter(dup => dup.similarity >= threshold);
      }

      // Sort by similarity (highest first) and take top N
      const topDuplicates = filteredDuplicates
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, finalOptions.maxResults);

      topDuplicates.forEach((dup, idx) => {
        const severity = dup.similarity > 0.95 ? 'CRITICAL' : dup.similarity > 0.9 ? 'HIGH' : 'MEDIUM';
        const severityIcon = dup.similarity > 0.95 ? '🔴' : dup.similarity > 0.9 ? '🟡' : '🔵';

        // Get relative file names for cleaner display
        const file1Name = dup.file1.split('/').pop() || dup.file1;
        const file2Name = dup.file2.split('/').pop() || dup.file2;

        console.log(`${severityIcon} ${severity}: ${chalk.bold(file1Name)} ↔ ${chalk.bold(file2Name)}`);
        console.log(`   Similarity: ${chalk.bold(Math.round(dup.similarity * 100) + '%')} | Wasted: ${chalk.bold(dup.tokenCost.toLocaleString())} tokens each`);
        console.log(`   Location: lines ${chalk.cyan(dup.line1 + '-' + dup.endLine1)} ↔ lines ${chalk.cyan(dup.line2 + '-' + dup.endLine2)}\n`);
      });
    }

    // Show detailed issues for critical ones
    const allIssues = results.flatMap((r) =>
      r.issues.map((issue) => ({ ...issue, file: r.fileName }))
    );

    const criticalIssues = allIssues.filter(
      (issue) => issue.severity === 'critical'
    );

    if (criticalIssues.length > 0) {
      console.log(chalk.cyan(divider));
      console.log(chalk.bold.white('  CRITICAL ISSUES (>95% similar)'));
      console.log(chalk.cyan(divider) + '\n');

      criticalIssues.slice(0, 5).forEach((issue) => {
        console.log(chalk.red('● ') + chalk.white(`${issue.file}:${issue.location.line}`));
        console.log(`  ${chalk.dim(issue.message)}`);
        console.log(`  ${chalk.green('→')} ${chalk.italic(issue.suggestion)}\n`);
      });
    }

    // Show a success message if no duplicates
    if (totalIssues === 0) {
      console.log(chalk.green('\n✨ Great! No duplicate patterns detected.\n'));
    }

    console.log(chalk.cyan(divider));
    
    if (totalIssues > 0) {
      console.log(
        chalk.white(
          `\n💡 Run with ${chalk.bold('--output json')} or ${chalk.bold('--output html')} for detailed reports`
        )
      );
    }

    console.log(
      chalk.dim(
        '\n⭐ Like AIReady? Star us on GitHub: https://github.com/caopengau/aiready-pattern-detect'
      )
    );
    console.log(
      chalk.dim('🐛 Found a bug? Report it: https://github.com/caopengau/aiready-pattern-detect/issues\n')
    );
  });

function getPatternIcon(type: PatternType): string {
  const icons: Record<PatternType, string> = {
    'api-handler': '🌐',
    validator: '✓',
    utility: '🔧',
    'class-method': '📦',
    component: '⚛️',
    function: 'ƒ',
    unknown: '❓',
  };
  return icons[type];
}

function generateHTMLReport(
  summary: any,
  results: any[]
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Pattern Detection Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .stat-card { background: #f9f9f9; padding: 20px; border-radius: 6px; border-left: 4px solid #007acc; }
    .stat-value { font-size: 32px; font-weight: bold; color: #007acc; }
    .stat-label { color: #666; font-size: 14px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    .critical { color: #d32f2f; }
    .major { color: #f57c00; }
    .minor { color: #1976d2; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Pattern Detection Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Files Analyzed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.totalPatterns}</div>
        <div class="stat-label">Duplicate Patterns</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.totalTokenCost.toLocaleString()}</div>
        <div class="stat-label">Tokens Wasted</div>
      </div>
    </div>

    <h2>Top Duplicate Patterns</h2>
    <table>
      <thead>
        <tr>
          <th>Similarity</th>
          <th>Type</th>
          <th>Files</th>
          <th>Token Cost</th>
        </tr>
      </thead>
      <tbody>
        ${summary.topDuplicates
          .slice(0, 20)
          .map(
            (dup: any) => `
          <tr>
            <td class="${dup.similarity > 0.95 ? 'critical' : dup.similarity > 0.9 ? 'major' : 'minor'}">${Math.round(dup.similarity * 100)}%</td>
            <td>${dup.patternType}</td>
            <td>${dup.files.map((f: any) => `<code>${f.path}:${f.startLine}-${f.endLine}</code>`).join('<br>↔<br>')}</td>
            <td>${dup.tokenCost.toLocaleString()}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Generated by <strong>@aiready/pattern-detect</strong></p>
    <p>Like AIReady? <a href="https://github.com/caopengau/aiready-pattern-detect">Star us on GitHub</a></p>
    <p>Found a bug? <a href="https://github.com/caopengau/aiready-pattern-detect/issues">Report it here</a></p>
  </div>
</body>
</html>`;
}

program.parse();
