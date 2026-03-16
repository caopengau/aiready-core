import { z } from 'zod';

/**
 * Lead Source identifiers.
 */
export enum LeadSource {
  ClawMoreHero = 'clawmore-hero',
  ClawMoreWaitlist = 'clawmore-waitlist',
  ClawMoreBeta = 'clawmore-beta',
  AiReadyPlatform = 'aiready-platform',
}

/** Zod schema for LeadSource enum */
export const LeadSourceSchema = z.nativeEnum(LeadSource);

/**
 * Business Lead schema for waitlists and beta signups.
 */
export const LeadSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  interest: z.string().default('General'),
  notes: z.string().optional(),
  timestamp: z.string().datetime(),
  source: LeadSourceSchema,
  status: z
    .enum(['new', 'contacted', 'qualified', 'converted', 'archived'])
    .default('new'),
});

export type Lead = z.infer<typeof LeadSchema>;

/**
 * Lead Submission (input from form)
 */
export const LeadSubmissionSchema = LeadSchema.omit({
  id: true,
  timestamp: true,
  status: true,
});

export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>;

/**
 * Managed AWS Account metadata for the Account Vending Machine.
 */
export const ManagedAccountSchema = z.object({
  id: z.string(), // Internal UUID
  accountId: z.string(), // AWS Account ID
  userId: z.string(), // Owner (caopengau@gmail.com)
  stripeSubscriptionId: z.string(),

  // AI Token Management
  tokenStrategy: z.enum(['managed', 'byok']).default('managed'),
  byokConfig: z
    .object({
      openaiKey: z.string().optional(),
      anthropicKey: z.string().optional(),
      openrouterKey: z.string().optional(),
    })
    .optional(),

  // Financials (in cents)
  baseFeeCents: z.number().default(2900),
  includedComputeCents: z.number().default(1500), // $15.00 AWS included
  includedTokenCents: z.number().default(500), // $5.00 Managed Tokens included

  // Pre-paid Balance (credits)
  prepaidTokenBalanceCents: z.number().default(0), // Users buy these in $10 packs
  currentMonthlyTokenSpendCents: z.number().default(0),

  // Governance
  status: z
    .enum(['provisioning', 'active', 'warning', 'quarantined', 'suspended'])
    .default('provisioning'),
  lastCostSyncAt: z.string().datetime().optional(),
  region: z.string().default('ap-southeast-2'),

  // Alerting thresholds (percentage of includedComputeCents)
  alertThresholds: z.array(z.number()).default([50, 80, 100, 150]),
});

export type ManagedAccount = z.infer<typeof ManagedAccountSchema>;
