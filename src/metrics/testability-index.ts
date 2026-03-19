/**
 * Testability Index Metrics.
 * Measures how verifiable AI-generated changes are based on local testing infrastructure.
 *
 * @lastUpdated 2026-03-19
 */

export interface FileTestability {
  filePath: string;
  score: number;
  purityScore: number;
  isEntryPoint: boolean;
}

export interface TestabilityIndex {
  score: number;
  rating: 'excellent' | 'good' | 'moderate' | 'poor' | 'unverifiable';
  dimensions: {
    testCoverageRatio: number;
    purityScore: number;
    dependencyInjectionScore: number;
    interfaceFocusScore: number;
    observabilityScore: number;
  };
  aiChangeSafetyRating: 'safe' | 'moderate-risk' | 'high-risk' | 'blind-risk';
  recommendations: string[];
  /** Per-file testability metrics */
  fileMetrics?: FileTestability[];
  /** Score based only on library code (excluding CLI entry points) */
  libraryScore?: number;
}

/**
 * Check if a file is likely a CLI entry point that inherently has side effects.
 * These files are expected to have console/process I/O and should be weighted lower.
 */
function isLikelyEntryPoint(filePath: string): boolean {
  const basename = filePath.split('/').pop() || '';
  const lowerBasename = basename.toLowerCase();

  // CLI entry point patterns
  const entryPointPatterns = [
    'cli',
    'main',
    'bin',
    'index', // often used as entry point
    'run',
    'serve',
    'start',
    'boot',
    'init',
  ];

  // Check if filename matches entry point patterns
  const nameWithoutExt = lowerBasename.replace(
    /\.(ts|js|tsx|jsx|mjs|cjs)$/,
    ''
  );
  if (
    entryPointPatterns.some(
      (p) =>
        nameWithoutExt === p ||
        nameWithoutExt.endsWith(`-${p}`) ||
        nameWithoutExt.startsWith(`${p}-`)
    )
  ) {
    return true;
  }

  // Check for common CLI directories
  const cliDirPatterns = ['/bin/', '/cli/', '/cmd/', '/commands/'];
  if (cliDirPatterns.some((p) => filePath.includes(p))) {
    return true;
  }

  return false;
}

/**
 * Calculate file-level purity score.
 */
function calculateFilePurityScore(
  pureFunctions: number,
  totalFunctions: number
): number {
  if (totalFunctions === 0) return 100; // No functions = fully pure
  return Math.round((pureFunctions / totalFunctions) * 100);
}

/**
 * Calculate the Testability Index for a project.
 *
 * @param params - Metrics including coverage, purity, and dependency patterns.
 * @param params.testFiles - Count of identifiable test files.
 * @param params.sourceFiles - Total number of source files.
 * @param params.pureFunctions - Count of functions without side effects.
 * @param params.totalFunctions - Total number of functions analyzed.
 * @param params.injectionPatterns - Count of classes using dependency injection.
 * @param params.totalClasses - Total number of classes analyzed.
 * @param params.bloatedInterfaces - Count of interfaces with too many methods.
 * @param params.totalInterfaces - Total number of interfaces analyzed.
 * @param params.externalStateMutations - Count of nodes that mutate external state.
 * @param params.hasTestFramework - Whether a testing framework (e.g., Vitest) is detected.
 * @param params.fileDetails - Optional per-file data for detailed analysis.
 * @returns Comprehensive TestabilityIndex analysis.
 */
export function calculateTestabilityIndex(params: {
  testFiles: number;
  sourceFiles: number;
  pureFunctions: number;
  totalFunctions: number;
  injectionPatterns: number;
  totalClasses: number;
  bloatedInterfaces: number;
  totalInterfaces: number;
  externalStateMutations: number;
  hasTestFramework: boolean;
  fileDetails?: Array<{
    filePath: string;
    pureFunctions: number;
    totalFunctions: number;
  }>;
}): TestabilityIndex {
  const {
    testFiles,
    sourceFiles,
    pureFunctions,
    totalFunctions,
    injectionPatterns,
    totalClasses,
    bloatedInterfaces,
    totalInterfaces,
    externalStateMutations,
    hasTestFramework,
    fileDetails,
  } = params;

  const rawCoverageRatio = sourceFiles > 0 ? testFiles / sourceFiles : 0;
  const testCoverageRatio = Math.min(100, Math.round(rawCoverageRatio * 100));
  const purityScore = Math.round(
    (totalFunctions > 0 ? pureFunctions / totalFunctions : 0.7) * 100
  );
  const dependencyInjectionScore = Math.round(
    Math.min(
      100,
      (totalClasses > 0 ? injectionPatterns / totalClasses : 0.8) * 100
    )
  );
  const interfaceFocusScore = Math.max(
    0,
    Math.round(
      100 -
        (totalInterfaces > 0 ? (bloatedInterfaces / totalInterfaces) * 80 : 0)
    )
  );
  const observabilityScore = Math.max(
    0,
    Math.round(
      100 -
        (totalFunctions > 0
          ? (externalStateMutations / totalFunctions) * 100
          : 0)
    )
  );

  const frameworkWeight = hasTestFramework ? 1.0 : 0.8;

  // Process file-level metrics if provided
  let fileMetrics: FileTestability[] | undefined;
  let libraryPureFunctions = pureFunctions;
  let libraryTotalFunctions = totalFunctions;
  let entryPointCount = 0;

  if (fileDetails && fileDetails.length > 0) {
    fileMetrics = fileDetails.map((file) => {
      const isEntryPoint = isLikelyEntryPoint(file.filePath);
      const purityScore = calculateFilePurityScore(
        file.pureFunctions,
        file.totalFunctions
      );

      if (isEntryPoint) {
        entryPointCount++;
        // Exclude entry point functions from library calculation
        libraryPureFunctions -= file.pureFunctions;
        libraryTotalFunctions -= file.totalFunctions;
      }

      return {
        filePath: file.filePath,
        score: purityScore, // Simplified - just purity for file-level
        purityScore,
        isEntryPoint,
      };
    });
  }

  // Calculate library purity score (excluding entry points)
  const libraryPurityScore = Math.max(
    0,
    Math.round(
      (libraryTotalFunctions > 0
        ? libraryPureFunctions / libraryTotalFunctions
        : 0.7) * 100
    )
  );

  // Use library score as the main purity score when we have file details
  const effectivePurityScore =
    fileDetails && fileDetails.length > 0 ? libraryPurityScore : purityScore;

  const rawScore =
    (testCoverageRatio * 0.3 +
      effectivePurityScore * 0.25 +
      dependencyInjectionScore * 0.2 +
      interfaceFocusScore * 0.1 +
      observabilityScore * 0.15) *
    frameworkWeight;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  let rating: TestabilityIndex['rating'];
  if (score >= 85) rating = 'excellent';
  else if (score >= 70) rating = 'good';
  else if (score >= 50) rating = 'moderate';
  else if (score >= 30) rating = 'poor';
  else rating = 'unverifiable';

  let aiChangeSafetyRating: TestabilityIndex['aiChangeSafetyRating'];
  if (rawCoverageRatio >= 0.5 && score >= 70) aiChangeSafetyRating = 'safe';
  else if (rawCoverageRatio >= 0.2 && score >= 50)
    aiChangeSafetyRating = 'moderate-risk';
  else if (rawCoverageRatio > 0) aiChangeSafetyRating = 'high-risk';
  else aiChangeSafetyRating = 'blind-risk';

  const recommendations: string[] = [];
  if (!hasTestFramework)
    recommendations.push(
      'Add a testing framework (Jest, Vitest, pytest) — AI changes cannot be verified without tests'
    );
  if (rawCoverageRatio < 0.3) {
    const neededTests = Math.round(sourceFiles * 0.3 - testFiles);
    recommendations.push(
      `Add ~${neededTests} test files to reach 30% coverage ratio — minimum for safe AI assistance`
    );
  }
  if (effectivePurityScore < 50)
    recommendations.push(
      entryPointCount > 0
        ? `Extract pure functions from library code (${entryPointCount} entry point files excluded) — pure functions are trivially AI-testable`
        : 'Extract pure functions from side-effectful code — pure functions are trivially AI-testable'
    );
  if (dependencyInjectionScore < 50 && totalClasses > 0)
    recommendations.push(
      'Adopt dependency injection — makes classes mockable and AI-generated code verifiable'
    );
  if (externalStateMutations > totalFunctions * 0.3)
    recommendations.push(
      'Reduce direct state mutations — return values instead to improve observability'
    );

  return {
    score,
    rating,
    dimensions: {
      testCoverageRatio,
      purityScore: effectivePurityScore,
      dependencyInjectionScore,
      interfaceFocusScore,
      observabilityScore,
    },
    aiChangeSafetyRating,
    recommendations,
    fileMetrics: fileMetrics as any,
    libraryScore: Math.max(0, fileMetrics ? libraryPurityScore : purityScore),
  };
}
