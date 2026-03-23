/**
 * Represents a block of code extracted from a source file.
 * Used for pattern detection and code analysis.
 */
export interface CodeBlock {
  /** Relative file path */
  file: string;
  /** Starting line number (1-based) */
  startLine: number;
  /** Ending line number (1-based) */
  endLine: number;
  /** The actual code content */
  code: string;
  /** Approximate token count */
  tokens: number;
  /** Type of pattern (e.g., 'function', 'class', 'block') */
  patternType: string;
  /** Optional function/method signature for matching */
  signature?: string;
  /** Optional hash for quick duplicate detection */
  hash?: string;
}
