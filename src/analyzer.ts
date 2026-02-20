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
  for (const c of counts) {
    const p = c / total;
    entropy -= p * Math.log2(p);
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
  for (const p of probs) {
    entropy -= p * Math.log2(p);
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

  for (const count of domainCounts.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
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
 * - mixed-concerns: Multiple domains, potential refactoring candidate
 * - unknown: Unable to classify
 */
export function classifyFile(
  node: DependencyNode,
  cohesionScore: number,
  domains: string[]
): FileClassification {
  const { exports, imports, linesOfCode } = node;
  
  // 1. Check for barrel export (index file that re-exports)
  if (isBarrelExport(node)) {
    return 'barrel-export';
  }
  
  // 2. Check for type definition file
  if (isTypeDefinitionFile(node)) {
    return 'type-definition';
  }
  
  // 3. Check for cohesive module (single domain + high cohesion)
  const uniqueDomains = domains.filter(d => d !== 'unknown');
  const hasSingleDomain = uniqueDomains.length <= 1;
  const hasHighCohesion = cohesionScore >= 0.7;
  
  if (hasSingleDomain && hasHighCohesion) {
    return 'cohesive-module';
  }
  
  // 4. Check for mixed concerns (multiple domains + low cohesion)
  const hasMultipleDomains = uniqueDomains.length > 1;
  const hasLowCohesion = cohesionScore < 0.5;
  
  if (hasMultipleDomains || hasLowCohesion) {
    return 'mixed-concerns';
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
 */
function isTypeDefinitionFile(node: DependencyNode): boolean {
  const { file, exports } = node;
  
  // Check filename pattern
  const fileName = file.split('/').pop()?.toLowerCase();
  const isTypesFile = fileName?.includes('types') || fileName?.includes('.d.ts') ||
                      fileName === 'types.ts' || fileName === 'interfaces.ts';
  
  // Count type exports vs other exports
  const typeExports = exports.filter(e => e.type === 'type' || e.type === 'interface');
  const runtimeExports = exports.filter(e => e.type === 'function' || e.type === 'class' || e.type === 'const');
  
  // High ratio of type exports
  const mostlyTypes = exports.length > 0 && 
                      typeExports.length > runtimeExports.length &&
                      typeExports.length / exports.length > 0.7;
  
  return isTypesFile || mostlyTypes;
}

/**
 * Adjust fragmentation score based on file classification
 * 
 * This reduces false positives by:
 * - Ignoring fragmentation for barrel exports (they're meant to aggregate)
 * - Ignoring fragmentation for type definitions (centralized types are good)
 * - Reducing fragmentation for cohesive modules (large but focused is OK)
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
