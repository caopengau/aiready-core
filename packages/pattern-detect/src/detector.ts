import {
  estimateTokens,
  Severity,
  calculateStringSimilarity,
  calculateHeuristicConfidence,
} from '@aiready/core';
import { calculateSeverity } from './context-rules';
import type {
  DuplicatePattern,
  PatternType,
  FileContent,
  DetectionOptions,
  CodeBlock,
} from './core/types';

export type { PatternType, DuplicatePattern };

import { normalizeCode } from './core/normalizer';

/**
 * Split file content into logical blocks (functions, classes, methods)
 *
 * @param file - File path or identifier.
 * @param content - Full file source content.
 * @returns Array of logical code blocks extracted from the content.
 */
function extractBlocks(file: string, content: string): CodeBlock[] {
  const isPython = file.toLowerCase().endsWith('.py');
  if (isPython) {
    return extractBlocksPython(file, content);
  }

  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');

  // Regex to match declarations (TS/JS, Java, C# and Go)
  const blockRegex =
    /^\s*(?:export\s+)?(?:async\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|static\s+|readonly\s+|virtual\s+|abstract\s+|override\s+)*(function|class|interface|type|enum|record|struct|void|func|[a-zA-Z0-9_<>[]]+)\s+([a-zA-Z0-9_]+)(?:\s*\(|(?:\s+extends|\s+implements|\s+where)?\s*\{)|^\s*(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*[a-zA-Z0-9_.]+\.object\(|^\s*(app\.(?:get|post|put|delete|patch|use))\(/gm;

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const startLine = content.substring(0, match.index).split('\n').length;

    let type: string;
    let name: string;

    if (match[1]) {
      type = match[1];
      name = match[2];
    } else if (match[3]) {
      type = 'const';
      name = match[3];
    } else {
      type = 'handler';
      name = match[4];
    }

    // Find end of block (matching braces heuristic)
    let endLine = -1;
    let openBraces = 0;
    let foundStart = false;

    for (let i = match.index; i < content.length; i++) {
      if (content[i] === '{') {
        openBraces++;
        foundStart = true;
      } else if (content[i] === '}') {
        openBraces--;
      }

      if (foundStart && openBraces === 0) {
        endLine = content.substring(0, i + 1).split('\n').length;
        break;
      }
    }

    if (endLine === -1) {
      // Fallback: look for end of line
      const remaining = content.slice(match.index);
      const nextLineMatch = remaining.indexOf('\n');
      if (nextLineMatch !== -1) {
        endLine = startLine;
      } else {
        endLine = lines.length;
      }
    }

    // Ensure at least 1 line
    endLine = Math.max(startLine, endLine);

    const blockCode = lines.slice(startLine - 1, endLine).join('\n');
    const tokens = estimateTokens(blockCode);

    blocks.push({
      file,
      startLine,
      endLine,
      code: blockCode,
      tokens,
      patternType: inferPatternType(type, name),
    });
  }

  return blocks;
}

/**
 * Python-specific block extraction based on indentation
 *
 * @param file - File path or identifier.
 * @param content - Full file source content.
 * @returns Array of logical code blocks extracted from Python source.
 */
function extractBlocksPython(file: string, content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');

  // Python block regex: def, class, async def
  const blockRegex = /^\s*(?:async\s+)?(def|class)\s+([a-zA-Z0-9_]+)/gm;

  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const startLinePos = content.substring(0, match.index).split('\n').length;
    const startLineIdx = startLinePos - 1;
    const initialIndent = lines[startLineIdx].search(/\S/);

    let endLineIdx = startLineIdx;

    // Find end of block by indentation
    for (let i = startLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0) {
        // Just include blank lines in the block for now
        endLineIdx = i;
        continue;
      }

      const currentIndent = line.search(/\S/);
      if (currentIndent <= initialIndent) {
        break;
      }
      endLineIdx = i;
    }

    // Trim trailing empty lines from the block
    while (endLineIdx > startLineIdx && lines[endLineIdx].trim().length === 0) {
      endLineIdx--;
    }

    const blockCode = lines.slice(startLineIdx, endLineIdx + 1).join('\n');
    const tokens = estimateTokens(blockCode);

    blocks.push({
      file,
      startLine: startLinePos,
      endLine: endLineIdx + 1,
      code: blockCode,
      tokens,
      patternType: inferPatternType(match[1], match[2]),
    });
  }

  return blocks;
}

/**
 * Infer the type of code pattern based on keywords and naming conventions.
 *
 * @param keyword - The keyword used for declaration (e.g., 'class', 'function').
 * @param name - The identifier name for the block.
 * @returns Inferred PatternType.
 */
function inferPatternType(keyword: string, name: string): PatternType {
  const n = name.toLowerCase();
  if (
    keyword === 'handler' ||
    n.includes('handler') ||
    n.includes('controller') ||
    n.startsWith('app.')
  ) {
    return 'api-handler';
  }
  if (n.includes('validate') || n.includes('schema')) return 'validator';
  if (n.includes('util') || n.includes('helper')) return 'utility';
  if (keyword === 'class') return 'class-method';
  if (n.match(/^[A-Z]/)) return 'component';
  if (keyword === 'function') return 'function';
  return 'unknown';
}

/**
 * Local wrapper for core similarity
 */
function calculateSimilarity(a: string, b: string): number {
  return calculateStringSimilarity(a, b);
}

/**
 * Local wrapper for core confidence
 */
function calculateConfidence(
  similarity: number,
  tokens: number,
  lines: number
): number {
  return calculateHeuristicConfidence(similarity, tokens, lines);
}

/**
 * Detect duplicate patterns across files
 *
 * @param fileContents - Array of file contents to analyze.
 * @param options - Configuration for duplicate detection (thresholds, progress, etc).
 * @returns Promise resolving to an array of detected duplicate patterns sorted by similarity.
 */
export async function detectDuplicatePatterns(
  fileContents: FileContent[],
  options: DetectionOptions
): Promise<DuplicatePattern[]> {
  const {
    minSimilarity,
    minLines,
    streamResults,
    onProgress,
    excludePatterns = [],
    confidenceThreshold = 0,
    ignoreWhitelist = [],
  } = options;
  const allBlocks: CodeBlock[] = [];

  // Pre-compile exclude regexes
  const excludeRegexes = excludePatterns.map((p) => new RegExp(p, 'i'));

  for (const { file, content } of fileContents) {
    const blocks = extractBlocks(file, content);
    for (const b of blocks) {
      if (b.endLine - b.startLine + 1 < minLines) continue;

      // Filter out blocks matching exclude patterns
      const isExcluded = excludeRegexes.some((regex) => regex.test(b.code));
      if (isExcluded) continue;

      allBlocks.push(b);
    }
  }

  const duplicates: DuplicatePattern[] = [];
  const totalBlocks = allBlocks.length;
  let comparisons = 0;
  const totalComparisons = (totalBlocks * (totalBlocks - 1)) / 2;

  if (onProgress) {
    onProgress(
      0,
      totalComparisons,
      `Starting duplicate detection on ${totalBlocks} blocks...`
    );
  }

  for (let i = 0; i < allBlocks.length; i++) {
    // Yield to the event loop every 50 blocks to prevent blocking for too long
    if (i % 50 === 0 && i > 0) {
      await new Promise((resolve) => setImmediate(resolve));
      if (onProgress) {
        onProgress(
          comparisons,
          totalComparisons,
          `Analyzing blocks (${i}/${totalBlocks})...`
        );
      }
    }

    const b1 = allBlocks[i];
    const isPython1 = b1.file.toLowerCase().endsWith('.py');
    const norm1 = normalizeCode(b1.code, isPython1);

    for (let j = i + 1; j < allBlocks.length; j++) {
      comparisons++;
      const b2 = allBlocks[j];

      if (b1.file === b2.file) continue;

      // Check ignore whitelist (file pairs)
      const isWhitelisted = ignoreWhitelist.some((pattern) => {
        return (
          (b1.file.includes(pattern) && b2.file.includes(pattern)) ||
          pattern === `${b1.file}::${b2.file}` ||
          pattern === `${b2.file}::${b1.file}`
        );
      });
      if (isWhitelisted) continue;

      const isPython2 = b2.file.toLowerCase().endsWith('.py');
      const norm2 = normalizeCode(b2.code, isPython2);
      const sim = calculateSimilarity(norm1, norm2);

      if (sim >= minSimilarity) {
        const confidence = calculateConfidence(
          sim,
          b1.tokens,
          b1.endLine - b1.startLine + 1
        );

        if (confidence < confidenceThreshold) continue;

        const { severity, reason, suggestion, matchedRule } = calculateSeverity(
          b1.file,
          b2.file,
          b1.code,
          sim,
          b1.endLine - b1.startLine + 1
        );

        const dup: DuplicatePattern = {
          file1: b1.file,
          line1: b1.startLine,
          endLine1: b1.endLine,
          file2: b2.file,
          line2: b2.startLine,
          endLine2: b2.endLine,
          code1: b1.code,
          code2: b2.code,
          similarity: sim,
          confidence,
          patternType: b1.patternType,
          tokenCost: b1.tokens + b2.tokens,
          severity: severity as Severity,
          reason,
          suggestion,
          matchedRule,
        };

        duplicates.push(dup);
        if (streamResults)
          console.log(
            `[DUPLICATE] ${dup.file1}:${dup.line1} <-> ${dup.file2}:${dup.line2} (${Math.round(sim * 100)}%, conf: ${Math.round(confidence * 100)}%)`
          );
      }
    }
  }

  if (onProgress) {
    onProgress(
      totalComparisons,
      totalComparisons,
      `Duplicate detection complete. Found ${duplicates.length} patterns.`
    );
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}
