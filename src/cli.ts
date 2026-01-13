#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeUnified, generateUnifiedSummary } from './index';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadMergedConfig, handleJSONOutput, handleCLIError, getElapsedTime } from '@aiready/core';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('aiready')
  .description('AIReady - Unified AI-readiness analysis tools')
  .version(packageJson.version)
  .addHelpText('after', '\nCONFIGURATION:\n  Supports config files: aiready.json, aiready.config.json, .aiready.json, .aireadyrc.json, aiready.config.js, .aireadyrc.js\n  CLI options override config file settings');

program
  .command('scan')
  .description('Run unified analysis on a codebase')
  .argument('<directory>', 'Directory to analyze')
  .option('-t, --tools <tools>', 'Tools to run (comma-separated: patterns,context)', 'patterns,context')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🚀 Starting AIReady unified analysis...\n'));

    const startTime = Date.now();

    try {
      // Define defaults
      const defaults = {
        tools: ['patterns', 'context'],
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Load and merge config with CLI options
      const baseOptions = loadMergedConfig(directory, defaults, {
        tools: options.tools ? options.tools.split(',').map((t: string) => t.trim()) as ('patterns' | 'context')[] : undefined,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      }) as any;

      // Apply smart defaults for pattern detection if patterns tool is enabled
      let finalOptions = { ...baseOptions };
      if (baseOptions.tools.includes('patterns')) {
        const { getSmartDefaults } = await import('@aiready/pattern-detect');
        const patternSmartDefaults = await getSmartDefaults(directory, baseOptions);
        finalOptions = { ...patternSmartDefaults, ...finalOptions };
      }

      const results = await analyzeUnified(finalOptions);

      const elapsedTime = getElapsedTime(startTime);

      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const outputFile = options.outputFile || finalOptions.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          ...results,
          summary: {
            ...results.summary,
            executionTime: parseFloat(elapsedTime),
          },
        };

        handleJSONOutput(outputData, outputFile, `✅ Results saved to ${outputFile}`);
      } else {
        // Console output
        console.log(generateUnifiedSummary(results));
      }
    } catch (error) {
      handleCLIError(error, 'Analysis');
    }
  });

// Individual tool commands for convenience
program
  .command('patterns')
  .description('Run pattern detection analysis')
  .argument('<directory>', 'Directory to analyze')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1)', '0.40')
  .option('-l, --min-lines <number>', 'Minimum lines to consider', '5')
  .option('--max-candidates <number>', 'Maximum candidates per block (performance tuning)')
  .option('--min-shared-tokens <number>', 'Minimum shared tokens for candidates (performance tuning)')
  .option('--full-scan', 'Disable smart defaults for comprehensive analysis (slower)')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();

    try {
      // Determine if smart defaults should be used
      const useSmartDefaults = !options.fullScan;

      // Define defaults (only for options not handled by smart defaults)
      const defaults = {
        useSmartDefaults,
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Set fallback defaults only if smart defaults are disabled
      if (!useSmartDefaults) {
        (defaults as any).minSimilarity = 0.4;
        (defaults as any).minLines = 5;
      }

      // Load and merge config with CLI options
      const cliOptions: any = {
        minSimilarity: options.similarity ? parseFloat(options.similarity) : undefined,
        minLines: options.minLines ? parseInt(options.minLines) : undefined,
        useSmartDefaults,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      };

      // Only include performance tuning options if explicitly specified
      if (options.maxCandidates) {
        cliOptions.maxCandidatesPerBlock = parseInt(options.maxCandidates);
      }
      if (options.minSharedTokens) {
        cliOptions.minSharedTokens = parseInt(options.minSharedTokens);
      }

      const finalOptions = loadMergedConfig(directory, defaults, cliOptions);

      const { analyzePatterns, generateSummary } = await import('@aiready/pattern-detect');

      const { results } = await analyzePatterns(finalOptions);

      const elapsedTime = getElapsedTime(startTime);
      const summary = generateSummary(results);

      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const outputFile = options.outputFile || finalOptions.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        };

        handleJSONOutput(outputData, outputFile, `✅ Results saved to ${outputFile}`);
      } else {
        console.log(`Pattern Analysis Complete (${elapsedTime}s)`);
        console.log(`Found ${summary.totalPatterns} duplicate patterns`);
        console.log(`Total token cost: ${summary.totalTokenCost} tokens`);
      }
    } catch (error) {
      handleCLIError(error, 'Pattern analysis');
    }
  });

program
  .command('context')
  .description('Run context window cost analysis')
  .argument('<directory>', 'Directory to analyze')
  .option('--max-depth <number>', 'Maximum acceptable import depth', '5')
  .option('--max-context <number>', 'Maximum acceptable context budget (tokens)', '10000')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🧠 Analyzing context costs...\n'));

    const startTime = Date.now();

    try {
      // Define defaults
      const defaults = {
        maxDepth: 5,
        maxContextBudget: 10000,
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Load and merge config with CLI options
      const finalOptions = loadMergedConfig(directory, defaults, {
        maxDepth: options.maxDepth ? parseInt(options.maxDepth) : undefined,
        maxContextBudget: options.maxContext ? parseInt(options.maxContext) : undefined,
        include: options.include?.split(','),
        exclude: options.exclude?.split(','),
      });

      const { analyzeContext, generateSummary } = await import('@aiready/context-analyzer');

      const results = await analyzeContext(finalOptions);

      const elapsedTime = getElapsedTime(startTime);
      const summary = generateSummary(results);

      const outputFormat = options.output || finalOptions.output?.format || 'console';
      const outputFile = options.outputFile || finalOptions.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        };

        handleJSONOutput(outputData, outputFile, `✅ Results saved to ${outputFile}`);
      } else {
        console.log(`Context Analysis Complete (${elapsedTime}s)`);
        console.log(`Files analyzed: ${summary.totalFiles}`);
        console.log(`Issues found: ${results.length}`);
        console.log(`Average cohesion: ${(summary.avgCohesion * 100).toFixed(1)}%`);
        console.log(`Average fragmentation: ${(summary.avgFragmentation * 100).toFixed(1)}%`);
      }
    } catch (error) {
      handleCLIError(error, 'Context analysis');
    }
  });

program.parse();