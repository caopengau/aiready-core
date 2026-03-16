import { describe, it, expect } from 'vitest';
import {
  LeadSchema,
  LeadSubmissionSchema,
  LeadSource,
  ManagedAccountSchema,
} from '../types/business';

describe('Business Lead Schemas', () => {
  describe('LeadSource', () => {
    it('should have the correct source identifiers', () => {
      expect(LeadSource.ClawMoreHero).toBe('clawmore-hero');
      expect(LeadSource.ClawMoreWaitlist).toBe('clawmore-waitlist');
      expect(LeadSource.ClawMoreBeta).toBe('clawmore-beta');
      expect(LeadSource.AiReadyPlatform).toBe('aiready-platform');
    });
  });

  describe('LeadSubmissionSchema', () => {
    it('should validate valid lead submissions', () => {
      const validLead = {
        email: 'test@example.com',
        name: 'Test User',
        interest: 'BETA',
        source: LeadSource.ClawMoreBeta,
        notes: 'Testing notes',
      };

      const result = LeadSubmissionSchema.safeParse(validLead);
      expect(result.success).toBe(true);
    });

    it('should require a valid email', () => {
      const invalidLead = {
        email: 'not-an-email',
        name: 'Test User',
        interest: 'BETA',
        source: LeadSource.ClawMoreBeta,
      };

      const result = LeadSubmissionSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email');
      }
    });

    it('should require a name', () => {
      const invalidLead = {
        email: 'test@example.com',
        interest: 'BETA',
        source: LeadSource.ClawMoreBeta,
      };

      const result = LeadSubmissionSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });
  });

  describe('LeadSchema', () => {
    it('should validate full lead objects with defaults', () => {
      const fullLead = {
        id: 'lead_123',
        email: 'test@example.com',
        name: 'Test User',
        timestamp: new Date().toISOString(),
        source: LeadSource.ClawMoreHero,
      };

      const result = LeadSchema.safeParse(fullLead);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('new');
        expect(result.data.interest).toBe('General');
      }
    });
  });

  describe('ManagedAccountSchema', () => {
    it('should validate valid managed accounts with correct defaults', () => {
      const validAccount = {
        id: 'acc_123',
        accountId: '123456789012',
        userId: 'user_456',
        stripeSubscriptionId: 'sub_789',
      };

      const result = ManagedAccountSchema.safeParse(validAccount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.baseFeeCents).toBe(2900);
        expect(result.data.includedComputeCents).toBe(1500);
        expect(result.data.status).toBe('provisioning');
        expect(result.data.region).toBe('ap-southeast-2');
      }
    });

    it('should allow overriding defaults', () => {
      const customAccount = {
        id: 'acc_123',
        accountId: '123456789012',
        userId: 'user_456',
        stripeSubscriptionId: 'sub_789',
        includedComputeCents: 5000,
        status: 'active',
      };

      const result = ManagedAccountSchema.safeParse(customAccount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includedComputeCents).toBe(5000);
        expect(result.data.status).toBe('active');
      }
    });
  });
});
