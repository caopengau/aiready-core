import { estimateTokens, parseFileExports, calculateImportSimilarity, type ExportWithImports } from '@aiready/core';
import type {
  ContextAnalysisResult,
  DependencyGraph,
  DependencyNode,
  ExportInfo,
  ModuleCluster,
} from './types';

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
  domainOptions?: {
    domainKeywords?: string[];
    domainPatterns?: string[];
    pathDomainMap?: Record<string, string>;
  }
): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges = new Map<string, Set<string>>();

  // Auto-detect domain keywords from workspace folder structure
  const autoDetectedKeywords = extractDomainKeywordsFromPaths(files);
  const enhancedOptions = {
    ...domainOptions,
    domainKeywords: [
      ...(domainOptions?.domainKeywords || []),
      ...autoDetectedKeywords,
    ],
  };

  // First pass: Create nodes
  for (const { file, content } of files) {
    const imports = extractImportsFromContent(content);
    
    // Use AST-based extraction for better accuracy, fallback to regex
    const exports = extractExportsWithAST(content, file, enhancedOptions, imports);
    
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

  return { nodes, edges };
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
export function calculateCohesion(exports: ExportInfo[], filePath?: string): number {
  return calculateEnhancedCohesion(exports, filePath);
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
  domain: string
): number {
  if (files.length <= 1) return 0; // Single file = no fragmentation

  // Calculate how many different directories contain these files
  const directories = new Set(files.map((f) => f.split('/').slice(0, -1).join('/')));

  // Fragmentation = unique directories / total files
  // 0 = all in same dir, 1 = all in different dirs
  return (directories.size - 1) / (files.length - 1);
}

/**
 * Group files by domain to detect module clusters
 */
export function detectModuleClusters(
  graph: DependencyGraph
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

    const fragmentationScore = calculateFragmentation(files, domain);

    const avgCohesion =
      files.reduce((sum, file) => {
        const node = graph.nodes.get(file);
        return sum + (node ? calculateCohesion(node.exports, file) : 0);
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
  domainOptions?: { domainKeywords?: string[]; domainPatterns?: string[]; pathDomainMap?: Record<string, string> },
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

  // Configurable regex patterns take highest precedence
  const patterns = (domainOptions?.domainPatterns || [])
    .map((p) => {
      try {
        return new RegExp(p, 'i');
      } catch {
        return null;
      }
    })
    .filter((r): r is RegExp => !!r);

  for (const re of patterns) {
    if (re.test(lower)) {
      const matched = domainKeywords.find((k) => re.test(k));
      if (matched) return matched;
      return 'unknown';
    }
  }

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
    // Check configured path domain map first
    if (domainOptions?.pathDomainMap) {
      const segments = filePath.toLowerCase().split('/');
      for (const seg of segments) {
        if (domainOptions.pathDomainMap[seg]) {
          return domainOptions.pathDomainMap[seg];
        }
      }
    }
    
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
  domainOptions?: { domainKeywords?: string[]; domainPatterns?: string[]; pathDomainMap?: Record<string, string> },
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
  filePath?: string
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
  const hasImportData = exports.some(e => e.imports && e.imports.length > 0);
  
  if (!hasImportData) {
    // No import data available, use domain-based only
    return domainCohesion;
  }

  const importCohesion = calculateImportBasedCohesion(exports);

  // Weighted combination: 60% import-based, 40% domain-based
  return importCohesion * 0.6 + domainCohesion * 0.4;
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
