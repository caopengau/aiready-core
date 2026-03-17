import { ExportWithImports, FileImport, ASTNode } from '../types/ast';
import { calculateImportSimilarity } from './similarity-utils';
import { parseFileExports } from './dependency-analyzer';

export {
  ExportWithImports,
  FileImport,
  ASTNode,
  calculateImportSimilarity,
  parseFileExports,
};
