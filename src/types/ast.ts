/**
 * AST Parsing and Export Extraction Types
 */

export interface ExportWithImports {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  imports: string[]; // Imports used within this export's scope
  dependencies: string[]; // Other exports from same file this depends on
  typeReferences: string[]; // TypeScript types referenced in this export
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface FileImport {
  source: string; // Module being imported from
  specifiers: string[]; // What's being imported
  isTypeOnly: boolean;
}

export interface ASTNode {
  type: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
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
