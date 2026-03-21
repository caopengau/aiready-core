import { z } from 'zod';
import { ModelTierSchema } from '../enums';

/**
 * Standard Metrics schema.
 */
/** Zod schema for Metrics object */
export const MetricsSchema = z.object({
  tokenCost: z.number().optional(),
  complexityScore: z.number().optional(),
  consistencyScore: z.number().optional(),
  docFreshnessScore: z.number().optional(),

  // AI agent readiness metrics (v0.12+)
  aiSignalClarityScore: z.number().optional(),
  agentGroundingScore: z.number().optional(),
  testabilityScore: z.number().optional(),
  docDriftScore: z.number().optional(),
  dependencyHealthScore: z.number().optional(),
  modelContextTier: ModelTierSchema.optional(),

  // Business value metrics
  estimatedMonthlyCost: z.number().optional(),
  estimatedDeveloperHours: z.number().optional(),
  comprehensionDifficultyIndex: z.number().optional(),

  // Extended metrics for specific spokes
  totalSymbols: z.number().optional(),
  totalExports: z.number().optional(),
});

export type Metrics = z.infer<typeof MetricsSchema>;
