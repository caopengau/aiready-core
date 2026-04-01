import { describe, it, expect } from 'vitest';
import {
  getRatingMetadata,
  getRatingLabel,
  getRatingSlug,
  getRatingEmoji,
  getToolEmoji,
  getPriorityIcon,
  getRating,
  ReadinessRating,
} from '../utils/rating-helpers';

describe('Rating Helpers', () => {
  describe('getRatingMetadata', () => {
    it('should return Excellent for score >= 90', () => {
      const meta = getRatingMetadata(95);
      expect(meta.label).toBe('Excellent');
      expect(meta.rating).toBe(ReadinessRating.Excellent);
      expect(meta.slug).toBe('excellent');
      expect(meta.emoji).toBe('✅');
    });

    it('should return Good for score >= 75', () => {
      const meta = getRatingMetadata(80);
      expect(meta.label).toBe('Good');
      expect(meta.rating).toBe(ReadinessRating.Good);
      expect(meta.slug).toBe('good');
    });

    it('should return Fair for score >= 60', () => {
      const meta = getRatingMetadata(65);
      expect(meta.label).toBe('Fair');
      expect(meta.rating).toBe(ReadinessRating.Fair);
    });

    it('should return Needs Work for score >= 40', () => {
      const meta = getRatingMetadata(45);
      expect(meta.label).toBe('Needs Work');
      expect(meta.rating).toBe(ReadinessRating.NeedsWork);
    });

    it('should return Critical for score < 40', () => {
      const meta = getRatingMetadata(30);
      expect(meta.label).toBe('Critical');
      expect(meta.rating).toBe(ReadinessRating.Critical);
    });
  });

  describe('individual getter functions', () => {
    it('getRatingLabel should return correct label', () => {
      expect(getRatingLabel(95)).toBe('Excellent');
      expect(getRatingLabel(30)).toBe('Critical');
    });

    it('getRatingSlug should return correct slug', () => {
      expect(getRatingSlug(95)).toBe('excellent');
      expect(getRatingSlug(45)).toBe('needs-work');
    });

    it('getRatingEmoji should return correct emoji', () => {
      expect(getRatingEmoji(95)).toBe('✅');
      expect(getRatingEmoji(30)).toBe('🚨');
    });

    it('getToolEmoji should be alias for getRatingEmoji', () => {
      expect(getToolEmoji(95)).toBe('✅');
    });

    it('getRating should return correct ReadinessRating', () => {
      expect(getRating(95)).toBe(ReadinessRating.Excellent);
    });
  });

  describe('getPriorityIcon', () => {
    it('should return correct emojis for priority levels', () => {
      expect(getPriorityIcon('critical')).toBe('🔴');
      expect(getPriorityIcon('high')).toBe('🟠');
      expect(getPriorityIcon('medium')).toBe('🟡');
      expect(getPriorityIcon('low')).toBe('🔵');
      expect(getPriorityIcon('unknown')).toBe('⚪');
    });
  });
});
