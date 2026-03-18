/**
 * AST Parsing and Export Extraction Types
 */

/**
 * Location information in source code
 */
export interface SourceLocation {
  line: number;
  column: number;
}

/**
 * Range information in source code
 */
export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface ExportWithImports {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  imports: string[]; // Imports used within this export's scope
  dependencies: string[]; // Other exports from same file this depends on
  typeReferences: string[]; // TypeScript types referenced in this export
  loc?: SourceRange;
}

/**
 * Information about a single import declaration
 */
export interface FileImport {
  /** Module being imported from */
  source: string;
  /** What's being imported */
  specifiers: string[];
  /** Is this a type-only import (TypeScript) */
  isTypeOnly?: boolean;
  /** Location in source */
  loc?: SourceRange;
}

export interface ASTNode {
  type: string;
  loc?: SourceRange;
}

/**
 * AI token budget unit economics (v0.13+)
 */
export interface TokenBudget {
  totalContextTokens: number;
  estimatedResponseTokens?: number;
  wastedTokens: {
    total: number;
    bySource: {
      duplication: number;
      fragmentation: number;
      chattiness: number;
    };
  };
  efficiencyRatio: number;
  potentialRetrievableTokens: number;
}
