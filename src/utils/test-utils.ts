import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Common test file patterns for multiple languages.
 */
export const TEST_PATTERNS = [
  /\.(test|spec)\.(ts|tsx|js|jsx)$/,
  /_test\.go$/,
  /test_.*\.py$/,
  /.*_test\.py$/,
  /.*Test\.java$/,
  /.*Tests\.cs$/,
  /__tests__\//,
  /\/tests?\//,
  /\/e2e\//,
  /\/fixtures\//,
];

/**
 * Check if a file path matches known test patterns.
 *
 * @param filePath - The file path to check.
 * @param extraPatterns - Optional extra patterns to include.
 * @returns True if the file is considered a test file.
 */
export function isTestFile(
  filePath: string,
  extraPatterns?: string[]
): boolean {
  if (TEST_PATTERNS.some((p) => p.test(filePath))) return true;
  if (extraPatterns) return extraPatterns.some((p) => filePath.includes(p));
  return false;
}

/**
 * Detect if a testing framework is present in the root directory.
 * Supports Node.js (Jest, Vitest, etc.), Python (Pytest), Java (JUnit), and Go.
 *
 * @param rootDir - The root directory of the project.
 * @returns True if a testing framework is detected.
 */
export function detectTestFramework(rootDir: string): boolean {
  // Check common manifest files
  const manifests = [
    {
      file: 'package.json',
      deps: [
        'jest',
        'vitest',
        'mocha',
        'jasmine',
        'ava',
        'tap',
        'playwright',
        'cypress',
      ],
    },
    { file: 'requirements.txt', deps: ['pytest', 'unittest', 'nose'] },
    { file: 'pyproject.toml', deps: ['pytest'] },
    { file: 'pom.xml', deps: ['junit', 'testng'] },
    { file: 'build.gradle', deps: ['junit', 'testng'] },
    { file: 'go.mod', deps: ['testing'] }, // go testing is built-in
  ];

  for (const m of manifests) {
    const p = join(rootDir, m.file);
    if (existsSync(p)) {
      if (m.file === 'go.mod') return true; // built-in
      try {
        const content = readFileSync(p, 'utf-8');
        if (m.deps.some((d) => content.includes(d))) return true;
      } catch {
        // Ignore file read errors
      }
    }
  }
  return false;
}

/**
 * Check if a file is a type definition, constant file, or other "ignorable"
 * source file that shouldn't necessarily require its own tests.
 *
 * @param filePath - The path to check.
 * @returns True if the file is ignorable for test ratio purposes.
 */
export function isIgnorableSourceFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith('.d.ts') ||
    lower.endsWith('types.ts') ||
    lower.endsWith('interface.ts') ||
    lower.endsWith('constants.ts') ||
    lower.includes('/types/') ||
    lower.includes('/interfaces/') ||
    lower.includes('/constants/') ||
    lower.includes('/models/') || // Often just data structures
    lower.includes('/schemas/') // Often just data validation
  );
}

/**
 * Check if a file path belongs to a build artifact or dependency folder.
 *
 * @param filePath - The path to check.
 * @returns True if the file is a build artifact.
 */
export function isBuildArtifact(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('/node_modules/') ||
    lower.includes('/dist/') ||
    lower.includes('/build/') ||
    lower.includes('/out/') ||
    lower.includes('/.next/') ||
    lower.includes('/target/') ||
    lower.includes('/bin/')
  );
}
