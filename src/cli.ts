#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeUnified, generateUnifiedSummary } from './index';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadConfig, mergeConfigWithDefaults } from '@aiready/core';

const program = new Command();

program
  .name('aiready')
  .description('AIReady - Unified AI-readiness analysis tools')
  .version('0.1.0');

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
      // Load config file if it exists
      const config = loadConfig(directory);

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

      // Merge config with defaults
      const mergedConfig = mergeConfigWithDefaults(config, defaults);

      // Override with CLI options (CLI takes precedence)
      const finalOptions = {
        rootDir: directory,
        tools: options.tools ? options.tools.split(',').map((t: string) => t.trim()) as ('patterns' | 'context')[] : mergedConfig.tools,
        include: options.include?.split(',') || mergedConfig.include,
        exclude: options.exclude?.split(',') || mergedConfig.exclude,
      };

      const results = await analyzeUnified(finalOptions);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

      const outputFormat = options.output || mergedConfig.output?.format || 'console';
      const outputFile = options.outputFile || mergedConfig.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          ...results,
          summary: {
            ...results.summary,
            executionTime: parseFloat(elapsedTime),
          },
        };

        if (outputFile) {
          writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
          console.log(chalk.green(`✅ Results saved to ${outputFile}`));
        } else {
          console.log(JSON.stringify(outputData, null, 2));
        }
      } else {
        // Console output
        console.log(generateUnifiedSummary(results));
      }
    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
      process.exit(1);
    }
  });

// Individual tool commands for convenience
program
  .command('patterns')
  .description('Run pattern detection analysis')
  .argument('<directory>', 'Directory to analyze')
  .option('-s, --similarity <number>', 'Minimum similarity score (0-1)', '0.40')
  .option('-l, --min-lines <number>', 'Minimum lines to consider', '5')
  .option('--include <patterns>', 'File patterns to include (comma-separated)')
  .option('--exclude <patterns>', 'File patterns to exclude (comma-separated)')
  .option('-o, --output <format>', 'Output format: console, json', 'console')
  .option('--output-file <path>', 'Output file path (for json)')
  .action(async (directory, options) => {
    console.log(chalk.blue('🔍 Analyzing patterns...\n'));

    const startTime = Date.now();

    try {
      // Load config file if it exists
      const config = loadConfig(directory);

      // Define defaults
      const defaults = {
        minSimilarity: 0.4,
        minLines: 5,
        include: undefined,
        exclude: undefined,
        output: {
          format: 'console',
          file: undefined,
        },
      };

      // Merge config with defaults
      const mergedConfig = mergeConfigWithDefaults(config, defaults);

      // Override with CLI options (CLI takes precedence)
      const finalOptions = {
        rootDir: directory,
        minSimilarity: options.similarity ? parseFloat(options.similarity) : mergedConfig.minSimilarity,
        minLines: options.minLines ? parseInt(options.minLines) : mergedConfig.minLines,
        include: options.include?.split(',') || mergedConfig.include,
        exclude: options.exclude?.split(',') || mergedConfig.exclude,
      };

      const { analyzePatterns, generateSummary } = await import('@aiready/pattern-detect');

      const results = await analyzePatterns(finalOptions);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const summary = generateSummary(results);

      const outputFormat = options.output || mergedConfig.output?.format || 'console';
      const outputFile = options.outputFile || mergedConfig.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        };

        if (outputFile) {
          writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
          console.log(chalk.green(`✅ Results saved to ${outputFile}`));
        } else {
          console.log(JSON.stringify(outputData, null, 2));
        }
      } else {
        console.log(`Pattern Analysis Complete (${elapsedTime}s)`);
        console.log(`Found ${summary.totalPatterns} duplicate patterns`);
        console.log(`Total token cost: ${summary.totalTokenCost} tokens`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Pattern analysis failed:'), error);
      process.exit(1);
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
      // Load config file if it exists
      const config = loadConfig(directory);

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

      // Merge config with defaults
      const mergedConfig = mergeConfigWithDefaults(config, defaults);

      // Override with CLI options (CLI takes precedence)
      const finalOptions = {
        rootDir: directory,
        maxDepth: options.maxDepth ? parseInt(options.maxDepth) : mergedConfig.maxDepth,
        maxContextBudget: options.maxContext ? parseInt(options.maxContext) : mergedConfig.maxContextBudget,
        include: options.include?.split(',') || mergedConfig.include,
        exclude: options.exclude?.split(',') || mergedConfig.exclude,
      };

      const { analyzeContext, generateSummary } = await import('@aiready/context-analyzer');

      const results = await analyzeContext(finalOptions);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const summary = generateSummary(results);

      const outputFormat = options.output || mergedConfig.output?.format || 'console';
      const outputFile = options.outputFile || mergedConfig.output?.file;

      if (outputFormat === 'json') {
        const outputData = {
          results,
          summary: { ...summary, executionTime: parseFloat(elapsedTime) },
        };

        if (outputFile) {
          writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
          console.log(chalk.green(`✅ Results saved to ${outputFile}`));
        } else {
          console.log(JSON.stringify(outputData, null, 2));
        }
      } else {
        console.log(`Context Analysis Complete (${elapsedTime}s)`);
        console.log(`Files analyzed: ${summary.totalFiles}`);
        console.log(`Issues found: ${results.length}`);
        console.log(`Average cohesion: ${(summary.avgCohesion * 100).toFixed(1)}%`);
        console.log(`Average fragmentation: ${(summary.avgFragmentation * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Context analysis failed:'), error);
      process.exit(1);
    }
  });

program.parse();