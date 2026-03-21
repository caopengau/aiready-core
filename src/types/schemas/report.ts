import { z } from 'zod';
import { ToolNameSchema } from '../enums';
import { IssueSchema } from './issue';
import { MetricsSchema } from './metrics';

/**
 * Individual file/module analysis result.
 */
export const AnalysisResultSchema = z.object({
  fileName: z.string(),
  issues: z.array(IssueSchema),
  metrics: MetricsSchema,
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * Standard spoke tool summary schema.
 */
export const SpokeSummarySchema = z
  .object({
    totalFiles: z.number().optional(),
    totalIssues: z.number().optional(),
    criticalIssues: z.number().optional(),
    majorIssues: z.number().optional(),
    score: z.number().optional(),
  })
  .catchall(z.any());

export type SpokeSummary = z.infer<typeof SpokeSummarySchema>;

/**
 * Standard spoke tool output contract.
 */
export const SpokeOutputSchema = z.object({
  results: z.array(AnalysisResultSchema),
  summary: SpokeSummarySchema,
  metadata: z
    .object({
      toolName: z.string(),
      version: z.string().optional(),
      timestamp: z.string().optional(),
      config: z.any().optional(),
    })
    .catchall(z.any())
    .optional(),
});

export type SpokeOutput = z.infer<typeof SpokeOutputSchema>;

/**
 * Master Unified Report contract (CLI -> Platform).
 */
export const UnifiedReportSchema = z
  .object({
    summary: z.object({
      totalFiles: z.number(),
      totalIssues: z.number(),
      criticalIssues: z.number(),
      majorIssues: z.number(),
      businessImpact: z
        .object({
          estimatedMonthlyWaste: z.number().optional(),
          potentialSavings: z.number().optional(),
          productivityHours: z.number().optional(),
        })
        .optional(),
    }),
    results: z.array(AnalysisResultSchema),
    scoring: z
      .object({
        overall: z.number(),
        rating: z.string(),
        timestamp: z.string(),
        breakdown: z.array(
          z
            .object({
              toolName: z.union([ToolNameSchema, z.string()]),
              score: z.number(),
            })
            .catchall(z.any())
        ),
      })
      .optional(),
  })
  .catchall(z.any());

export type UnifiedReport = z.infer<typeof UnifiedReportSchema>;
