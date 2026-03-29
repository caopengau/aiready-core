/**
 * Spoke-to-Hub Contract Definitions
 * This file defines the expected JSON structure for tool outputs to ensure
 * changes in spokes don't break the CLI, Platform, or Visualizer.
 */

import { z } from 'zod';
import { ScanOptions } from './common';
import { ToolName } from './enums';
import {
  SpokeOutput,
  UnifiedReport,
  SpokeOutputSchema,
} from './schemas/report';
import { ToolScoringOutput } from '../scoring';
import { normalizeSpokeOutput } from '../utils/normalization';

export type { SpokeOutput, UnifiedReport };

/**
 * Tool Provider Interface
 * Every AIReady spoke must implement this interface to be integrated into the CLI registry.
 */
export interface ToolProvider {
  /** Canonical tool ID */
  id: ToolName;

  /** CLI aliases/shorthand for this tool */
  alias: string[];

  /** Primary analysis logic */
  analyze: (options: ScanOptions) => Promise<SpokeOutput>;

  /** Scoring logic for this tool's output */
  score: (output: SpokeOutput, options: ScanOptions) => ToolScoringOutput;

  /** Optional weight override for this tool */
  defaultWeight?: number;
}

/**
 * Validation utility to ensure a spoke's output matches the expected contract.
 * Used in spoke tests to catch breakages early.
 *
 * @param toolName - Name of the tool being validated.
 * @param output - The raw output data to check.
 * @returns Validation result with boolean flag and any errors found.
 */
export function validateSpokeOutput(
  toolName: string,
  output: unknown
): { valid: boolean; errors: string[] } {
  if (!output) {
    return { valid: false, errors: ['Output is null or undefined'] };
  }

  // Contract strictly requires the spoke to provide a summary
  if (!(output as Record<string, unknown>).summary) {
    return { valid: false, errors: [`${toolName}: missing 'summary'`] };
  }

  // Normalize loose aliases before schema validation
  const normalized = normalizeSpokeOutput(output, toolName);

  // Validate against canonical contract
  const result = SpokeOutputSchema.safeParse(normalized);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map(
      (e) => `${toolName}: ${e.path.join('.')}: ${e.message}`
    ),
  };
}

/**
 * Zod-based validation (Round 1 improvement).
 *
 * @param schema - Zod schema to validate against.
 * @param data - Raw data to parse.
 * @returns Result object with valid flag and typed data or errors.
 * @lastUpdated 2026-03-18
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { valid: boolean; data?: T; errors?: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
