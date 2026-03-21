/**
 * Shared rating helper functions for scoring and display.
 * Extracted to eliminate duplication between scoring.ts and CLI output modules.
 */

/**
 * AI Readiness Rating categories.
 * Provides a high-level qualitative assessment based on the numeric score.
 */
export enum ReadinessRating {
  Excellent = 'Excellent',
  Good = 'Good',
  Fair = 'Fair',
  NeedsWork = 'Needs Work',
  Critical = 'Critical',
}

/**
 * Get rating label from score
 * @param score The numerical AI readiness score (0-100)
 * @returns Human-readable rating label
 */
export function getRatingLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Critical';
}

/**
 * Get rating slug from score (URL-friendly)
 * @param score The numerical score
 * @returns A kebab-case string (e.g., 'excellent', 'needs-work')
 */
export function getRatingSlug(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'needs-work';
  return 'critical';
}

/**
 * Get rating emoji from score
 * @param score The numerical score
 * @returns Emoji string for display
 */
export function getRatingEmoji(score: number): string {
  if (score >= 90) return '✅';
  if (score >= 75) return '👍';
  if (score >= 60) return '👌';
  if (score >= 40) return '🔨';
  return '🚨';
}

/**
 * Get tool emoji from score (alias for getRatingEmoji)
 * @param score The numerical score
 * @returns Emoji string for display
 */
export function getToolEmoji(score: number): string {
  return getRatingEmoji(score);
}

/**
 * Get priority icon from priority level
 * @param priority Priority level string
 * @returns Emoji string for display
 */
export function getPriorityIcon(priority: string): string {
  switch (priority) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🔵';
    default:
      return '⚪';
  }
}

/**
 * Convert numeric score to ReadinessRating enum
 * @param score The numerical AI readiness score (0-100)
 * @returns The corresponding ReadinessRating category
 */
export function getRating(score: number): ReadinessRating {
  if (score >= 90) return ReadinessRating.Excellent;
  if (score >= 75) return ReadinessRating.Good;
  if (score >= 60) return ReadinessRating.Fair;
  if (score >= 40) return ReadinessRating.NeedsWork;
  return ReadinessRating.Critical;
}
