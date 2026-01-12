import { estimateTokens } from '@aiready/core';
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
 * Build a dependency graph from file contents
 */
export function buildDependencyGraph(
  files: FileContent[]
): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges = new Map<string, Set<string>>();

  // First pass: Create nodes
  for (const { file, content } of files) {
    const imports = extractImportsFromContent(content);
    const exports = extractExports(content);
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
      if (importPath && !importPath.startsWith('@') && !importPath.startsWith('node:')) {
        // Only include relative/local imports
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
 * Uses entropy: low entropy = high cohesion
 */
export function calculateCohesion(exports: ExportInfo[]): number {
  if (exports.length === 0) return 1;
  if (exports.length === 1) return 1; // Single export = perfect cohesion

  const domains = exports.map((e) => e.inferredDomain || 'unknown');
  const domainCounts = new Map<string, number>();

  for (const domain of domains) {
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
  }

  // Calculate Shannon entropy
  const total = domains.length;
  let entropy = 0;

  for (const count of domainCounts.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize to 0-1 (higher = better cohesion)
  const maxEntropy = Math.log2(total);
  return maxEntropy > 0 ? 1 - entropy / maxEntropy : 1;
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
        return sum + (node ? calculateCohesion(node.exports) : 0);
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
function extractExports(content: string): ExportInfo[] {
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
      const inferredDomain = inferDomain(name);

      exports.push({ name, type, inferredDomain });
    }
  });

  return exports;
}

/**
 * Infer domain from export name
 * Uses common naming patterns
 */
function inferDomain(name: string): string {
  const lower = name.toLowerCase();

  // Common domain keywords
  const domainKeywords = [
    'user',
    'auth',
    'order',
    'product',
    'payment',
    'cart',
    'invoice',
    'customer',
    'admin',
    'api',
    'util',
    'helper',
    'config',
    'service',
    'repository',
    'controller',
    'model',
    'view',
  ];

  for (const keyword of domainKeywords) {
    if (lower.includes(keyword)) {
      return keyword;
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
