import { z } from 'zod';

/**
 * Global AIReady Configuration Schema.
 * Strict definition for aiready.json and related config files.
 */
export const AIReadyConfigSchema = z
  .object({
    /** Target score threshold (0-100) */
    threshold: z.number().optional(),
    /** Files or directories to include in scan */
    include: z.array(z.string()).optional(),
    /** Files or directories to exclude from scan */
    exclude: z.array(z.string()).optional(),
    /** Scan-specific configuration */
    scan: z
      .object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
        parallel: z.boolean().optional(),
        deep: z.boolean().optional(),
        tools: z.array(z.string()).optional(),
      })
      .optional(),
    /** Output-specific configuration */
    output: z
      .object({
        /** Output format (json, console, html) */
        format: z.enum(['json', 'console', 'html']).optional(),
        /** Output file path */
        path: z.string().optional(),
        /** Output directory */
        saveTo: z.string().optional(),
        /** Whether to show score breakdown in console */
        showBreakdown: z.boolean().optional(),
        /** Baseline report to compare against */
        compareBaseline: z.string().optional(),
      })
      .optional(),
    /** Tool-specific configuration overrides (Strictly ToolName -> Config) */
    tools: z.record(z.string(), z.any()).optional(),
    /** Scoring profile and weights */
    scoring: z
      .object({
        /** Name of the scoring profile (e.g. "strict", "balanced") */
        profile: z.string().optional(),
        /** Custom weights for tools and metrics */
        weights: z.record(z.string(), z.number()).optional(),
      })
      .optional(),
    /** Visualizer settings (interactive graph) */
    visualizer: z
      .object({
        groupingDirs: z.array(z.string()).optional(),
        graph: z
          .object({
            maxNodes: z.number().optional(),
            maxEdges: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .catchall(z.any());
