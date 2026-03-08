import * as Parser from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';

let isTreeSitterInitialized = false;

/**
 * Initialize tree-sitter once
 */
export async function initTreeSitter(): Promise<void> {
  if (isTreeSitterInitialized) return;

  try {
    await Parser.Parser.init({
      locateFile(scriptName: string) {
        const p = path.join(process.cwd(), scriptName);
        if (fs.existsSync(p)) return p;
        const p2 = path.join(__dirname, scriptName);
        if (fs.existsSync(p2)) return p2;
        return scriptName;
      },
    });
    isTreeSitterInitialized = true;
  } catch (error) {
    console.error('Failed to initialize web-tree-sitter:', error);
    isTreeSitterInitialized = true;
  }
}

/**
 * Find a WASM file for a specific language
 */
export function getWasmPath(language: string): string | null {
  const wasmFileName = `tree-sitter-${language}.wasm`;

  const possiblePaths = [
    // 1. Current directory (Lambda/SST root or bundled CLI)
    path.join(process.cwd(), wasmFileName),
    path.join(__dirname, wasmFileName),

    // 2. Standard node_modules locations (monorepo & installed)
    path.join(
      process.cwd(),
      'node_modules/@unit-mesh/treesitter-artifacts/wasm',
      wasmFileName
    ),
    path.join(
      process.cwd(),
      'node_modules/tree-sitter-wasms/out',
      wasmFileName
    ),

    // 3. Parent node_modules (when running from a package in monorepo)
    path.join(
      __dirname,
      '../../node_modules/@unit-mesh/treesitter-artifacts/wasm',
      wasmFileName
    ),
    path.join(
      __dirname,
      '../../../node_modules/@unit-mesh/treesitter-artifacts/wasm',
      wasmFileName
    ),
    path.join(
      __dirname,
      '../../../../node_modules/@unit-mesh/treesitter-artifacts/wasm',
      wasmFileName
    ),

    // 4. Relative to core assets (if we bundle them)
    path.join(__dirname, '../assets', wasmFileName),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      // console.log(`[Parser] Found WASM for ${language} at: ${p}`);
      return p;
    }
  }

  console.warn(
    `[Parser] WASM file for ${language} not found. Checked ${possiblePaths.length} paths. CWD: ${process.cwd()}, DIR: ${__dirname}`
  );
  return null;
}

/**
 * Load a language and return a configured parser
 */
export async function setupParser(
  language: string
): Promise<Parser.Parser | null> {
  await initTreeSitter();

  const wasmPath = getWasmPath(language);
  if (!wasmPath) {
    console.warn(`WASM file for ${language} not found.`);
    return null;
  }

  try {
    const parser = new Parser.Parser();
    const Lang = await Parser.Language.load(wasmPath);
    parser.setLanguage(Lang);
    return parser;
  } catch (error) {
    console.error(`Failed to setup parser for ${language}:`, error);
    return null;
  }
}
