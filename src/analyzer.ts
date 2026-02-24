import { estimateTokens, parseFileExports, calculateImportSimilarity, type ExportWithImports } from '@aiready/core';
import type {
  ContextAnalysisResult,
  DependencyGraph,
  DependencyNode,
  ExportInfo,
  ModuleCluster,
  FileClassification,
} from './types';
import { buildCoUsageMatrix, buildTypeGraph, inferDomainFromSemantics } from './semantic-analysis';

interface FileContent {
  file: string;
  content: string;
}

/**
 * Auto-detect domain keywords from workspace folder structure
 * Extracts unique folder names from file paths as potential domain keywords
 */
function extractDomainKeywordsFromPaths(files: FileContent[]): string[] {
  const folderNames = new Set<string>();
  
  for (const { file } of files) {
    const segments = file.split('/');
    // Extract meaningful folder names (skip common infrastructure folders)
    const skipFolders = new Set(['src', 'lib', 'dist', 'build', 'node_modules', 'test', 'tests', '__tests__', 'spec', 'e2e', 'scripts', 'components', 'utils', 'helpers', 'util', 'helper', 'api', 'apis']);
    
    for (const segment of segments) {
      const normalized = segment.toLowerCase();
      if (normalized && !skipFolders.has(normalized) && !normalized.includes('.')) {
        // Singularize common plural forms for better matching
        const singular = singularize(normalized);
        folderNames.add(singular);
      }
    }
  }
  
  return Array.from(folderNames);
}

/**
 * Simple singularization for common English plurals
 */
function singularize(word: string): string {
  // Handle irregular plurals
  const irregulars: Record<string, string> = {
    people: 'person',
    children: 'child',
    men: 'man',
    women: 'woman',
  };
  
  if (irregulars[word]) {
    return irregulars[word];
  }
  
  // Common plural patterns
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y'; // categories -> category
  }
  if (word.endsWith('ses')) {
    return word.slice(0, -2); // classes -> class
  }
  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1); // orders -> order
  }
  
  return word;
}

/**
 * Build a dependency graph from file contents
 */
export function buildDependencyGraph(
  files: FileContent[],
): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges = new Map<string, Set<string>>();

  // Auto-detect domain keywords from workspace folder structure
  const autoDetectedKeywords = extractDomainKeywordsFromPaths(files);

  // First pass: Create nodes with folder-based domain inference
  for (const { file, content } of files) {
    const imports = extractImportsFromContent(content);
    
    // Use AST-based extraction for better accuracy, fallback to regex
    const exports = extractExportsWithAST(content, file, { domainKeywords: autoDetectedKeywords }, imports);
    
    const tokenCost = estimateTokens(content);
    const linesOfCode = content.split('\n').length;

    nodes.set(file, {
      file,
      imports,
      exports,
      tokenCost,
      linesOfCode,
    });

    edges.set(file, new Set(imports));
  }

  // Second pass: Build semantic analysis graphs
  const graph: DependencyGraph = { nodes, edges };
  const coUsageMatrix = buildCoUsageMatrix(graph);
  const typeGraph = buildTypeGraph(graph);
  
  // Add semantic data to graph
  graph.coUsageMatrix = coUsageMatrix;
  graph.typeGraph = typeGraph;

  // Third pass: Enhance domain assignments with semantic analysis
  for (const [file, node] of nodes) {
    for (const exp of node.exports) {
      // Get semantic domain assignments
      const semanticAssignments = inferDomainFromSemantics(
        file,
        exp.name,
        graph,
        coUsageMatrix,
        typeGraph,
        exp.typeReferences
      );
      
      // Add multi-domain assignments with confidence scores
      exp.domains = semanticAssignments;
      
      // Keep inferredDomain for backwards compatibility (use highest confidence)
      if (semanticAssignments.length > 0) {
        exp.inferredDomain = semanticAssignments[0].domain;
      }
    }
  }

  return graph;
}

/**
 * Extract imports from file content using regex
 * Simple implementation - could be improved with AST parsing
 */
function extractImportsFromContent(content: string): string[] {
  const imports: string[] = [];

  // Match various import patterns
  const patterns = [
    /import\s+.*?\s+from\s+['"](.+?)['"]/g, // import ... from '...'
    /import\s+['"](.+?)['"]/g, // import '...'
    /require\(['"](.+?)['"]\)/g, // require('...')
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      // Exclude only node built-ins (node:), include all local and aliased imports
      if (importPath && !importPath.startsWith('node:')) {
        imports.push(importPath);
      }
    }
  }

  return [...new Set(imports)]; // Deduplicate
}

/**
 * Calculate the maximum depth of import tree for a file
 */
export function calculateImportDepth(
  file: string,
  graph: DependencyGraph,
  visited = new Set<string>(),
  depth = 0
): number {
  if (visited.has(file)) {
    return depth; // Circular dependency, return current depth
  }

  const dependencies = graph.edges.get(file);
  if (!dependencies || dependencies.size === 0) {
    return depth;
  }

  visited.add(file);
  let maxDepth = depth;

  for (const dep of dependencies) {
    const depDepth = calculateImportDepth(dep, graph, visited, depth + 1);
    maxDepth = Math.max(maxDepth, depDepth);
  }

  visited.delete(file);
  return maxDepth;
}

/**
 * Get all transitive dependencies for a file
 */
export function getTransitiveDependencies(
  file: string,
  graph: DependencyGraph,
  visited = new Set<string>()
): string[] {
  if (visited.has(file)) {
    return [];
  }

  visited.add(file);
  const dependencies = graph.edges.get(file);
  if (!dependencies || dependencies.size === 0) {
    return [];
  }

  const allDeps: string[] = [];
  for (const dep of dependencies) {
    allDeps.push(dep);
    allDeps.push(...getTransitiveDependencies(dep, graph, visited));
  }

  return [...new Set(allDeps)]; // Deduplicate
}

/**
 * Calculate total context budget (tokens needed to understand this file)
 */
export function calculateContextBudget(
  file: string,
  graph: DependencyGraph
): number {
  const node = graph.nodes.get(file);
  if (!node) return 0;

  let totalTokens = node.tokenCost;
  const deps = getTransitiveDependencies(file, graph);

  for (const dep of deps) {
    const depNode = graph.nodes.get(dep);
    if (depNode) {
      totalTokens += depNode.tokenCost;
    }
  }

  return totalTokens;
}

/**
 * Detect circular dependencies
 */
export function detectCircularDependencies(
  graph: DependencyGraph
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(file: string, path: string[]): void {
    if (recursionStack.has(file)) {
      // Found a cycle
      const cycleStart = path.indexOf(file);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), file]);
      }
      return;
    }

    if (visited.has(file)) {
      return;
    }

    visited.add(file);
    recursionStack.add(file);
    path.push(file);

    const dependencies = graph.edges.get(file);
    if (dependencies) {
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }
    }

    recursionStack.delete(file);
  }

  for (const file of graph.nodes.keys()) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return cycles;
}

/**
 * Calculate cohesion score (how related are exports in a file)
 * Uses enhanced calculation combining domain-based and import-based analysis
 * @param exports - Array of export information
 * @param filePath - Optional file path for context-aware scoring
 */
export function calculateCohesion(
  exports: ExportInfo[],
  filePath?: string,
  options?: { coUsageMatrix?: Map<string, Map<string, number>>; weights?: { importBased?: number; structural?: number; domainBased?: number } }
): number {
  return calculateEnhancedCohesion(exports, filePath, options);
}

/**
 * Check if a file is a test/mock/fixture file
 */
function isTestFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('test') ||
    lower.includes('spec') ||
    lower.includes('mock') ||
    lower.includes('fixture') ||
    lower.includes('__tests__') ||
    lower.includes('.test.') ||
    lower.includes('.spec.')
  );
}

/**
 * Calculate fragmentation score (how scattered is a domain)
 */
export function calculateFragmentation(
  files: string[],
  domain: string,
  options?: { useLogScale?: boolean; logBase?: number }
): number {
  if (files.length <= 1) return 0; // Single file = no fragmentation

  // Calculate how many different directories contain these files
  const directories = new Set(files.map((f) => f.split('/').slice(0, -1).join('/')));
  const uniqueDirs = directories.size;

  // If log-scaling requested, normalize using logarithms so that
  // going from 1 -> 2 directories shows a large jump while 10 -> 11
  // is relatively small. Normalized value is log(uniqueDirs)/log(totalFiles).
  if (options?.useLogScale) {
    if (uniqueDirs <= 1) return 0;
    const total = files.length;
    const base = options.logBase || Math.E;
    const num = Math.log(uniqueDirs) / Math.log(base);
    const den = Math.log(total) / Math.log(base);
    return den > 0 ? num / den : 0;
  }

  // Default (linear) Fragmentation = (unique directories - 1) / (total files - 1)
  return (uniqueDirs - 1) / (files.length - 1);
}

/**
 * Calculate path entropy for a set of files.
 * Returns a normalized entropy in [0,1], where 0 = all files in one directory,
 * and 1 = files are evenly distributed across directories.
 */
export function calculatePathEntropy(files: string[]): number {
  if (!files || files.length === 0) return 0;

  const dirCounts = new Map<string, number>();
  for (const f of files) {
    const dir = f.split('/').slice(0, -1).join('/') || '.';
    dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
  }

  const counts = Array.from(dirCounts.values());
  if (counts.length <= 1) return 0; // single directory -> zero entropy

  const total = counts.reduce((s, v) => s + v, 0);
  let entropy = 0;
  for (const count of counts) {
    const prob = count / total;
    entropy -= prob * Math.log2(prob);
  }

  const maxEntropy = Math.log2(counts.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/**
 * Calculate directory-distance metric based on common ancestor depth.
 * For each file pair compute depth(commonAncestor) and normalize by the
 * maximum path depth between the two files. Returns value in [0,1] where
 * 0 means all pairs share a deep common ancestor (low fragmentation) and
 * 1 means they share only the root (high fragmentation).
 */
export function calculateDirectoryDistance(files: string[]): number {
  if (!files || files.length <= 1) return 0;

  function pathSegments(p: string) {
    return p.split('/').filter(Boolean);
  }

  function commonAncestorDepth(a: string[], b: string[]) {
    const minLen = Math.min(a.length, b.length);
    let i = 0;
    while (i < minLen && a[i] === b[i]) i++;
    return i; // number of shared segments from root
  }

  let totalNormalized = 0;
  let comparisons = 0;

  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const segA = pathSegments(files[i]);
      const segB = pathSegments(files[j]);
      const shared = commonAncestorDepth(segA, segB);
      const maxDepth = Math.max(segA.length, segB.length);
      const normalizedShared = maxDepth > 0 ? shared / maxDepth : 0;
      // distance is inverse of normalized shared depth
      totalNormalized += 1 - normalizedShared;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalNormalized / comparisons : 0;
}

/**
 * Group files by domain to detect module clusters
 */
export function detectModuleClusters(
  graph: DependencyGraph,
  options?: { useLogScale?: boolean }
): ModuleCluster[] {
  const domainMap = new Map<string, string[]>();

  // Group files by their primary domain
  for (const [file, node] of graph.nodes.entries()) {
    const domains = node.exports.map((e) => e.inferredDomain || 'unknown');
    const primaryDomain = domains[0] || 'unknown';

    if (!domainMap.has(primaryDomain)) {
      domainMap.set(primaryDomain, []);
    }
    domainMap.get(primaryDomain)!.push(file);
  }

  const clusters: ModuleCluster[] = [];

  for (const [domain, files] of domainMap.entries()) {
    if (files.length < 2) continue; // Skip single-file domains

    const totalTokens = files.reduce((sum, file) => {
      const node = graph.nodes.get(file);
      return sum + (node?.tokenCost || 0);
    }, 0);

    const baseFragmentation = calculateFragmentation(files, domain, { useLogScale: !!options?.useLogScale });

    // Compute import-based cohesion across files in this domain cluster.
    // This measures how much the files actually "talk" to each other.
    // We'll compute average pairwise Jaccard similarity between each file's import lists.
    let importSimilarityTotal = 0;
    let importComparisons = 0;

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const f1 = files[i];
        const f2 = files[j];
        const n1 = graph.nodes.get(f1)?.imports || [];
        const n2 = graph.nodes.get(f2)?.imports || [];

        // Treat two empty import lists as not coupled (similarity 0)
        const similarity = (n1.length === 0 && n2.length === 0)
          ? 0
          : calculateJaccardSimilarity(n1, n2);

        importSimilarityTotal += similarity;
        importComparisons++;
      }
    }

    const importCohesion = importComparisons > 0 ? importSimilarityTotal / importComparisons : 0;

    // Coupling discount: if files are heavily importing each other, reduce fragmentation penalty.
    // Following recommendation: up to 20% discount proportional to import cohesion.
    const couplingDiscountFactor = 1 - 0.2 * importCohesion;

    const fragmentationScore = baseFragmentation * couplingDiscountFactor;

    // Additional metrics for richer reporting
    const pathEntropy = calculatePathEntropy(files);
    const directoryDistance = calculateDirectoryDistance(files);

    const avgCohesion =
      files.reduce((sum, file) => {
        const node = graph.nodes.get(file);
        return sum + (node ? calculateCohesion(node.exports, file, { coUsageMatrix: graph.coUsageMatrix }) : 0);
      }, 0) / files.length;

    // Generate consolidation plan
    const targetFiles = Math.max(1, Math.ceil(files.length / 3)); // Aim to reduce by ~66%
    const consolidationPlan = generateConsolidationPlan(
      domain,
      files,
      targetFiles
    );

    clusters.push({
      domain,
      files,
      totalTokens,
      fragmentationScore,
      pathEntropy,
      directoryDistance,
      importCohesion,
      avgCohesion,
      suggestedStructure: {
        targetFiles,
        consolidationPlan,
      },
    });
  }

  // Sort by fragmentation score (most fragmented first)
  return clusters.sort((a, b) => b.fragmentationScore - a.fragmentationScore);
}

/**
 * Extract export information from file content
 * TODO: Use proper AST parsing for better accuracy
 */
function extractExports(
  content: string,
  filePath?: string,
  domainOptions?: { domainKeywords?: string[]; domainPatterns?: string[]; pathDomainMap?: Record<string, string> },
  fileImports?: string[]
): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Simple regex-based extraction (improve with AST later)
  const patterns = [
    /export\s+function\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+const\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+default/g,
  ];

  const types: ExportInfo['type'][] = [
    'function',
    'class',
    'const',
    'type',
    'interface',
    'default',
  ];

  patterns.forEach((pattern, index) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1] || 'default';
      const type = types[index];
      const inferredDomain = inferDomain(name, filePath, domainOptions, fileImports);

      exports.push({ name, type, inferredDomain });
    }
  });

  return exports;
}

/**
 * Infer domain from export name
 * Uses common naming patterns with word boundary matching
 */
function inferDomain(
  name: string,
  filePath?: string,
  domainOptions?: { domainKeywords?: string[] },
  fileImports?: string[]
): string {
  const lower = name.toLowerCase();

  // Tokenize identifier: split camelCase, snake_case, kebab-case, and numbers
  const tokens = Array.from(
    new Set(
      lower
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^a-z0-9]+/gi, ' ')
        .split(' ')
        .filter(Boolean)
    )
  );

  // Domain keywords ordered from most specific to most general
  // This prevents generic terms like 'util' from matching before specific domains
  // NOTE: 'api', 'util', 'helper' are intentionally excluded as they are too generic
  const defaultKeywords = [
    'authentication',
    'authorization',
    'payment',
    'invoice',
    'customer',
    'product',
    'order',
    'cart',
    'user',
    'admin',
    'repository',
    'controller',
    'service',
    'config',
    'model',
    'view',
    'auth',
  ];

  const domainKeywords = domainOptions?.domainKeywords && domainOptions.domainKeywords.length
    ? [...domainOptions.domainKeywords, ...defaultKeywords]
    : defaultKeywords;

  // Try word boundary matching first for more accurate detection
  for (const keyword of domainKeywords) {
    if (tokens.includes(keyword)) {
      return keyword;
    }
  }

  // Fallback to substring matching for compound words
  for (const keyword of domainKeywords) {
    if (lower.includes(keyword)) {
      return keyword;
    }
  }

  // Import-path domain inference: analyze import statements for domain hints
  if (fileImports && fileImports.length > 0) {
    for (const importPath of fileImports) {
      // Parse all segments, including those after '@' or '.'
      // e.g., '@/orders/service' -> ['orders', 'service']
      //       '../payments/processor' -> ['payments', 'processor']
      const allSegments = importPath.split('/');
      const relevantSegments = allSegments.filter(s => {
        if (!s) return false;
        // Skip '.' and '..' but keep everything else
        if (s === '.' || s === '..') return false;
        // Skip '@' prefix but keep the path after it
        if (s.startsWith('@') && s.length === 1) return false;
        // Remove '@' prefix from scoped imports like '@/orders'
        return true;
      }).map(s => s.startsWith('@') ? s.slice(1) : s);
      
      for (const segment of relevantSegments) {
        const segLower = segment.toLowerCase();
        const singularSegment = singularize(segLower);
        
        // Check if any domain keyword matches the import path segment (with singularization)
        for (const keyword of domainKeywords) {
          if (singularSegment === keyword || segLower === keyword || segLower.includes(keyword)) {
            return keyword;
          }
        }
      }
    }
  }

  // Path-based fallback: check file path segments
  if (filePath) {
    // Auto-detect from path by checking against domain keywords (with singularization)
    const pathSegments = filePath.toLowerCase().split('/');
    for (const segment of pathSegments) {
      const singularSegment = singularize(segment);
      
      for (const keyword of domainKeywords) {
        if (singularSegment === keyword || segment === keyword || segment.includes(keyword)) {
          return keyword;
        }
      }
    }
  }

  return 'unknown';
}

/**
 * Generate consolidation plan for fragmented modules
 */
function generateConsolidationPlan(
  domain: string,
  files: string[],
  targetFiles: number
): string[] {
  const plan: string[] = [];

  if (files.length <= targetFiles) {
    return [`No consolidation needed for ${domain}`];
  }

  plan.push(
    `Consolidate ${files.length} ${domain} files into ${targetFiles} cohesive file(s):`
  );

  // Group by directory
  const dirGroups = new Map<string, string[]>();
  for (const file of files) {
    const dir = file.split('/').slice(0, -1).join('/');
    if (!dirGroups.has(dir)) {
      dirGroups.set(dir, []);
    }
    dirGroups.get(dir)!.push(file);
  }

  plan.push(`1. Create unified ${domain} module file`);
  plan.push(
    `2. Move related functionality from ${files.length} scattered files`
  );
  plan.push(`3. Update imports in dependent files`);
  plan.push(
    `4. Remove old files after consolidation (verify with tests first)`
  );

  return plan;
}

/**
 * Extract exports using AST parsing (enhanced version)
 * Falls back to regex if AST parsing fails
 */
export function extractExportsWithAST(
  content: string,
  filePath: string,
  domainOptions?: { domainKeywords?: string[] },
  fileImports?: string[]
): ExportInfo[] {
  try {
    const { exports: astExports } = parseFileExports(content, filePath);
    
    return astExports.map(exp => ({
      name: exp.name,
      type: exp.type,
      inferredDomain: inferDomain(exp.name, filePath, domainOptions, fileImports),
      imports: exp.imports,
      dependencies: exp.dependencies,
    }));
  } catch (error) {
    // Fallback to regex-based extraction
    return extractExports(content, filePath, domainOptions, fileImports);
  }
}

/**
 * Calculate enhanced cohesion score using both domain inference and import similarity
 * 
 * This combines:
 * 1. Domain-based cohesion (entropy of inferred domains)
 * 2. Import-based cohesion (Jaccard similarity of shared imports)
 * 
 * Weight: 60% import-based, 40% domain-based (import analysis is more reliable)
 */
export function calculateEnhancedCohesion(
  exports: ExportInfo[],
  filePath?: string,
  options?: { coUsageMatrix?: Map<string, Map<string, number>>; weights?: { importBased?: number; structural?: number; domainBased?: number } }
): number {
  if (exports.length === 0) return 1;
  if (exports.length === 1) return 1;

  // Special case for test files
  if (filePath && isTestFile(filePath)) {
    return 1;
  }

  // Calculate domain-based cohesion (existing method)
  const domainCohesion = calculateDomainCohesion(exports);

  // Calculate import-based cohesion if imports are available
  const hasImportData = exports.some((e) => e.imports && e.imports.length > 0);
  const importCohesion = hasImportData ? calculateImportBasedCohesion(exports) : undefined;

  // Calculate structural cohesion (co-usage) if coUsageMatrix and filePath available
  const coUsageMatrix = options?.coUsageMatrix;
  const structuralCohesion = filePath && coUsageMatrix ? calculateStructuralCohesionFromCoUsage(filePath, coUsageMatrix) : undefined;

  // Default weights (can be overridden via options)
  const defaultWeights = { importBased: 0.5, structural: 0.3, domainBased: 0.2 };
  const weights = { ...defaultWeights, ...(options?.weights || {}) };

  // Collect available signals and normalize weights
  const signals: Array<{ score: number; weight: number }> = [];
  if (importCohesion !== undefined) signals.push({ score: importCohesion, weight: weights.importBased });
  if (structuralCohesion !== undefined) signals.push({ score: structuralCohesion, weight: weights.structural });
  // domain cohesion is always available
  signals.push({ score: domainCohesion, weight: weights.domainBased });

  const totalWeight = signals.reduce((s, el) => s + el.weight, 0);
  if (totalWeight === 0) return domainCohesion;

  const combined = signals.reduce((sum, el) => sum + el.score * (el.weight / totalWeight), 0);
  return combined;
}

/**
 * Calculate structural cohesion for a file based on co-usage patterns.
 * Uses the co-usage distribution (files commonly imported alongside this file)
 * and computes an entropy-based cohesion score in [0,1].
 * - 1 => highly cohesive (imports mostly appear together with a small set)
 * - 0 => maximally fragmented (imports appear uniformly across many partners)
 */
export function calculateStructuralCohesionFromCoUsage(
  file: string,
  coUsageMatrix?: Map<string, Map<string, number>>
): number {
  if (!coUsageMatrix) return 1;

  const coUsages = coUsageMatrix.get(file);
  if (!coUsages || coUsages.size === 0) return 1;

  // Build probability distribution over co-imported files
  let total = 0;
  for (const count of coUsages.values()) total += count;
  if (total === 0) return 1;

  const probs: number[] = [];
  for (const count of coUsages.values()) {
    if (count > 0) probs.push(count / total);
  }

  if (probs.length <= 1) return 1;

  // Calculate entropy
  let entropy = 0;
  for (const prob of probs) {
    entropy -= prob * Math.log2(prob);
  }

  const maxEntropy = Math.log2(probs.length);
  return maxEntropy > 0 ? 1 - entropy / maxEntropy : 1;
}

/**
 * Calculate cohesion based on shared imports (Jaccard similarity)
 */
function calculateImportBasedCohesion(exports: ExportInfo[]): number {
  const exportsWithImports = exports.filter(e => e.imports && e.imports.length > 0);
  
  if (exportsWithImports.length < 2) {
    return 1; // Not enough data
  }

  // Calculate pairwise import similarity
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < exportsWithImports.length; i++) {
    for (let j = i + 1; j < exportsWithImports.length; j++) {
      const exp1 = exportsWithImports[i] as ExportInfo & { imports: string[] };
      const exp2 = exportsWithImports[j] as ExportInfo & { imports: string[] };
      
      const similarity = calculateJaccardSimilarity(exp1.imports, exp2.imports);
      totalSimilarity += similarity;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 1;
}

/**
 * Calculate Jaccard similarity between two arrays
 */
function calculateJaccardSimilarity(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 && arr2.length === 0) return 1;
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate domain-based cohesion (existing entropy method)
 */
function calculateDomainCohesion(exports: ExportInfo[]): number {
  const domains = exports.map((e) => e.inferredDomain || 'unknown');
  const domainCounts = new Map<string, number>();

  for (const domain of domains) {
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  const total = domains.length;
  let entropy = 0;

  for (const domainCount of domainCounts.values()) {
    const prob = domainCount / total;
    if (prob > 0) {
      entropy -= prob * Math.log2(prob);
    }
  }

  const maxEntropy = Math.log2(total);
  return maxEntropy > 0 ? 1 - entropy / maxEntropy : 1;
}

/**
 * Classify a file based on its characteristics to help distinguish
 * real issues from false positives.
 * 
 * Classification types:
 * - barrel-export: Re-exports from other modules (index.ts files)
 * - type-definition: Primarily type/interface definitions
 * - cohesive-module: Single domain, high cohesion (acceptable large files)
 * - utility-module: Utility/helper files with cohesive purpose despite multi-domain
 * - service-file: Service files orchestrating multiple dependencies
 * - lambda-handler: Lambda/API handlers with single business purpose
 * - email-template: Email templates/layouts with structural cohesion
 * - parser-file: Parser/transformer files with single transformation purpose
 * - mixed-concerns: Multiple domains, potential refactoring candidate
 * - unknown: Unable to classify
 */
export function classifyFile(
  node: DependencyNode,
  cohesionScore: number,
  domains: string[]
): FileClassification {
  const { exports, imports, linesOfCode, file } = node;
  
  // 1. Check for barrel export (index file that re-exports)
  if (isBarrelExport(node)) {
    return 'barrel-export';
  }
  
  // 2. Check for type definition file
  if (isTypeDefinitionFile(node)) {
    return 'type-definition';
  }
  
  // 3. Check for config/schema file (special case - acceptable multi-domain)
  if (isConfigOrSchemaFile(node)) {
    return 'cohesive-module'; // Treat as cohesive since it's intentional
  }
  
  // 4. Check for lambda handlers FIRST (they often look like mixed concerns)
  if (isLambdaHandler(node)) {
    return 'lambda-handler';
  }
  
  // 4b. Check for data access layer (DAL) files
  if (isDataAccessFile(node)) {
    return 'cohesive-module';
  }
  
  // 5. Check for email templates (they reference multiple domains but serve one purpose)
  if (isEmailTemplate(node)) {
    return 'email-template';
  }
  
  // 6. Check for parser/transformer files
  if (isParserFile(node)) {
    return 'parser-file';
  }
  
  // 7. Check for service files
  if (isServiceFile(node)) {
    return 'service-file';
  }
  
  // 8. Check for session/state management files
  if (isSessionFile(node)) {
    return 'cohesive-module'; // Session files manage state cohesively
  }
  
  // 9. Check for Next.js App Router pages (metadata + faqJsonLd + default export)
  if (isNextJsPage(node)) {
    return 'nextjs-page';
  }
  
  // 10. Check for utility file pattern (multiple domains but utility purpose)
  if (isUtilityFile(node)) {
    return 'utility-module';
  }

  // Explicit path-based utility heuristic: files under /utils/ or /helpers/
  // should be classified as utility-module regardless of domain count.
  // This ensures common helper modules (e.g., src/utils/dynamodb-utils.ts)
  // are treated as utility modules in tests and analysis.
  if (file.toLowerCase().includes('/utils/') || file.toLowerCase().includes('/helpers/')) {
    return 'utility-module';
  }
  
  // 10. Check for cohesive module (single domain + reasonable cohesion)
  const uniqueDomains = domains.filter(d => d !== 'unknown');
  const hasSingleDomain = uniqueDomains.length <= 1;
  
  // Single domain files are almost always cohesive (even with lower cohesion score)
  if (hasSingleDomain) {
    return 'cohesive-module';
  }

  // 10b. Check for shared entity noun despite multi-domain scoring
  // e.g. getUserReceipts + createPendingReceipt both refer to 'receipt'
  if (allExportsShareEntityNoun(exports)) {
    return 'cohesive-module';
  }
  
  // 11. Check for mixed concerns (multiple domains + low cohesion)
  const hasMultipleDomains = uniqueDomains.length > 1;
  const hasLowCohesion = cohesionScore < 0.4; // Lowered threshold
  
  if (hasMultipleDomains && hasLowCohesion) {
    return 'mixed-concerns';
  }
  
  // 12. Default to cohesive-module for files with reasonable cohesion
  // This reduces false positives for legitimate files
  if (cohesionScore >= 0.5) {
    return 'cohesive-module';
  }
  
  return 'unknown';
}

/**
 * Detect if a file is a barrel export (re-exports from other modules)
 * 
 * Characteristics of barrel exports:
 * - Named "index.ts" or "index.js"
 * - Many re-export statements (export * from, export { x } from)
 * - Little to no actual implementation code
 * - High export count relative to lines of code
 */
function isBarrelExport(node: DependencyNode): boolean {
  const { file, exports, imports, linesOfCode } = node;
  
  // Check filename pattern
  const fileName = file.split('/').pop()?.toLowerCase();
  const isIndexFile = fileName === 'index.ts' || fileName === 'index.js' || 
                      fileName === 'index.tsx' || fileName === 'index.jsx';
  
  // Calculate re-export ratio
  // Re-exports typically have form: export { x } from 'module' or export * from 'module'
  // They have imports AND exports, with exports coming from those imports
  const hasReExports = exports.length > 0 && imports.length > 0;
  const highExportToLinesRatio = exports.length > 3 && linesOfCode < exports.length * 5;
  
  // Little actual code (mostly import/export statements)
  const sparseCode = linesOfCode > 0 && linesOfCode < 50 && exports.length >= 2;
  
  // Index files with re-export patterns
  if (isIndexFile && hasReExports) {
    return true;
  }
  
  // Non-index files that are clearly barrel exports
  if (highExportToLinesRatio && imports.length >= exports.length * 0.5) {
    return true;
  }
  
  // Very sparse files with multiple re-exports
  if (sparseCode && imports.length > 0) {
    return true;
  }
  
  return false;
}

/**
 * Detect if a file is primarily a type definition file
 * 
 * Characteristics:
 * - Mostly type/interface exports
 * - Little to no runtime code
 * - Often named *.d.ts or types.ts
 * - Located in /types/, /typings/, or @types directories
 */
function isTypeDefinitionFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  // Check filename pattern
  const fileName = file.split('/').pop()?.toLowerCase();
  const isTypesFile = fileName?.includes('types') || fileName?.includes('.d.ts') ||
                      fileName === 'types.ts' || fileName === 'interfaces.ts';
  
  // Check if file is in a types directory (path-based detection)
  const lowerPath = file.toLowerCase();
  const isTypesPath = lowerPath.includes('/types/') || 
                      lowerPath.includes('/typings/') ||
                      lowerPath.includes('/@types/') ||
                      lowerPath.startsWith('types/') ||
                      lowerPath.startsWith('typings/');
  
  // Count type exports vs other exports
  const typeExports = exports.filter(e => e.type === 'type' || e.type === 'interface');
  const runtimeExports = exports.filter(e => e.type === 'function' || e.type === 'class' || e.type === 'const');
  
  // High ratio of type exports
  const mostlyTypes = exports.length > 0 && 
                      typeExports.length > runtimeExports.length &&
                      typeExports.length / exports.length > 0.7;
  
  // Pure type files (only type/interface exports, no runtime code)
  const pureTypeFile = exports.length > 0 && typeExports.length === exports.length;
  
  // Empty export file in types directory (might just be re-exports)
  const emptyOrReExportInTypesDir = isTypesPath && exports.length === 0;
  
  return isTypesFile || isTypesPath || mostlyTypes || pureTypeFile || emptyOrReExportInTypesDir;
}

/**
 * Detect if a file is a config/schema file
 * 
 * Characteristics:
 * - Named with config, schema, or settings patterns
 * - Often defines database schemas, configuration objects
 * - Multiple domains are acceptable (centralized config)
 */
function isConfigOrSchemaFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for config/schema files
  const configPatterns = [
    'config', 'schema', 'settings', 'options', 'constants',
    'env', 'environment', '.config.', '-config.', '_config.',
  ];
  
  const isConfigName = configPatterns.some(pattern => 
    fileName?.includes(pattern) || fileName?.startsWith(pattern) || fileName?.endsWith(`${pattern}.ts`)
  );
  
  // Check if file is in a config/settings directory
  const isConfigPath = file.toLowerCase().includes('/config/') || 
                       file.toLowerCase().includes('/schemas/') ||
                       file.toLowerCase().includes('/settings/');
  
  // Check for schema-like exports (often have table/model definitions)
  const hasSchemaExports = exports.some(e => 
    e.name.toLowerCase().includes('table') ||
    e.name.toLowerCase().includes('schema') ||
    e.name.toLowerCase().includes('config') ||
    e.name.toLowerCase().includes('setting')
  );
  
  return isConfigName || isConfigPath || hasSchemaExports;
}

/**
 * Detect if a file is a utility/helper file
 * 
 * Characteristics:
 * - Named with util, helper, or utility patterns
 * - Often contains mixed helper functions by design
 * - Multiple domains are acceptable (utility purpose)
 */
function isUtilityFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for utility files
  const utilityPatterns = [
    'util', 'utility', 'utilities', 'helper', 'helpers',
    'common', 'shared', 'toolbox', 'toolkit',
    '.util.', '-util.', '_util.', '-utils.', '.utils.',
  ];
  
  const isUtilityName = utilityPatterns.some(pattern => 
    fileName?.includes(pattern)
  );
  
  // Check if file is in a utils/helpers directory
  const isUtilityPath = file.toLowerCase().includes('/utils/') || 
                        file.toLowerCase().includes('/helpers/') ||
                        file.toLowerCase().includes('/common/') ||
                        file.toLowerCase().endsWith('-utils.ts') ||
                        file.toLowerCase().endsWith('-util.ts') ||
                        file.toLowerCase().endsWith('-helper.ts') ||
                        file.toLowerCase().endsWith('-helpers.ts');
  
  // Only consider many small exports as utility pattern if also in utility-like path
  // This prevents false positives for regular modules with many functions
  const hasManySmallExportsInUtilityContext = exports.length >= 3 && 
    exports.every(e => e.type === 'function' || e.type === 'const') &&
    (isUtilityName || isUtilityPath);
  
  return isUtilityName || isUtilityPath || hasManySmallExportsInUtilityContext;
}

/**
 * Split a camelCase or PascalCase identifier into lowercase tokens.
 * e.g. getUserReceipts -> ['get', 'user', 'receipts']
 */
function splitCamelCase(name: string): string[] {
  return name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

/** Common English verbs and adjectives to ignore when extracting entity nouns */
const SKIP_WORDS = new Set([
  'get', 'set', 'create', 'update', 'delete', 'fetch', 'save', 'load',
  'parse', 'format', 'validate', 'convert', 'transform', 'build',
  'generate', 'render', 'send', 'receive', 'find', 'list', 'add',
  'remove', 'insert', 'upsert', 'put', 'read', 'write', 'check',
  'handle', 'process', 'compute', 'calculate', 'init', 'reset', 'clear',
  'pending', 'active', 'current', 'new', 'old', 'all', 'by', 'with',
  'from', 'to', 'and', 'or', 'is', 'has', 'in', 'on', 'of', 'the',
]);

/** Singularize a word simply (strip trailing 's') */
function simpleSingularize(word: string): string {
  if (word.endsWith('ies') && word.length > 3) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Extract meaningful entity nouns from a camelCase/PascalCase function name.
 * Strips common verbs/adjectives and singularizes remainder.
 */
function extractEntityNouns(name: string): string[] {
  return splitCamelCase(name)
    .filter(token => !SKIP_WORDS.has(token) && token.length > 2)
    .map(simpleSingularize);
}

/**
 * Check whether all exports in a file share at least one common entity noun.
 * This catches DAL patterns like getUserReceipts + createPendingReceipt → both 'receipt'.
 */
function allExportsShareEntityNoun(exports: ExportInfo[]): boolean {
  if (exports.length < 2 || exports.length > 30) return false;
  
  const nounSets = exports.map(e => new Set(extractEntityNouns(e.name)));
  if (nounSets.some(s => s.size === 0)) return false;
  
  // Find nouns that appear in ALL exports
  const [first, ...rest] = nounSets;
  const commonNouns = Array.from(first).filter(noun =>
    rest.every(s => s.has(noun))
  );
  
  return commonNouns.length > 0;
}

/**
 * Detect if a file is a Data Access Layer (DAL) / repository module.
 *
 * Characteristics:
 * - Named with db, dynamo, database, repository, dao, postgres, mongo patterns
 * - Or located in /repositories/, /dao/, /data/ directories
 * - Exports all relate to one data store or entity
 */
function isDataAccessFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  const fileName = file.split('/').pop()?.toLowerCase();
  
  const dalPatterns = [
    'dynamo', 'database', 'repository', 'repo', 'dao',
    'firestore', 'postgres', 'mysql', 'mongo', 'redis',
    'sqlite', 'supabase', 'prisma',
  ];
  
  const isDalName = dalPatterns.some(p => fileName?.includes(p));
  
  const isDalPath = file.toLowerCase().includes('/repositories/') ||
                    file.toLowerCase().includes('/dao/') ||
                    file.toLowerCase().includes('/data/');
  
  // File with few exports (≤10) that all share a common entity noun
  const hasDalExportPattern = exports.length >= 1 &&
    exports.length <= 10 &&
    allExportsShareEntityNoun(exports);
  
  // Exclude obvious utility paths from DAL detection (e.g., src/utils/)
  const isUtilityPathLocal = file.toLowerCase().includes('/utils/') || file.toLowerCase().includes('/helpers/');

  // Only treat as DAL when the file is in a DAL path, or when the name/pattern
  // indicates a data access module AND exports follow a DAL-like pattern.
  // Do not classify utility paths as DAL even if the name contains DAL keywords.
  return isDalPath || (isDalName && hasDalExportPattern && !isUtilityPathLocal);
}

/**
 * Detect if a file is a Lambda/API handler
 * 
 * Characteristics:
 * - Named with handler patterns or in handler directories
 * - Single entry point (handler function)
 * - Coordinates multiple services but has single business purpose
 */
function isLambdaHandler(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for lambda handlers
  const handlerPatterns = [
    'handler', '.handler.', '-handler.',
    'lambda', '.lambda.', '-lambda.',
  ];
  
  const isHandlerName = handlerPatterns.some(pattern => 
    fileName?.includes(pattern)
  );
  
  // Check if file is in a handlers/lambdas/functions/lambda directory
  // Exclude /api/ unless it has handler-specific naming
  const isHandlerPath = file.toLowerCase().includes('/handlers/') || 
                        file.toLowerCase().includes('/lambdas/') ||
                        file.toLowerCase().includes('/lambda/') ||
                        file.toLowerCase().includes('/functions/');
  
  // Check for typical lambda handler exports (handler, main, etc.)
  const hasHandlerExport = exports.some(e => 
    e.name.toLowerCase() === 'handler' ||
    e.name.toLowerCase() === 'main' ||
    e.name.toLowerCase() === 'lambdahandler' ||
    e.name.toLowerCase().endsWith('handler')
  );
  
  // Only consider single export as lambda handler if it's in a handler-like context
  // (either in handler directory OR has handler naming)
  const hasSingleEntryInHandlerContext = exports.length === 1 && 
    (exports[0].type === 'function' || exports[0].name === 'default') &&
    (isHandlerPath || isHandlerName);
  
  return isHandlerName || isHandlerPath || hasHandlerExport || hasSingleEntryInHandlerContext;
}

/**
 * Detect if a file is a service file
 * 
 * Characteristics:
 * - Named with service pattern
 * - Often a class or object with multiple methods
 * - Orchestrates multiple dependencies but serves single purpose
 */
function isServiceFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for service files
  const servicePatterns = [
    'service', '.service.', '-service.', '_service.',
  ];
  
  const isServiceName = servicePatterns.some(pattern => 
    fileName?.includes(pattern)
  );
  
  // Check if file is in a services directory
  const isServicePath = file.toLowerCase().includes('/services/');
  
  // Check for service-like exports (class with "Service" in the name)
  const hasServiceNamedExport = exports.some(e => 
    e.name.toLowerCase().includes('service') ||
    e.name.toLowerCase().endsWith('service')
  );
  
  // Check for typical service pattern (class export with service in name)
  const hasClassExport = exports.some(e => e.type === 'class');
  
  // Service files need either:
  // 1. Service in filename/path, OR
  // 2. Class with "Service" in the class name
  return isServiceName || isServicePath || (hasServiceNamedExport && hasClassExport);
}

/**
 * Detect if a file is an email template/layout
 * 
 * Characteristics:
 * - Named with email/template patterns
 * - Contains render/template logic
 * - References multiple domains (user, order, product) but serves single template purpose
 */
function isEmailTemplate(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for email templates (more specific patterns)
  const emailTemplatePatterns = [
    '-email-', '.email.', '_email_',
    '-template', '.template.', '_template',
    '-mail.', '.mail.',
  ];
  
  const isEmailTemplateName = emailTemplatePatterns.some(pattern => 
    fileName?.includes(pattern)
  );
  
  // Specific template file names
  const isSpecificTemplateName = 
    fileName?.includes('receipt') ||
    fileName?.includes('invoice-email') ||
    fileName?.includes('welcome-email') ||
    fileName?.includes('notification-email') ||
    fileName?.includes('writer') && fileName.includes('receipt');
  
  // Check if file is in emails/templates directory (high confidence)
  const isEmailPath = file.toLowerCase().includes('/emails/') || 
                      file.toLowerCase().includes('/mail/') ||
                      file.toLowerCase().includes('/notifications/');
  
  // Check for template patterns (function that returns string/HTML)
  // More specific: must have render/generate in the function name
  const hasTemplateFunction = exports.some(e => 
    e.type === 'function' && (
      e.name.toLowerCase().startsWith('render') ||
      e.name.toLowerCase().startsWith('generate') ||
      (e.name.toLowerCase().includes('template') && e.name.toLowerCase().includes('email'))
    )
  );
  
  // Check for email-related exports (but not service classes)
  const hasEmailExport = exports.some(e => 
    (e.name.toLowerCase().includes('template') && e.type === 'function') ||
    (e.name.toLowerCase().includes('render') && e.type === 'function') ||
    (e.name.toLowerCase().includes('email') && e.type !== 'class')
  );
  
  // Require path-based match OR combination of name and export patterns
  return isEmailPath || isEmailTemplateName || isSpecificTemplateName || 
         (hasTemplateFunction && hasEmailExport);
}

/**
 * Detect if a file is a parser/transformer
 * 
 * Characteristics:
 * - Named with parser/transform patterns
 * - Contains parse/transform logic
 * - Single transformation purpose despite touching multiple domains
 */
function isParserFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for parser files
  const parserPatterns = [
    'parser', '.parser.', '-parser.', '_parser.',
    'transform', '.transform.', '-transform.',
    'converter', '.converter.', '-converter.',
    'mapper', '.mapper.', '-mapper.',
    'serializer', '.serializer.',
    'deterministic', // For base-parser-deterministic.ts pattern
  ];
  
  const isParserName = parserPatterns.some(pattern => 
    fileName?.includes(pattern)
  );
  
  // Check if file is in parsers/transformers directory
  const isParserPath = file.toLowerCase().includes('/parsers/') || 
                       file.toLowerCase().includes('/transformers/') ||
                       file.toLowerCase().includes('/converters/') ||
                       file.toLowerCase().includes('/mappers/');
  
  // Check for parser-related exports
  const hasParserExport = exports.some(e => 
    e.name.toLowerCase().includes('parse') ||
    e.name.toLowerCase().includes('transform') ||
    e.name.toLowerCase().includes('convert') ||
    e.name.toLowerCase().includes('map') ||
    e.name.toLowerCase().includes('serialize') ||
    e.name.toLowerCase().includes('deserialize')
  );
  
  // Check for function patterns typical of parsers
  const hasParseFunction = exports.some(e => 
    e.type === 'function' && (
      e.name.toLowerCase().startsWith('parse') ||
      e.name.toLowerCase().startsWith('transform') ||
      e.name.toLowerCase().startsWith('convert') ||
      e.name.toLowerCase().startsWith('map') ||
      e.name.toLowerCase().startsWith('extract')
    )
  );
  
  return isParserName || isParserPath || hasParserExport || hasParseFunction;
}

/**
 * Detect if a file is a session/state management file
 * 
 * Characteristics:
 * - Named with session/state patterns
 * - Manages state across operations
 * - Single purpose despite potentially touching multiple domains
 */
function isSessionFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Check filename patterns for session files
  const sessionPatterns = [
    'session', '.session.', '-session.',
    'state', '.state.', '-state.',
    'context', '.context.', '-context.',
    'store', '.store.', '-store.',
  ];
  
  const isSessionName = sessionPatterns.some(pattern => 
    fileName?.includes(pattern)
  );
  
  // Check if file is in sessions/state directory
  const isSessionPath = file.toLowerCase().includes('/sessions/') || 
                        file.toLowerCase().includes('/state/') ||
                        file.toLowerCase().includes('/context/') ||
                        file.toLowerCase().includes('/store/');
  
  // Check for session-related exports
  const hasSessionExport = exports.some(e => 
    e.name.toLowerCase().includes('session') ||
    e.name.toLowerCase().includes('state') ||
    e.name.toLowerCase().includes('context') ||
    e.name.toLowerCase().includes('manager') ||
    e.name.toLowerCase().includes('store')
  );
  
  return isSessionName || isSessionPath || hasSessionExport;
}

/**
 * Detect if a file is a Next.js App Router page
 * 
 * Characteristics:
 * - Located in /app/ directory (Next.js App Router)
 * - Named page.tsx or page.ts
 * - Exports: metadata (SEO), default (page component), and optionally:
 *   - faqJsonLd, jsonLd (structured data)
 *   - icon (for tool cards)
 *   - generateMetadata (dynamic SEO)
 * 
 * This is the canonical Next.js pattern for SEO-optimized pages.
 * Multiple exports are COHESIVE - they all serve the page's purpose.
 */
function isNextJsPage(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  const lowerPath = file.toLowerCase();
  const fileName = file.split('/').pop()?.toLowerCase();
  
  // Must be in /app/ directory (Next.js App Router)
  const isInAppDir = lowerPath.includes('/app/') || lowerPath.startsWith('app/');
  
  // Must be named page.tsx or page.ts
  const isPageFile = fileName === 'page.tsx' || fileName === 'page.ts';
  
  if (!isInAppDir || !isPageFile) {
    return false;
  }
  
  // Check for Next.js page export patterns
  const exportNames = exports.map(e => e.name.toLowerCase());
  
  // Must have default export (the page component)
  const hasDefaultExport = exports.some(e => e.type === 'default');
  
  // Common Next.js page exports
  const nextJsExports = ['metadata', 'generatemetadata', 'faqjsonld', 'jsonld', 'icon', 'viewport', 'dynamic'];
  const hasNextJsExports = exportNames.some(name => 
    nextJsExports.includes(name) || name.includes('jsonld')
  );
  
  // A Next.js page typically has:
  // 1. Default export (page component) - required
  // 2. Metadata or other Next.js-specific exports - optional but indicative
  return hasDefaultExport || hasNextJsExports;
}

/**
 * Adjust cohesion score based on file classification.
 * 
 * This reduces false positives by recognizing that certain file types
 * have inherently different cohesion patterns:
 * - Utility modules may touch multiple domains but serve one purpose
 * - Service files orchestrate multiple dependencies
 * - Lambda handlers coordinate multiple services
 * - Email templates reference multiple domains for rendering
 * - Parser files transform data across domains
 * 
 * @param baseCohesion - The calculated cohesion score (0-1)
 * @param classification - The file classification
 * @param node - Optional node for additional heuristics
 * @returns Adjusted cohesion score (0-1)
 */
export function adjustCohesionForClassification(
  baseCohesion: number,
  classification: FileClassification,
  node?: DependencyNode
): number {
  switch (classification) {
    case 'barrel-export':
      // Barrel exports re-export from multiple modules by design
      return 1;
    case 'type-definition':
      // Type definitions centralize types - high cohesion by nature
      return 1;
    case 'utility-module': {
      // Utility modules serve a functional purpose despite multi-domain.
      // Use a floor of 0.75 so related utilities never appear as low-cohesion.
      if (node) {
        const exportNames = node.exports.map(e => e.name.toLowerCase());
        const hasRelatedNames = hasRelatedExportNames(exportNames);
        if (hasRelatedNames) {
          return Math.max(0.80, Math.min(1, baseCohesion + 0.45));
        }
      }
      return Math.max(0.75, Math.min(1, baseCohesion + 0.35));
    }
    case 'service-file': {
      // Services orchestrate dependencies by design.
      // Floor at 0.72 so service files are never flagged as low-cohesion.
      if (node?.exports.some(e => e.type === 'class')) {
        return Math.max(0.78, Math.min(1, baseCohesion + 0.40));
      }
      return Math.max(0.72, Math.min(1, baseCohesion + 0.30));
    }
    case 'lambda-handler': {
      // Lambda handlers have single business purpose; floor at 0.75.
      if (node) {
        const hasSingleEntry = node.exports.length === 1 || 
          node.exports.some(e => e.name.toLowerCase() === 'handler');
        if (hasSingleEntry) {
          return Math.max(0.80, Math.min(1, baseCohesion + 0.45));
        }
      }
      return Math.max(0.75, Math.min(1, baseCohesion + 0.35));
    }
    case 'email-template': {
      // Email templates are structurally cohesive (single rendering purpose); floor at 0.72.
      if (node) {
        const hasTemplateFunc = node.exports.some(e => 
          e.name.toLowerCase().includes('render') ||
          e.name.toLowerCase().includes('generate') ||
          e.name.toLowerCase().includes('template')
        );
        if (hasTemplateFunc) {
          return Math.max(0.75, Math.min(1, baseCohesion + 0.40));
        }
      }
      return Math.max(0.72, Math.min(1, baseCohesion + 0.30));
    }
    case 'parser-file': {
      // Parsers transform data - single transformation purpose
      if (node) {
        // Check for parse/transform functions
        const hasParseFunc = node.exports.some(e => 
          e.name.toLowerCase().startsWith('parse') ||
          e.name.toLowerCase().startsWith('transform') ||
          e.name.toLowerCase().startsWith('convert')
        );
        if (hasParseFunc) {
          return Math.max(0.75, Math.min(1, baseCohesion + 0.40));
        }
      }
      return Math.max(0.70, Math.min(1, baseCohesion + 0.30));
    }
    case 'nextjs-page':
      // Next.js pages have multiple exports by design (metadata, jsonLd, page component)
      // All serve the single purpose of rendering an SEO-optimized page
      return 1;
    case 'cohesive-module':
      // Already recognized as cohesive
      return Math.max(baseCohesion, 0.7);
    case 'mixed-concerns':
      // Keep original score - this is a real issue
      return baseCohesion;
    default:
      // Unknown - give benefit of doubt with small boost
      return Math.min(1, baseCohesion + 0.10);
  }
}

/**
 * Check if export names suggest related functionality
 * 
 * Examples of related patterns:
 * - formatDate, parseDate, validateDate (date utilities)
 * - getUser, saveUser, deleteUser (user utilities)
 * - DynamoDB, S3, SQS (AWS utilities)
 */
function hasRelatedExportNames(exportNames: string[]): boolean {
  if (exportNames.length < 2) return true;
  
  // Extract common prefixes/suffixes
  const stems = new Set<string>();
  const domains = new Set<string>();
  
  for (const name of exportNames) {
    // Check for common verb prefixes
    const verbs = ['get', 'set', 'create', 'update', 'delete', 'fetch', 'save', 'load', 'parse', 'format', 'validate', 'convert', 'transform', 'build', 'generate', 'render', 'send', 'receive'];
    for (const verb of verbs) {
      if (name.startsWith(verb) && name.length > verb.length) {
        stems.add(name.slice(verb.length).toLowerCase());
      }
    }
    
    // Check for domain suffixes (User, Order, etc.)
    const domainPatterns = ['user', 'order', 'product', 'session', 'email', 'file', 'db', 's3', 'dynamo', 'api', 'config'];
    for (const domain of domainPatterns) {
      if (name.includes(domain)) {
        domains.add(domain);
      }
    }
  }
  
  // If exports share common stems or domains, they're related
  if (stems.size === 1 && exportNames.length >= 2) return true;
  if (domains.size === 1 && exportNames.length >= 2) return true;
  
  // Check for utilities with same service prefix (e.g., dynamodbGet, dynamodbPut)
  const prefixes = exportNames.map(name => {
    // Extract prefix before first capital letter or common separator
    const match = name.match(/^([a-z]+)/);
    return match ? match[1] : '';
  }).filter(p => p.length >= 3);
  
  if (prefixes.length >= 2) {
    const uniquePrefixes = new Set(prefixes);
    if (uniquePrefixes.size === 1) return true;
  }

  // Check for shared entity noun across all exports using camelCase token splitting
  // e.g. getUserReceipts + createPendingReceipt both contain 'receipt'
  const nounSets = exportNames.map(name => {
    const tokens = name
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean);
    const skip = new Set(['get','set','create','update','delete','fetch','save','load',
      'parse','format','validate','convert','transform','build','generate','render',
      'send','receive','find','list','add','remove','insert','upsert','put','read',
      'write','check','handle','process','pending','active','current','new','old','all']);
    const singularize = (w: string) => w.endsWith('s') && w.length > 3 ? w.slice(0,-1) : w;
    return new Set(tokens.filter(t => !skip.has(t) && t.length > 2).map(singularize));
  });
  if (nounSets.length >= 2 && nounSets.every(s => s.size > 0)) {
    const [first, ...rest] = nounSets;
    const commonNouns = Array.from(first).filter(n => rest.every(s => s.has(n)));
    if (commonNouns.length > 0) return true;
  }

  return false;
}

/**
 * Adjust fragmentation score based on file classification
 * 
 * This reduces false positives by:
 * - Ignoring fragmentation for barrel exports (they're meant to aggregate)
 * - Ignoring fragmentation for type definitions (centralized types are good)
 * - Reducing fragmentation for cohesive modules (large but focused is OK)
 * - Reducing fragmentation for utility/service/handler/template files
 */
export function adjustFragmentationForClassification(
  baseFragmentation: number,
  classification: FileClassification
): number {
  switch (classification) {
    case 'barrel-export':
      // Barrel exports are meant to have multiple domains - no fragmentation
      return 0;
    case 'type-definition':
      // Centralized type definitions are good practice - no fragmentation
      return 0;
    case 'utility-module':
    case 'service-file':
    case 'lambda-handler':
    case 'email-template':
    case 'parser-file':
    case 'nextjs-page':
      // These file types have structural reasons for touching multiple domains
      // Reduce fragmentation significantly
      return baseFragmentation * 0.2;
    case 'cohesive-module':
      // Cohesive modules get a significant discount
      return baseFragmentation * 0.3;
    case 'mixed-concerns':
      // Mixed concerns keep full fragmentation score
      return baseFragmentation;
    default:
      // Unknown gets a small discount (benefit of doubt)
      return baseFragmentation * 0.7;
  }
}

/**
 * Get classification-specific recommendations
 */
export function getClassificationRecommendations(
  classification: FileClassification,
  file: string,
  issues: string[]
): string[] {
  switch (classification) {
    case 'barrel-export':
      return [
        'Barrel export file detected - multiple domains are expected here',
        'Consider if this barrel export improves or hinders discoverability',
      ];
    case 'type-definition':
      return [
        'Type definition file - centralized types improve consistency',
        'Consider splitting if file becomes too large (>500 lines)',
      ];
    case 'cohesive-module':
      return [
        'Module has good cohesion despite its size',
        'Consider documenting the module boundaries for AI assistants',
      ];
    case 'utility-module':
      return [
        'Utility module detected - multiple domains are acceptable here',
        'Consider grouping related utilities by prefix or domain for better discoverability',
      ];
    case 'service-file':
      return [
        'Service file detected - orchestration of multiple dependencies is expected',
        'Consider documenting service boundaries and dependencies',
      ];
    case 'lambda-handler':
      return [
        'Lambda handler detected - coordination of services is expected',
        'Ensure handler has clear single responsibility',
      ];
    case 'email-template':
      return [
        'Email template detected - references multiple domains for rendering',
        'Template structure is cohesive by design',
      ];
    case 'parser-file':
      return [
        'Parser/transformer file detected - handles multiple data sources',
        'Consider documenting input/output schemas',
      ];
    case 'nextjs-page':
      return [
        'Next.js App Router page detected - metadata/JSON-LD/component pattern is cohesive',
        'Multiple exports (metadata, faqJsonLd, default) serve single page purpose',
      ];
    case 'mixed-concerns':
      return [
        'Consider splitting this file by domain',
        'Identify independent responsibilities and extract them',
        'Review import dependencies to understand coupling',
      ];
    default:
      return issues;
  }
}
