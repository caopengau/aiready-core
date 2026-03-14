import type { DependencyNode, FileClassification } from './types';
import {
  isBarrelExport,
  isTypeDefinition,
  isNextJsPage,
  isLambdaHandler,
  isServiceFile,
  isEmailTemplate,
  isParserFile,
  isSessionFile,
  isUtilityModule,
  isConfigFile,
} from './heuristics';

/**
 * Constants for file classifications to avoid magic strings
 */
export const Classification = {
  BARREL: 'barrel-export' as const,
  TYPE_DEFINITION: 'type-definition' as const,
  NEXTJS_PAGE: 'nextjs-page' as const,
  LAMBDA_HANDLER: 'lambda-handler' as const,
  SERVICE: 'service-file' as const,
  EMAIL_TEMPLATE: 'email-template' as const,
  PARSER: 'parser-file' as const,
  COHESIVE_MODULE: 'cohesive-module' as const,
  UTILITY_MODULE: 'utility-module' as const,
  MIXED_CONCERNS: 'mixed-concerns' as const,
  UNKNOWN: 'unknown' as const,
};

/**
 * Classify a file into a specific type for better analysis context
 *
 * @param node The dependency node representing the file
 * @param cohesionScore The calculated cohesion score for the file
 * @param domains The detected domains/concerns for the file
 * @returns The determined file classification
 */
export function classifyFile(
  node: DependencyNode,
  cohesionScore: number = 1,
  domains: string[] = []
): FileClassification {
  // 1. Detect barrel exports (primarily re-exports)
  if (isBarrelExport(node)) {
    return Classification.BARREL;
  }

  // 2. Detect type definition files
  if (isTypeDefinition(node)) {
    return Classification.TYPE_DEFINITION;
  }

  // 3. Detect Next.js App Router pages
  if (isNextJsPage(node)) {
    return Classification.NEXTJS_PAGE;
  }

  // 4. Detect Lambda handlers
  if (isLambdaHandler(node)) {
    return Classification.LAMBDA_HANDLER;
  }

  // 5. Detect Service files
  if (isServiceFile(node)) {
    return Classification.SERVICE;
  }

  // 6. Detect Email templates
  if (isEmailTemplate(node)) {
    return Classification.EMAIL_TEMPLATE;
  }

  // 7. Detect Parser/Transformer files
  if (isParserFile(node)) {
    return Classification.PARSER;
  }

  // 8. Detect Session/State management files
  if (isSessionFile(node)) {
    // If it has high cohesion, it's a cohesive module
    if (cohesionScore >= 0.25 && domains.length <= 1)
      return Classification.COHESIVE_MODULE;
    return Classification.UTILITY_MODULE; // Group with utility for now
  }

  // 9. Detect Utility modules (multi-domain but functional purpose)
  if (isUtilityModule(node)) {
    return Classification.UTILITY_MODULE;
  }

  // 10. Detect Config/Schema files
  if (isConfigFile(node)) {
    return Classification.COHESIVE_MODULE;
  }

  // Cohesion and Domain heuristics
  if (domains.length <= 1 && domains[0] !== 'unknown') {
    return Classification.COHESIVE_MODULE;
  }

  if (domains.length > 1 && cohesionScore < 0.4) {
    return Classification.MIXED_CONCERNS;
  }

  if (cohesionScore >= 0.7) {
    return Classification.COHESIVE_MODULE;
  }

  return Classification.UNKNOWN;
}

// [Split Point] Logic below this point handled by heuristics.ts

/**
 * Adjust cohesion score based on file classification
 *
 * @param baseCohesion The initial cohesion score
 * @param classification The file classification
 * @param node Optional dependency node for further context
 * @returns The adjusted cohesion score
 */
export function adjustCohesionForClassification(
  baseCohesion: number,
  classification: FileClassification,
  node?: DependencyNode
): number {
  switch (classification) {
    case Classification.BARREL:
      return 1;
    case Classification.TYPE_DEFINITION:
      return 1;
    case Classification.NEXTJS_PAGE:
      return 1;
    case Classification.UTILITY_MODULE: {
      if (
        node &&
        hasRelatedExportNames(
          (node.exports || []).map((e) => e.name.toLowerCase())
        )
      ) {
        return Math.max(0.8, Math.min(1, baseCohesion + 0.45));
      }
      return Math.max(0.75, Math.min(1, baseCohesion + 0.35));
    }
    case Classification.SERVICE:
      return Math.max(0.72, Math.min(1, baseCohesion + 0.3));
    case Classification.LAMBDA_HANDLER:
      return Math.max(0.75, Math.min(1, baseCohesion + 0.35));
    case Classification.EMAIL_TEMPLATE:
      return Math.max(0.72, Math.min(1, baseCohesion + 0.3));
    case Classification.PARSER:
      return Math.max(0.7, Math.min(1, baseCohesion + 0.3));
    case Classification.COHESIVE_MODULE:
      return Math.max(baseCohesion, 0.7);
    case Classification.MIXED_CONCERNS:
      return baseCohesion;
    default:
      return Math.min(1, baseCohesion + 0.1);
  }
}

/**
 * Check if export names suggest related functionality
 *
 * @param exportNames List of exported names
 * @returns True if names appear related
 */
function hasRelatedExportNames(exportNames: string[]): boolean {
  if (exportNames.length < 2) return true;

  const stems = new Set<string>();
  const domains = new Set<string>();

  const verbs = [
    'get',
    'set',
    'create',
    'update',
    'delete',
    'fetch',
    'save',
    'load',
    'parse',
    'format',
    'validate',
  ];
  const domainPatterns = [
    'user',
    'order',
    'product',
    'session',
    'email',
    'file',
    'db',
    'api',
    'config',
  ];

  for (const name of exportNames) {
    for (const verb of verbs) {
      if (name.startsWith(verb) && name.length > verb.length) {
        stems.add(name.slice(verb.length).toLowerCase());
      }
    }
    for (const domain of domainPatterns) {
      if (name.includes(domain)) domains.add(domain);
    }
  }

  if (stems.size === 1 || domains.size === 1) return true;

  return false;
}

/**
 * Adjust fragmentation score based on file classification
 *
 * @param baseFragmentation The initial fragmentation score
 * @param classification The file classification
 * @returns The adjusted fragmentation score
 */
export function adjustFragmentationForClassification(
  baseFragmentation: number,
  classification: FileClassification
): number {
  switch (classification) {
    case Classification.BARREL:
      return 0;
    case Classification.TYPE_DEFINITION:
      return 0;
    case Classification.UTILITY_MODULE:
    case Classification.SERVICE:
    case Classification.LAMBDA_HANDLER:
    case Classification.EMAIL_TEMPLATE:
    case Classification.PARSER:
    case Classification.NEXTJS_PAGE:
      return baseFragmentation * 0.2;
    case Classification.COHESIVE_MODULE:
      return baseFragmentation * 0.3;
    case Classification.MIXED_CONCERNS:
      return baseFragmentation;
    default:
      return baseFragmentation * 0.7;
  }
}
