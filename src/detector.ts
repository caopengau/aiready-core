import { similarityScore, estimateTokens } from '@aiready/core';

export interface DuplicatePattern {
  file1: string;
  file2: string;
  line1: number;
  line2: number;
  similarity: number;
  snippet: string;
  patternType: PatternType;
  tokenCost: number;
  linesOfCode: number;
}

export type PatternType =
  | 'function'
  | 'class-method'
  | 'api-handler'
  | 'validator'
  | 'utility'
  | 'component'
  | 'unknown';

interface FileContent {
  file: string;
  content: string;
}

interface DetectionOptions {
  minSimilarity: number;
  minLines: number;
  maxBlocks?: number;
  batchSize?: number;
}

interface CodeBlock {
  content: string;
  startLine: number;
  file: string;
  normalized: string;
  patternType: PatternType;
  tokenCost: number;
  linesOfCode: number;
}

/**
 * Categorize code pattern based on content heuristics
 */
function categorizePattern(code: string): PatternType {
  const lower = code.toLowerCase();
  
  // API handler patterns
  if (
    (lower.includes('request') && lower.includes('response')) ||
    lower.includes('router.') ||
    lower.includes('app.get') ||
    lower.includes('app.post') ||
    lower.includes('express') ||
    lower.includes('ctx.body')
  ) {
    return 'api-handler';
  }
  
  // Validator patterns
  if (
    lower.includes('validate') ||
    lower.includes('schema') ||
    lower.includes('zod') ||
    lower.includes('yup') ||
    (lower.includes('if') && lower.includes('throw'))
  ) {
    return 'validator';
  }
  
  // Component patterns (React, Vue, etc.)
  if (
    lower.includes('return (') ||
    lower.includes('jsx') ||
    lower.includes('component') ||
    lower.includes('props')
  ) {
    return 'component';
  }
  
  // Class methods
  if (lower.includes('class ') || lower.includes('this.')) {
    return 'class-method';
  }
  
  // Utility functions (pure functions with clear input/output)
  if (
    lower.includes('return ') &&
    !lower.includes('this') &&
    !lower.includes('new ')
  ) {
    return 'utility';
  }
  
  // Generic function
  if (lower.includes('function') || lower.includes('=>')) {
    return 'function';
  }
  
  return 'unknown';
}

/**
 * Extract function-like blocks from code using improved heuristics
 */
function extractCodeBlocks(content: string, minLines: number): Array<{
  content: string;
  startLine: number;
  patternType: PatternType;
  linesOfCode: number;
}> {
  const lines = content.split('\n');
  const blocks: Array<{
    content: string;
    startLine: number;
    patternType: PatternType;
    linesOfCode: number;
  }> = [];
  
  let currentBlock: string[] = [];
  let blockStart = 0;
  let braceDepth = 0;
  let inFunction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect function start
    if (
      !inFunction &&
      (trimmed.includes('function ') ||
        trimmed.includes('=>') ||
        trimmed.includes('async ') ||
        /^(export\s+)?(async\s+)?function\s+/.test(trimmed) ||
        /^(export\s+)?const\s+\w+\s*=\s*(async\s*)?\(/.test(trimmed))
    ) {
      inFunction = true;
      blockStart = i;
    }
    
    // Track brace depth
    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    if (inFunction) {
      currentBlock.push(line);
    }

    // When we close a function block
    if (inFunction && braceDepth === 0 && currentBlock.length >= minLines) {
      const blockContent = currentBlock.join('\n');
      const linesOfCode = currentBlock.filter(
        (l) => l.trim() && !l.trim().startsWith('//')
      ).length;
      
      blocks.push({
        content: blockContent,
        startLine: blockStart + 1,
        patternType: categorizePattern(blockContent),
        linesOfCode,
      });
      
      currentBlock = [];
      inFunction = false;
    } else if (inFunction && braceDepth === 0) {
      // Reset if we're not accumulating enough
      currentBlock = [];
      inFunction = false;
    }
  }

  return blocks;
}

/**
 * Normalize code for comparison
 * - Remove comments
 * - Normalize whitespace
 * - Remove variable names (replace with placeholders)
 * - Keep structure intact
 */
function normalizeCode(code: string): string {
  return (
    code
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize string literals to generic placeholder
      .replace(/"[^"]*"/g, '"STR"')
      .replace(/'[^']*'/g, "'STR'")
      .replace(/`[^`]*`/g, '`STR`')
      // Normalize numbers
      .replace(/\b\d+\b/g, 'NUM')
      // Normalize whitespace but keep structure
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Calculate structural similarity between two code blocks
 * Uses multiple similarity metrics for better accuracy
 */
function calculateSimilarity(block1: string, block2: string): number {
  const norm1 = normalizeCode(block1);
  const norm2 = normalizeCode(block2);
  
  // Basic Levenshtein similarity
  const baseSimilarity = similarityScore(norm1, norm2);
  
  // Token-based similarity (split by keywords/operators)
  const tokens1 = norm1.split(/[\s(){}[\];,]+/).filter(Boolean);
  const tokens2 = norm2.split(/[\s(){}[\];,]+/).filter(Boolean);
  const tokenSimilarity = similarityScore(tokens1.join(' '), tokens2.join(' '));
  
  // Weighted average favoring token similarity
  return baseSimilarity * 0.4 + tokenSimilarity * 0.6;
}

/**
 * Detect duplicate patterns across files with enhanced analysis
 */
export async function detectDuplicatePatterns(
  files: FileContent[],
  options: DetectionOptions
): Promise<DuplicatePattern[]> {
  const { minSimilarity, minLines, maxBlocks = 500, batchSize = 100 } = options;
  const duplicates: DuplicatePattern[] = [];

  // Extract blocks from all files
  let allBlocks: CodeBlock[] = files.flatMap((file) =>
    extractCodeBlocks(file.content, minLines).map((block) => ({
      ...block,
      file: file.file,
      normalized: normalizeCode(block.content),
      tokenCost: estimateTokens(block.content),
    }))
  );

  console.log(`Extracted ${allBlocks.length} code blocks for analysis`);

  // Limit blocks to prevent OOM
  if (allBlocks.length > maxBlocks) {
    console.log(`⚠️  Limiting to ${maxBlocks} blocks (sorted by size) to prevent memory issues`);
    console.log(`   Use --max-blocks to increase limit or --min-lines to filter smaller blocks`);
    allBlocks = allBlocks
      .sort((a, b) => b.linesOfCode - a.linesOfCode)
      .slice(0, maxBlocks);
  }

  // Process in batches to reduce memory pressure
  const totalComparisons = (allBlocks.length * (allBlocks.length - 1)) / 2;
  console.log(`Processing ${totalComparisons.toLocaleString()} comparisons in batches...`);

  let comparisonsProcessed = 0;
  const startTime = Date.now();

  // Compare all pairs of blocks
  for (let i = 0; i < allBlocks.length; i++) {
    // Progress reporting every batch
    if (i % batchSize === 0 && i > 0) {
      const progress = (comparisonsProcessed / totalComparisons * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ${progress}% complete (${comparisonsProcessed.toLocaleString()}/${totalComparisons.toLocaleString()} comparisons, ${elapsed}s elapsed)`);
      
      // Allow garbage collection between batches
      await new Promise(resolve => setImmediate(resolve));
    }

    for (let j = i + 1; j < allBlocks.length; j++) {
      comparisonsProcessed++;
      const block1 = allBlocks[i];
      const block2 = allBlocks[j];

      // Skip comparing blocks from the same file
      if (block1.file === block2.file) continue;

      // Skip if patterns are different types (optional optimization)
      // Comment out if you want cross-type comparisons
      // if (block1.patternType !== block2.patternType && 
      //     block1.patternType !== 'unknown' && 
      //     block2.patternType !== 'unknown') continue;

      const similarity = calculateSimilarity(block1.content, block2.content);

      if (similarity >= minSimilarity) {
        duplicates.push({
          file1: block1.file,
          file2: block2.file,
          line1: block1.startLine,
          line2: block2.startLine,
          similarity,
          snippet: block1.content.split('\n').slice(0, 5).join('\n') + '\n...',
          patternType: block1.patternType,
          tokenCost: block1.tokenCost + block2.tokenCost,
          linesOfCode: block1.linesOfCode,
        });
      }
    }
  }

  // Sort by similarity descending, then by token cost
  return duplicates.sort(
    (a, b) => b.similarity - a.similarity || b.tokenCost - a.tokenCost
  );
}
