import { z } from 'zod';

/**
 * Common tool options
 */
export interface ToolOptions {
  /** Root directory of the project */
  rootDir: string;
  /** Files to include in this tool's analysis */
  include?: string[];
  /** Files to exclude from this tool's analysis */
  exclude?: string[];
  /** Tool-specific configuration values */
  config?: any;
  /** Any other dynamic options */
  [key: string]: any;
}

/**
 * Source code location schema.
 */
/** Zod schema for Location object */
export const LocationSchema = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number().optional(),
  endLine: z.number().optional(),
  endColumn: z.number().optional(),
});

export type Location = z.infer<typeof LocationSchema>;
