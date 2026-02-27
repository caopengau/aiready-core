/**
 * Client-safe exports from @aiready/core
 *
 * This module exports only the functions and types that are safe to use
 * in browser/client environments. It excludes Node.js-specific modules
 * like config loading, file scanning, and AST parsing.
 *
 * Use this entry point for:
 * - React components
 * - Browser bundles
 * - Client-side code
 */

// Types - safe for client
export * from './types';
export * from './types/language';

// Scoring - pure functions, no Node.js dependencies
export * from './scoring';

// Visualization helpers - pure functions
export * from './utils/visualization';
